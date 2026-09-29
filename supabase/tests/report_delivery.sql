-- Disposable PostgreSQL only. Every synthetic row and receipt rolls back.
begin;
create function pg_temp.delivery_push(patient text,kind text,identity text,p jsonb) returns void language plpgsql as $$
declare result jsonb;
begin
  result := public.push_mutations(jsonb_build_array(jsonb_build_object('mutation_id',replace(gen_random_uuid()::text,'-',''),
    'patient_id',patient,'entity_type',kind,'entity_id',identity,'operation','upsert','payload',p)));
  if result->0->>'status'<>'applied' then raise exception 'Delivery fixture push failed: %',result; end if;
end;
$$;
do $$
declare a uuid:=gen_random_uuid(); b uuid:=gen_random_uuid(); stamp text:='2026-09-29T10:00:00.000Z';
  member jsonb; recipient jsonb; report jsonb; delivery jsonb; facts jsonb; games jsonb; result jsonb;
  token uuid; first_token uuid; n integer; i integer; rid text; did text;
begin
  if not (select relrowsecurity from pg_class where oid='public.report_send_jobs'::regclass) or
    has_table_privilege('authenticated','public.report_send_jobs','SELECT') or
    has_function_privilege('authenticated','public.report_delivery_claim(uuid,text,text)','EXECUTE') or
    has_function_privilege('anon','public.report_delivery_finish(uuid,text,text)','EXECUTE') or
    has_function_privilege('authenticated','public.report_delivery_pending()','EXECUTE') or
    not has_function_privilege('service_role','public.report_delivery_claim(uuid,text,text)','EXECUTE') then raise exception 'Worker grants unsafe'; end if;
  insert into auth.users(id) values(a),(b);
  perform set_config('request.jwt.claim.sub',a::text,true);
  set local role authenticated;
  perform pg_temp.delivery_push('worker-patient','patient_profiles','worker-patient',jsonb_build_object(
    'id','worker-patient','preferred_name','Synthetic','age_bracket',null,'emergency_name',null,'emergency_phone',null,'created_at',stamp,'updated_at',stamp));
  member:=jsonb_build_object('id','worker-member','patient_id','worker-patient','display_name','Synthetic','relationship','daughter',
    'access_role','family','email',null,'phone','+15551234567','status','local','scopes','["reports","cognitive_activity"]','created_at',stamp,'updated_at',stamp);
  perform pg_temp.delivery_push('worker-patient','care_circle_members','worker-member',member);
  select jsonb_agg(jsonb_build_object('gameType',g,'sessions',1,'attempts',4,'correct',3,'hints',1,'repeatedErrors',0) order by ord) into games
    from unnest(array['memory_match','pattern_recognition','routine_recall','familiar_object','sequence_memory','picture_recall','remember_lights','number_path']) with ordinality as items(g,ord);
  facts:=jsonb_build_object('patientName','Synthetic','days',7,'timezone','UTC','games',games,
    'routine',jsonb_build_object('completed',0,'hydration',0,'activity',0,'appointment',0,'unknownCategory',0,'scheduledToday',0,'completedToday',0),
    'memories',jsonb_build_object('stored',0,'added',0));
  report:=jsonb_build_object('id','worker-report','patient_id','worker-patient','period_start','2026-09-01T00:00:00.000Z',
    'period_end','2026-09-08T00:00:00.000Z','generated_at',stamp,'report_version',1,'snapshot',facts::text,'delivery_state','generated','updated_at',stamp);
  perform pg_temp.delivery_push('worker-patient','activity_reports','worker-report',report);
  for i in 1..6 loop
    rid:='recipient-'||i; did:='delivery-'||i;
    recipient:=jsonb_build_object('id',rid,'patient_id','worker-patient','care_member_id','worker-member','channel','whatsapp',
      'normalized_destination','+15551234567','consent_status','enabled','frequency','manual','created_at',stamp,'updated_at',stamp,'revoked_at',null);
    perform pg_temp.delivery_push('worker-patient','report_recipients',rid,recipient);
    delivery:=jsonb_build_object('id',did,'patient_id','worker-patient','recipient_id',rid,'report_period','7-day',
      'report_start',report->>'period_start','report_end',report->>'period_end','report_snapshot_id','worker-report','status','delivered',
      'provider','whatsapp_business','provider_message_id','client-forged','attempt_count',9,'last_error',null,
      'queued_at',stamp,'sent_at',stamp,'delivered_at',stamp,'failed_at',null,'created_at',stamp,'updated_at',stamp);
    perform pg_temp.delivery_push('worker-patient','report_deliveries',did,delivery);
    if (select payload->>'status' from public.sync_records where owner_id=a and entity_type='report_deliveries' and entity_id=did)<>'queued' then
      raise exception 'Client forged receipt accepted'; end if;
  end loop;
  reset role;
  set local role service_role;
  if public.report_delivery_claim(b,'worker-patient','delivery-1')->>'error'<>'forbidden' or
    public.report_delivery_claim(a,'other-patient','delivery-1')->>'error'<>'forbidden' then raise exception 'Owner/patient isolation failed'; end if;
  result:=public.report_delivery_claim(a,'worker-patient','delivery-1'); token:=(result->>'claim')::uuid;
  if result->>'ok'<>'true' or token is null or result->>'destination'<>'+15551234567' then raise exception 'Valid claim failed: %',result; end if;
  if public.report_delivery_claim(a,'worker-patient','delivery-1')->>'error'<>'already_claimed' then raise exception 'Duplicate claim'; end if;
  perform public.report_delivery_finish(token,'accepted','synthetic-1');
  perform public.report_delivery_finish(token,'unknown');
  perform public.report_delivery_finish(token,'delivered','synthetic-1');
  perform public.report_delivery_finish(token,'sent','synthetic-1');
  perform public.report_delivery_finish(token,'failed','synthetic-1');
  reset role;
  if (select state from public.report_send_jobs where claim=token)<>'delivered' then raise exception 'Receipt state regressed'; end if;
  if (select payload->>'status' from public.sync_records where owner_id=a and entity_type='report_deliveries' and entity_id='delivery-1')<>'delivered' then raise exception 'Receipt not projected'; end if;
  -- Offline intent replay cannot overwrite receipts.
  set local role authenticated;
  perform pg_temp.delivery_push('worker-patient','report_deliveries','delivery-1',delivery || '{"id":"delivery-1","recipient_id":"recipient-1","status":"queued"}');
  if (select payload->>'status' from public.sync_records where owner_id=a and entity_type='report_deliveries' and entity_id='delivery-1')<>'delivered' then raise exception 'Offline replay forged state'; end if;
  -- A different delivery ID or manual alias cannot send the same recipient/window twice.
  perform pg_temp.delivery_push('worker-patient','report_deliveries','duplicate',delivery || '{"id":"duplicate","recipient_id":"recipient-1","report_period":"manual"}');
  reset role; set local role service_role;
  if public.report_delivery_claim(a,'worker-patient','duplicate')->>'error'<>'already_claimed' then raise exception 'Duplicate period sent'; end if;
  result:=public.report_delivery_claim(a,'worker-patient','delivery-2'); token:=(result->>'claim')::uuid;
  perform public.report_delivery_finish(token,'unknown');
  if public.report_delivery_claim(a,'worker-patient','delivery-2')->>'error'<>'already_claimed' then raise exception 'Ambiguous send retried'; end if;
  -- A signed callback can settle a timeout even when no HTTP message ID was saved.
  perform public.report_delivery_finish(token,'delivered','synthetic-2');
  result:=public.report_delivery_claim(a,'worker-patient','delivery-3'); token:=(result->>'claim')::uuid; first_token:=token;
  for n in 1..3 loop
    perform public.report_delivery_finish(token,'rate_limited');
    if public.report_delivery_claim(a,'worker-patient','delivery-3')->>'error'<>'already_claimed' then raise exception 'Backoff bypass'; end if;
    if n<3 then
      reset role; update public.report_send_jobs set available_at=now()-interval '1 second' where claim=token;
      set local role service_role;
      result:=public.report_delivery_claim(a,'worker-patient','delivery-3'); token:=(result->>'claim')::uuid;
      if result->>'ok'<>'true' or token=first_token then raise exception 'Retry claim not renewed'; end if;
    end if;
  end loop;
  reset role;
  if (select attempt from public.report_send_jobs where claim=token)<>3 or
    (select state from public.report_send_jobs where claim=token)<>'failed' then raise exception 'Retry limit missing'; end if;
  set local role service_role;
  result:=public.report_delivery_claim(a,'worker-patient','delivery-5'); token:=(result->>'claim')::uuid;
  perform public.report_delivery_finish(token,'rate_limited');
  reset role;
  set local role authenticated;
  -- A valid legacy recipient may lack a care-circle link; it must not block the queue.
  perform pg_temp.delivery_push('worker-patient','report_recipients','recipient-6',recipient || '{"care_member_id":null}');
  perform pg_temp.delivery_push('worker-patient','care_circle_members','worker-member',member || '{"scopes":"[]"}');
  reset role; set local role service_role;
  if public.report_delivery_claim(a,'worker-patient','delivery-4')->>'error'<>'forbidden' then raise exception 'Revoked scope sent'; end if;
  if public.report_delivery_claim(a,'worker-patient','delivery-5')->>'error'<>'forbidden' then raise exception 'Revoked retry sent'; end if;
  if public.report_delivery_claim(a,'worker-patient','delivery-6')->>'error'<>'forbidden' then raise exception 'Unlinked recipient sent'; end if;
  if jsonb_array_length(public.report_delivery_pending())<>0 then raise exception 'Terminal/denied intents still selected'; end if;
  reset role;
  if (select attempt from public.report_send_jobs where delivery_id='delivery-4')<>0 then raise exception 'Denied intent counted as send'; end if;
  if (select attempt from public.report_send_jobs where delivery_id='delivery-5')<>1 or
    (select attempt from public.report_send_jobs where delivery_id='delivery-6')<>0 then raise exception 'Denied attempt counts changed'; end if;
end;
$$;
rollback;
