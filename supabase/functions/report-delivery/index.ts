// @ts-nocheck
import { serve } from 'https://deno.land/std@0.177.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.38.4';

const WHATSAPP_TOKEN = Deno.env.get('WHATSAPP_TOKEN') || '';
const WHATSAPP_PHONE_ID = Deno.env.get('WHATSAPP_PHONE_ID') || '';
const SUPABASE_URL = Deno.env.get('SUPABASE_URL') || '';
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || '';

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

serve(async (req) => {
  try {
    const body = await req.json();
    const record = body.record;

    if (body.type !== 'INSERT' && body.type !== 'UPDATE') {
      return new Response('Ignored', { status: 200 });
    }

    // We only process queued deliveries
    if (record.entity_type !== 'report_deliveries' || record.payload.status !== 'queued') {
      return new Response('Not queued report delivery', { status: 200 });
    }

    const patientId = record.patient_id;
    const deliveryId = record.entity_id;
    const payload = record.payload;

    // Fetch the recipient
    const { data: recipientData, error: recipientError } = await supabase
      .from('sync_records')
      .select('payload')
      .eq('patient_id', patientId)
      .eq('entity_type', 'report_recipients')
      .eq('entity_id', payload.recipient_id)
      .single();

    if (recipientError || !recipientData) {
      throw new Error('Recipient not found');
    }

    const recipient = recipientData.payload;
    if (recipient.consent_status !== 'enabled') {
      throw new Error('Recipient consent revoked');
    }

    // Fetch the report snapshot
    const { data: reportData, error: reportError } = await supabase
      .from('sync_records')
      .select('payload')
      .eq('patient_id', patientId)
      .eq('entity_type', 'activity_reports')
      .eq('entity_id', payload.report_snapshot_id)
      .single();

    if (reportError || !reportData) {
      throw new Error('Report snapshot not found');
    }

    // Mark as sending
    payload.status = 'sending';
    payload.provider = 'whatsapp_business';
    payload.attempt_count = (payload.attempt_count || 0) + 1;
    payload.updated_at = new Date().toISOString();

    await supabase.from('sync_records').update({ payload }).eq('id', record.id);

    // Call WhatsApp Business API
    // The WhatsApp Business API requires an approved template to initiate a conversation.
    const destination = recipient.normalized_destination.replace(/^\+/, ''); // Remove leading +

    const whatsappPayload = {
      messaging_product: 'whatsapp',
      to: destination,
      type: 'template',
      template: {
        name: 'smaran_care_report',
        language: {
          code: 'en_US'
        },
        components: [
          {
            type: 'body',
            parameters: [
              { type: 'text', text: reportData.payload.snapshot.patientName || 'your loved one' },
              { type: 'text', text: payload.report_period || 'recent' }
            ]
          }
        ]
      }
    };

    const response = await fetch(`https://graph.facebook.com/v17.0/${WHATSAPP_PHONE_ID}/messages`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${WHATSAPP_TOKEN}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(whatsappPayload)
    });

    const result = await response.json();

    if (!response.ok) {
      throw new Error(result.error?.message || 'WhatsApp API error');
    }

    // Mark as sent
    payload.status = 'sent';
    payload.provider_message_id = result.messages?.[0]?.id || null;
    payload.sent_at = new Date().toISOString();
    payload.updated_at = new Date().toISOString();

    await supabase.from('sync_records').update({ payload }).eq('id', record.id);

    return new Response(JSON.stringify({ success: true, messageId: payload.provider_message_id }), {
      headers: { 'Content-Type': 'application/json' },
      status: 200,
    });

  } catch (error) {
    console.error('Error processing delivery:', error);
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { 'Content-Type': 'application/json' },
      status: 500,
    });
  }
});
