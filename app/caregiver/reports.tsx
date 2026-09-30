import { useEffect, useRef, useState } from 'react';
import { View } from 'react-native';
import { CareWorkspace } from '@components/caregiver/care-workspace';
import { ThemedText } from '@components/themed-text';
import { SmaranButton } from '@components/ui/smaran-button';
import { SmaranCard } from '@components/ui/smaran-card';
import { PageLayout } from '@constants/layout';
import { useThemeColors } from '@/hooks/use-theme-color';
import { t, type TranslationKey } from '@i18n/index';
import { CareScopes, effectiveScopes } from '@/src/caregiver/care-circle';
import { reportSections } from '@/src/caregiver/report-presentation';
import { parseReportFacts, type ActivityReport } from '@/src/caregiver/reports';
import { careCircleRepository as repo } from '@/src/db/repositories/care-circle.repository';
import type { ActiveCare } from '@/src/services/care-circle.service';
import { generateActivityReport } from '@/src/services/reports.service';
import { cleanupReportPdfs, prepareReportPdf, removeReportPdf, ReportPdfUnavailable, ReportEmailUnavailable } from '@/src/services/report-pdf.service';

export function ReportsPanel({data}: {data: ActiveCare}) {
  const colors = useThemeColors();
  const language = data.settings.language, label = (key:TranslationKey)=>t(language,key);
  const [days,setDays] = useState<7|30>(7), [reports,setReports] = useState(data.reports);
  const [selected,setSelected] = useState<ActivityReport|null>(null), [audience,setAudience] = useState<string|undefined>();
  const [recipients,setRecipients] = useState(data.recipients);
  const [recipient,setRecipient] = useState<string|null>(data.recipients[0]?.care_member_id ?? null);
  const [frequency,setFrequency] = useState<'weekly'|'monthly'>(data.recipients[0]?.frequency === 'monthly' ? 'monthly' : 'weekly');
  const [consent,setConsent] = useState(false);
  const [message,setMessage] = useState<TranslationKey|null>(null), [busy,setBusy] = useState(false);
  const lock = useRef(false), artifact = useRef<string|null>(null), live = useRef(true);
  useEffect(()=>{
    live.current=true;
    try { cleanupReportPdfs(); } catch {setMessage('reportFailed');}
    return ()=>{live.current=false;if(artifact.current) {try {removeReportPdf(artifact.current);} catch {/* Expired cache is retried on the next report visit. */}}};
  },[]);
  const current = ()=>live.current && data.current();
  const clearPdf = ()=>{if(artifact.current) {removeReportPdf(artifact.current);artifact.current=null;} setMessage(null);};
  const run = async(work:()=>Promise<void>)=>{
    if(lock.current || !current())return;
    lock.current=true;setBusy(true);setMessage(null);
    try {clearPdf();await work();} catch(error) {if(current())setMessage(error instanceof ReportEmailUnavailable?'reportEmailUnavailable':error instanceof ReportPdfUnavailable?'reportUnavailable':'reportFailed');}
    finally {lock.current=false;if(current())setBusy(false);}
  };
  const member = audience ? data.members.find(m=>m.id===audience) : null;
  const scopes = member ? effectiveScopes(member) : CareScopes;
  const canReport = !audience || !!member && scopes.includes('reports');
  const eligible = data.members.filter(m=>m.status==='local' && effectiveScopes(m).includes('reports'));
  const pdf = (share:boolean,email=false)=>void run(async()=>{
    if(!selected)return;
    const uri = await prepareReportPdf(data.patient.id,selected.id,language,current,audience,share,email);
    if(!current()){if(uri)removeReportPdf(uri);return;}
    artifact.current=uri;
    setMessage(email?'reportEmailOpened':share?'reportShareRequested':'reportPdfReady');
    if(share||email){
      const rows=await repo.reports(data.patient.id);
      if(current()){setSelected({...selected,delivery_state:'share_requested'});setReports(rows);}
    }
  });
  return <>
    <ThemedText>{label('circleLocalNotice')}</ThemedText>
    <View style={{flexDirection:'row',flexWrap:'wrap',gap:12}}>{([7,30] as const).map(d=><SmaranButton key={d} label={label(d===7?'analytics7':'analytics30')}
      accessibilityLabel={label(d===7?'analytics7':'analytics30')} variant={days===d?'primary':'outline'} disabled={busy} accessibilityState={{selected:days===d}} onPress={()=>setDays(d)} />)}</View>
    <SmaranButton label={label('reportGenerate')} accessibilityLabel={label('reportGenerate')} disabled={busy} loading={busy} onPress={()=>void run(async()=>{
      const report=await generateActivityReport(data.patient.id,days,current);
      if(current()){setReports(rows=>[report,...rows]);setSelected(report);setAudience(undefined);}
    })} />
    {message && <ThemedText accessibilityRole="alert">{label(message)}</ThemedText>}
    {selected && <SmaranCard style={PageLayout.group}>
      <ThemedText type="cardHeading">{label('reportAudience')}</ThemedText>
      <SmaranButton label={label('reportOwner')} accessibilityLabel={label('reportOwner')} variant="outline" disabled={busy} accessibilityState={{selected:!audience}}
        onPress={()=>{try{clearPdf();setAudience(undefined);}catch{setMessage('reportFailed');}}} />
      {eligible.map(m=><SmaranButton key={m.id} label={m.display_name} accessibilityLabel={m.display_name} variant="outline" disabled={busy} accessibilityState={{selected:audience===m.id}}
        onPress={()=>{try{clearPdf();setAudience(m.id);}catch{setMessage('reportFailed');}}} />)}
      {canReport ? reportSections(selected,language,scopes).map((section,i)=><View key={i} style={[PageLayout.group, { padding: 16, borderRadius: 14, backgroundColor: colors.surfaceMuted }]}>
        <ThemedText type="cardHeading" accessibilityRole="header">{section.title}</ThemedText>
        {section.lines.map((line,j)=><ThemedText key={j}>{line}</ThemedText>)}
      </View>) : <ThemedText>{label('reportNoAccess')}</ThemedText>}
      <ThemedText>{label(selected.delivery_state==='generated'?'reportGenerated':'reportShareRequested')}</ThemedText>
      <ThemedText>{label('reportShareNotice')}</ThemedText>
      <SmaranButton label={label('reportPdf')} accessibilityLabel={label('reportPdf')} disabled={busy||!canReport} onPress={()=>pdf(false)} />
      <SmaranButton label={label('reportShare')} accessibilityLabel={label('reportShare')} variant="outline" disabled={busy||!canReport} onPress={()=>pdf(true)} />
      <SmaranButton label={label('reportEmail')} accessibilityLabel={label('reportEmail')} variant="outline" disabled={busy||!canReport||!member?.email} onPress={()=>pdf(false,true)} />
      {!member?.email && <ThemedText type="secondary">{label('reportRecipient')}: {label('circleEmail')}</ThemedText>}
    </SmaranCard>}
    <ThemedText type="cardHeading" accessibilityRole="header">{label('reportTitle')}</ThemedText>
    {!reports.length && <ThemedText>{label('reportEmpty')}</ThemedText>}
    {reports.map(report=><SmaranButton key={report.id} label={`${label('reportSummary')} · ${new Date(report.generated_at).toLocaleString(language)}`}
      accessibilityLabel={`${label('reportSummary')} · ${new Date(report.generated_at).toLocaleString(language)}`} variant="outline" disabled={busy}
      onPress={()=>{try{clearPdf();setSelected(report);setAudience(undefined);}catch{setMessage('reportFailed');}}} />)}
    <SmaranCard style={PageLayout.group}>
      <ThemedText type="cardHeading" accessibilityRole="header">WhatsApp Delivery</ThemedText>
      <ThemedText>{label('reportConsentText')}</ThemedText>
      <ThemedText type="action">Report Recipients</ThemedText>
      {recipients.map(r=><SmaranButton key={r.id} label={`${data.members.find(m=>m.id===r.care_member_id)?.display_name ?? 'Unknown'} · ${r.normalized_destination} (${r.frequency}, ${r.consent_status})`} accessibilityLabel={`Recipient ${r.normalized_destination}`} variant="outline" disabled={busy} onPress={()=>{setRecipient(r.care_member_id);setFrequency(r.frequency==='manual'?'weekly':r.frequency);setConsent(r.consent_status==='enabled');}} />)}
      <ThemedText type="action">Add / Update Recipient</ThemedText>
      {eligible.map(m=><SmaranButton key={m.id} label={`${m.display_name} · ${m.phone || 'No phone'}`} accessibilityLabel={`${m.display_name}`}
        variant="outline" disabled={busy} accessibilityState={{selected:recipient===m.id}} onPress={()=>{setRecipient(m.id);setConsent(false);}} />)}
      {(['weekly','monthly'] as const).map(f=><SmaranButton key={f} label={label(f==='weekly'?'reportWeekly':'reportMonthly')} accessibilityLabel={label(f==='weekly'?'reportWeekly':'reportMonthly')}
        variant="outline" disabled={busy} accessibilityState={{selected:frequency===f}} onPress={()=>{setFrequency(f);setConsent(false);}} />)}
      <ThemedText>{label('reportConsentText')}</ThemedText>
      <SmaranButton label={label('reportConsent')} accessibilityLabel={label('reportConsentText')} variant="outline" disabled={busy||!recipient}
        accessibilityState={{selected:consent}} onPress={()=>setConsent(v=>!v)} />
      <SmaranButton label={label('circleSave')} accessibilityLabel={label('circleSave')} disabled={busy||!recipient} onPress={()=>void run(async()=>{
        if(!recipient)return;
        const member = data.members.find(m=>m.id===recipient);
        if(!member||!member.phone){setMessage('reportFailed');return;}
        await repo.saveRecipient(data.patient.id,recipient,member.phone,frequency,consent,current,
          recipients.find(r=>r.care_member_id===recipient)?.id);
        const rows = await repo.recipients(data.patient.id);
        if(current()){setRecipients(rows);setMessage('reportConsentSaved');}
      })} />
    </SmaranCard>
    {selected && recipients.filter(r=>r.consent_status==='enabled').length > 0 && <SmaranCard style={PageLayout.group}>
      <ThemedText type="cardHeading" accessibilityRole="header">Send Report via WhatsApp</ThemedText>
      <ThemedText>{label('reportDisclaimer')}</ThemedText>
      {recipients.filter(r=>r.consent_status==='enabled').map(r=><SmaranButton key={r.id} label={`Send to ${r.normalized_destination}`} accessibilityLabel={`Send to ${r.normalized_destination}`} disabled={busy} onPress={()=>void run(async()=>{
        await repo.queueDelivery(data.patient.id,r.id,parseReportFacts(selected.snapshot).days===7?'7-day':'30-day',selected.period_start,selected.period_end,selected.id,current);
        if(current()) setMessage('reportShareRequested');
      })} />)}
    </SmaranCard>}
  </>;
}
export default function ReportsScreen() {
  return <CareWorkspace title="reportTitle">{data=><ReportsPanel data={data} />}</CareWorkspace>;
}
