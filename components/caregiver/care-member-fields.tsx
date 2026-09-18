import { View } from 'react-native';
import { Field } from '@components/ui/smaran-field';
import { SmaranButton } from '@components/ui/smaran-button';
import { ThemedText } from '@components/themed-text';
import { t } from '@i18n/index';
import type { Language } from '@db/schema.types';
import { CareRelationships, CareRoles, CareScopes, type CareMemberInput } from '@/src/caregiver/care-circle';

export const roleKeys = {family:'circleFamily',caregiver:'circleCaregiver',healthcare_worker:'circleWorker'} as const;
export const relationshipKeys = {daughter:'circleDaughter',son:'circleSon',spouse:'circleSpouse',family_member:'circleFamily',caregiver:'circleCaregiver',healthcare_worker:'circleWorker'} as const;
export const scopeKeys = {daily_activity:'circleDaily',reminders:'circleReminders',cognitive_activity:'circleCognitive',reports:'reportTitle',memories:'circleMemories'} as const;

export function CareMemberFields({ language, value, onChange, busy = false }: {
  language: Language; value: CareMemberInput; onChange: (value: CareMemberInput) => void; busy?: boolean;
}) {
  const update = (patch: Partial<CareMemberInput>) => onChange({ ...value, ...patch });
  return <>
    <Field label={t(language, 'circleName')} value={value.display_name} maxLength={80} editable={!busy} onChangeText={display_name => update({display_name})} />
    <ThemedText type="action">{t(language, 'circleRelationship')}</ThemedText>
    <View style={{flexDirection:'row',flexWrap:'wrap',gap:12}}>{CareRelationships.map(relationship => <SmaranButton key={relationship}
      label={t(language, relationshipKeys[relationship])} accessibilityLabel={t(language, relationshipKeys[relationship])} variant="outline" disabled={busy}
      accessibilityState={{selected:value.relationship === relationship}} onPress={() => update({relationship})} />)}</View>
    <Field label={t(language, 'circleRelationship')} value={Object.hasOwn(relationshipKeys,value.relationship) ? t(language, relationshipKeys[value.relationship as keyof typeof relationshipKeys]) : value.relationship}
      maxLength={100} editable={!busy} onChangeText={relationship => update({relationship})} />
    <ThemedText type="action">{t(language, 'circleRole')}</ThemedText>
    {CareRoles.map(access_role => <SmaranButton key={access_role} label={t(language, roleKeys[access_role])} accessibilityLabel={t(language, roleKeys[access_role])}
      variant="outline" disabled={busy} accessibilityState={{selected:value.access_role === access_role}} onPress={() => update({access_role})} />)}
    <Field label={t(language, 'circleEmail')} value={value.email ?? ''} keyboardType="email-address" autoCapitalize="none" maxLength={254} editable={!busy} onChangeText={email => update({email})} />
    <Field label={t(language, 'circlePhone')} value={value.phone ?? ''} keyboardType="phone-pad" maxLength={32} editable={!busy} onChangeText={phone => update({phone})} />
    <ThemedText type="action">{t(language, 'circleAccess')}</ThemedText>
    <ThemedText>{t(language, 'circleScopesNotice')}</ThemedText>
    {CareScopes.map(scope => <SmaranButton key={scope} label={t(language, scopeKeys[scope])} accessibilityLabel={t(language, scopeKeys[scope])} variant="outline" disabled={busy}
      accessibilityState={{selected:value.scopes.includes(scope)}} onPress={() => update({scopes:value.scopes.includes(scope) ? value.scopes.filter(s => s !== scope) : [...value.scopes,scope]})} />)}
  </>;
}
