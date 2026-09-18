import { useRef, useState } from 'react';
import { View } from 'react-native';
import { CareWorkspace } from '@components/caregiver/care-workspace';
import { ThemedText } from '@components/themed-text';
import { SmaranButton } from '@components/ui/smaran-button';
import { SmaranCard } from '@components/ui/smaran-card';
import { CareMemberFields, roleKeys, relationshipKeys, scopeKeys } from '@components/caregiver/care-member-fields';
import { PageLayout } from '@constants/layout';
import { t, type TranslationKey } from '@i18n/index';
import { effectiveScopes, type CareMember, type CareMemberInput } from '@/src/caregiver/care-circle';
import { careCircleRepository as repo } from '@/src/db/repositories/care-circle.repository';
import type { ActiveCare } from '@/src/services/care-circle.service';

const empty: CareMemberInput = {display_name:'',relationship:'family_member',access_role:'family',email:'',phone:'',scopes:[]};

export function CirclePanel({data,refresh}: {data: ActiveCare; refresh:()=>void}) {
  const language = data.settings.language;
  const [editing,setEditing] = useState<CareMember|null|undefined>();
  const [value,setValue] = useState<CareMemberInput>(empty), [confirm,setConfirm] = useState<string|null>(null);
  const [busy,setBusy] = useState(false), [failed,setFailed] = useState(false), lock = useRef(false);
  const label = (key:TranslationKey)=>t(language,key);
  const run = async (work:()=>Promise<unknown>)=>{
    if(lock.current || !data.current()) return;
    lock.current=true;setBusy(true);setFailed(false);
    try {await work();if(data.current()) refresh();} catch {if(data.current())setFailed(true);}
    finally {lock.current=false;if(data.current())setBusy(false);}
  };
  const edit = (member:CareMember|null)=>{setEditing(member);setFailed(false);setValue(member ? {...member,scopes:effectiveScopes(member)} : {...empty,scopes:[]});};
  return <>
    <ThemedText>{label('circleLocalNotice')}</ThemedText>
    <ThemedText type="cardHeading" accessibilityRole="header">{label('circleTrusted')}</ThemedText>
    {failed && <ThemedText accessibilityRole="alert">{label('circleFailed')}</ThemedText>}
    {editing !== undefined ? <SmaranCard style={PageLayout.group}>
      <ThemedText type="cardHeading">{label(editing ? 'circleEdit':'circleAdd')}</ThemedText>
      <CareMemberFields language={language} value={value} onChange={setValue} busy={busy} />
      <SmaranButton label={label('circleSave')} accessibilityLabel={label('circleSave')} disabled={busy} loading={busy}
        onPress={()=>void run(()=>repo.save(data.patient.id,value,data.current,editing?.id))} />
      <SmaranButton label={label('circleCancel')} accessibilityLabel={label('circleCancel')} variant="outline" disabled={busy} onPress={()=>setEditing(undefined)} />
    </SmaranCard> : <SmaranButton label={label('circleAdd')} accessibilityLabel={label('circleAdd')} disabled={busy} onPress={()=>edit(null)} />}
    {!data.members.length && <ThemedText>{label('circleEmpty')}</ThemedText>}
    {data.members.map(member=><SmaranCard key={member.id} style={PageLayout.group}>
      <ThemedText type="cardHeading">{member.display_name}</ThemedText>
      <ThemedText>{Object.hasOwn(relationshipKeys,member.relationship) ? label(relationshipKeys[member.relationship as keyof typeof relationshipKeys]) : member.relationship} · {label(roleKeys[member.access_role])}</ThemedText>
      <ThemedText>{label(member.status==='local'?'circleLocal':'circleRevoked')}</ThemedText>
      {!!member.email && <ThemedText>{member.email}</ThemedText>}{!!member.phone && <ThemedText>{member.phone}</ThemedText>}
      <ThemedText>{label('circleAccess')}: {effectiveScopes(member).map(s=>label(scopeKeys[s])).join(', ') || label('circleNone')}</ThemedText>
      {member.status==='local' && <>
        <SmaranButton label={label('circleEdit')} accessibilityLabel={`${label('circleEdit')}: ${member.display_name}`} variant="outline" disabled={busy} onPress={()=>edit(member)} />
        {confirm===member.id ? <View style={PageLayout.group}><ThemedText accessibilityRole="alert">{label('circleConfirm')}</ThemedText>
          <SmaranButton label={label('circleRevoke')} accessibilityLabel={`${label('circleRevoke')}: ${member.display_name}`} disabled={busy} onPress={()=>void run(()=>repo.revoke(data.patient.id,member.id,data.current))} />
          <SmaranButton label={label('circleCancel')} accessibilityLabel={label('circleCancel')} variant="outline" disabled={busy} onPress={()=>setConfirm(null)} />
        </View> : <SmaranButton label={label('circleRevoke')} accessibilityLabel={`${label('circleRevoke')}: ${member.display_name}`} variant="outline" disabled={busy} onPress={()=>setConfirm(member.id)} />}
      </>}
    </SmaranCard>)}
  </>;
}
export default function CareCircleScreen() {
  return <CareWorkspace title="circleTitle">{(data,refresh)=><CirclePanel data={data} refresh={refresh} />}</CareWorkspace>;
}
