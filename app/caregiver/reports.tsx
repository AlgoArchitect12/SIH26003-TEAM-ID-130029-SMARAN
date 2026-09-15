import { useEffect, useRef, useState } from 'react';
import { View } from 'react-native';
import { CareWorkspace } from '@components/caregiver/care-workspace';
import { ThemedText } from '@components/themed-text';
import { SmaranButton } from '@components/ui/smaran-button';
import { SmaranCard } from '@components/ui/smaran-card';
import { PageLayout } from '@constants/layout';
import { t, type TranslationKey } from '@i18n/index';
import { CareScopes, effectiveScopes } from '@/src/caregiver/care-circle';
import { reportSections } from '@/src/caregiver/report-presentation';
import type { ActivityReport } from '@/src/caregiver/reports';
import { careCircleRepository as repo } from '@/src/db/repositories/care-circle.repository';
import type { ActiveCare } from '@/src/services/care-circle.service';
import { generateActivityReport } from '@/src/services/reports.service';
import { cleanupReportPdfs, prepareReportPdf, removeReportPdf, ReportPdfUnavailable } from '@/src/services/report-pdf.service';

export function ReportsPanel({data}: {data: ActiveCare}) {
  const language = data.settings.language, label = (key:TranslationKey)=>t(language,key);
  const [days,setDays] = useState<7|30>(7), [reports,setReports] = useState(data.reports);
  const [selected,setSelected] = useState<ActivityReport|null>(null), [audience,setAudience] = useState<string|undefined>();
  const [recipient,setRecipient] = useState<string|null>(data.preference?.recipient_id ?? null);
  const [frequency,setFrequency] = useState<'weekly'|'monthly'>(data.preference?.frequency ?? 'weekly');
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
    try {clearPdf();await work();} catch(error) {if(current())setMessage(error instanceof ReportPdfUnavailable?'reportUnavailable':'reportFailed');}
    finally {lock.current=false;if(current())setBusy(false);}
  };
  const member = audience ? data.members.find(m=>m.id===audience) : null;
  const scopes = member ? effectiveScopes(member) : CareScopes;
  const canReport = !audience || !!member && scopes.includes('reports');
  const eligible = data.members.filter(m=>m.status==='local' && effectiveScopes(m).includes('reports'));
  const pdf = (share:boolean)=>void run(async()=>{
    if(!selected)return;
    const uri = await prepareReportPdf(data.patient.id,selected.id,language,current,audience,share);
    if(!current()){if(uri)removeReportPdf(uri);return;}
    artifact.current=uri;
    setMessage(share?'reportShareRequested':'reportPdfReady');
    if(share){
      const rows=await repo.reports(data.patient.id);
      if(current()){setSelected({...selected,delivery_state:'share_requested'});setReports(rows);}
    }
  });
  return <>
    <ThemedText>{label('circleLocalNotice')}</ThemedText>
    <View style={{flexDirection:'row',flexWrap:'wrap',gap:12}}>{([7,30] as const).map(d=><SmaranButton key={d} label={label(d===7?'analytics7':'analytics30')}
      accessibilityLabel={label(d===7?'analytics7':'analytics30')} variant="outline" disabled={busy} accessibilityState={{selected:days===d}} onPress={()=>setDays(d)} />)}</View>
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
      {canReport ? reportSections(selected,language,scopes).map((section,i)=><View key={i} style={PageLayout.group}>
        <ThemedText type="cardHeading" accessibilityRole="header">{section.title}</ThemedText>
        {section.lines.map((line,j)=><ThemedText key={j}>{line}</ThemedText>)}
      </View>) : <ThemedText>{label('reportNoAccess')}</ThemedText>}
      <ThemedText>{label(selected.delivery_state==='generated'?'reportGenerated':'reportShareRequested')}</ThemedText>
      <ThemedText>{label('reportShareNotice')}</ThemedText>
      <SmaranButton label={label('reportPdf')} accessibilityLabel={label('reportPdf')} disabled={busy||!canReport} onPress={()=>pdf(false)} />
      <SmaranButton label={label('reportShare')} accessibilityLabel={label('reportShare')} variant="outline" disabled={busy||!canReport} onPress={()=>pdf(true)} />
    </SmaranCard>}
    <ThemedText type="cardHeading" accessibilityRole="header">{label('reportTitle')}</ThemedText>
    {!reports.length && <ThemedText>{label('reportEmpty')}</ThemedText>}
    {reports.map(report=><SmaranButton key={report.id} label={`${label('reportSummary')} · ${new Date(report.generated_at).toLocaleString(language)}`}
      accessibilityLabel={`${label('reportSummary')} · ${new Date(report.generated_at).toLocaleString(language)}`} variant="outline" disabled={busy}
      onPress={()=>{try{clearPdf();setSelected(report);setAudience(undefined);}catch{setMessage('reportFailed');}}} />)}
    <SmaranCard style={PageLayout.group}>
      <ThemedText type="cardHeading" accessibilityRole="header">{label('reportAutomatic')} · {label('reportNotConfigured')}</ThemedText>
      <ThemedText>{label('reportAutoNotice')}</ThemedText>
      <ThemedText type="action">{label('reportRecipient')}</ThemedText>
      {eligible.filter(m=>m.email).map(m=><SmaranButton key={m.id} label={`${m.display_name} · ${m.email}`} accessibilityLabel={`${m.display_name} · ${m.email}`}
        variant="outline" disabled={busy} accessibilityState={{selected:recipient===m.id}} onPress={()=>{setRecipient(m.id);setConsent(false);}} />)}
      {(['weekly','monthly'] as const).map(f=><SmaranButton key={f} label={label(f==='weekly'?'reportWeekly':'reportMonthly')} accessibilityLabel={label(f==='weekly'?'reportWeekly':'reportMonthly')}
        variant="outline" disabled={busy} accessibilityState={{selected:frequency===f}} onPress={()=>{setFrequency(f);setConsent(false);}} />)}
      <ThemedText>{label('reportConsentText')}</ThemedText>
      <SmaranButton label={label('reportConsent')} accessibilityLabel={label('reportConsentText')} variant="outline" disabled={busy||!recipient}
        accessibilityState={{selected:consent}} onPress={()=>setConsent(v=>!v)} />
      <SmaranButton label={label('circleSave')} accessibilityLabel={label('circleSave')} disabled={busy} onPress={()=>void run(async()=>{
        await repo.savePreference(data.patient.id,recipient,frequency,consent,current);if(current())setMessage('reportConsentSaved');
      })} />
      <SmaranButton label={label('reportManual')} accessibilityLabel={label('reportManual')} variant="outline" disabled={busy} onPress={()=>void run(async()=>{
        await repo.savePreference(data.patient.id,null,frequency,false,current);if(current()){setRecipient(null);setConsent(false);setMessage('reportConsentSaved');}
      })} />
    </SmaranCard>
  </>;
}
export default function ReportsScreen() {
  return <CareWorkspace title="reportTitle">{data=><ReportsPanel data={data} />}</CareWorkspace>;
}
