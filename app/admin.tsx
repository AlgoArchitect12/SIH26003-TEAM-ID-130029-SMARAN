import { Redirect, useRouter } from 'expo-router';
import { useRef, useState } from 'react';
import { View } from 'react-native';
import { ScreenWrapper } from '@components/layout/screen-wrapper';
import { ThemedText } from '@components/themed-text';
import { SmaranButton } from '@components/ui/smaran-button';
import { SmaranCard } from '@components/ui/smaran-card';
import { PageLayout } from '@constants/layout';
import { t } from '@i18n/index';
import { reportSections } from '@/src/caregiver/report-presentation';
import { CareScopes } from '@/src/caregiver/care-circle';
import { useOnboardingStore } from '@/src/stores/onboarding.store';
import { useAuthStore } from '@/src/cloud/auth';
import { enterAdmin, exitAdmin, manageAdminPatient, useAdminStore } from '@/src/services/admin.service';

export default function AdminScreen() {
  const router = useRouter(), admin = useAdminStore(), auth = useAuthStore();
  const language = useOnboardingStore(s => s.language) ?? 'en';
  const [failed, setFailed] = useState(false), [busy, setBusy] = useState(false);
  const locked = useRef(false);
  if (auth.status !== 'signed-in' || admin.mode === 'normal' || (admin.mode === 'admin' && admin.ownerId !== auth.ownerId)) return <Redirect href="/account" />;
  return <ScreenWrapper scroll><View style={PageLayout.content}>
    <ThemedText type="screenTitle">Admin</ThemedText>
    <ThemedText>{auth.email}</ThemedText>
    <SmaranButton label={t(language, 'back')} accessibilityLabel="Exit admin mode" onPress={() => { exitAdmin(); router.replace('/account'); }} />
    <SmaranButton label={t(language, 'retry')} accessibilityLabel={t(language, 'retry')} disabled={busy || admin.mode === 'authenticating'} variant="outline" onPress={() => void enterAdmin()} />
    {failed && <ThemedText accessibilityRole="alert">{t(language, 'accountFailure')}</ThemedText>}
    {admin.mode === 'authenticating' && <ThemedText>{t(language, 'accountWorking')}</ThemedText>}
    {admin.mode === 'admin' && !admin.patients.length && <ThemedText>{t(language, 'reportEmpty')} · {t(language, 'accountEnable')}</ThemedText>}
    {admin.patients.map(row => <SmaranCard key={row.patient.id} style={PageLayout.group}>
      <ThemedText type="cardHeading">{row.patient.preferred_name}</ThemedText>
      <SmaranButton label={t(language, 'circleOverview')} accessibilityLabel={t(language, 'circleOverview')} disabled={busy} onPress={() => {
        if (locked.current) return; locked.current = true; setBusy(true); setFailed(false);
        void manageAdminPatient(row.patient.id).then(() => router.push('/caregiver/home')).catch(() => setFailed(true)).finally(() => { locked.current = false; setBusy(false); });
      }} />
      <ThemedText type="cardHeading">{t(language, 'reportTitle')}</ThemedText>
      {!row.reports.length && <ThemedText>{t(language, 'reportEmpty')}</ThemedText>}
      {row.reports.map(report => <View key={report.id} style={PageLayout.group}>
        {reportSections(report, language, CareScopes).map((section, index) => <View key={index}><ThemedText type="cardHeading">{section.title}</ThemedText>
          {section.lines.map((line, i) => <ThemedText key={i}>{line}</ThemedText>)}</View>)}
      </View>)}
    </SmaranCard>)}
  </View></ScreenWrapper>;
}
