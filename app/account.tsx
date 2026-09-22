import { useEffect, useRef, useState } from 'react';
import { Platform, View } from 'react-native';
import { useRouter } from 'expo-router';
import { ScreenWrapper } from '@components/layout/screen-wrapper';
import { ThemedText } from '@components/themed-text';
import { SmaranButton } from '@components/ui/smaran-button';
import { SmaranCard } from '@components/ui/smaran-card';
import { Field } from '@components/ui/smaran-field';
import { PageLayout } from '@constants/layout';
import { t, type TranslationKey } from '@i18n/index';
import { useOnboardingStore } from '@/src/stores/onboarding.store';
import { accessEmail, accessGoogle, initializeAuth, logout, retryAuth, useAuthStore } from '@/src/cloud/auth';
import { AccountError, cloudConfig } from '@/src/cloud/config';
import { enableCloudSync, pauseCloudSync, refreshSyncStatus, syncNow, useSyncStore } from '@/src/cloud/sync';
import { enterAdmin, exitAdmin, useAdminStore } from '@/src/services/admin.service';

export default function AccountScreen() {
  const router = useRouter();
  const language = useOnboardingStore(s => s.language) ?? 'en';
  const auth = useAuthStore();
  const admin = useAdminStore();
  const sync = useSyncStore();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [creating, setCreating] = useState(false);
  const [message, setMessage] = useState<TranslationKey | null>(null);
  const [busy, setBusy] = useState(false);
  const locked = useRef(false);
  useEffect(() => { void initializeAuth(); void refreshSyncStatus().catch(() => {}); }, []);
  const operation = useRef(0);
  useEffect(() => { operation.current++; setEmail(''); setPassword(''); setMessage(null); setBusy(false); locked.current = false; }, [auth.ownerId]);
  useEffect(() => () => { operation.current++; }, []);
  const available = !!cloudConfig && Platform.OS !== 'web';
  const disabled = busy || auth.busy || auth.status === 'restoring';
  const run = async (work: () => Promise<unknown>) => {
    if (locked.current) return;
    locked.current = true; setBusy(true); setMessage(null);
    const request = ++operation.current;
    try {
      const result = await work();
      if (request !== operation.current) return;
      if (result === 'check-email') setMessage('accountCheckEmail');
      if (result === 'cancelled') setMessage('accountCancelled');
      if (result === 'local-offline') setMessage('accountOfflineLogout');
    } catch (error) { if (request === operation.current) setMessage(error instanceof AccountError ? error.key : 'accountFailure'); }
    finally { if (request === operation.current) { setPassword(''); locked.current = false; setBusy(false); } }
  };
  const action = (key: TranslationKey, work: () => Promise<unknown>, variant: 'primary' | 'outline' = 'primary') =>
    <SmaranButton key={key} label={t(language, key)} accessibilityLabel={t(language, key)} disabled={disabled}
      variant={variant} onPress={() => void run(work)} />;
  const statusKey: TranslationKey = auth.status === 'storage-error' ? 'accountStorage' : auth.status === 'restoring' ? 'accountRestoring' :
    auth.busy ? 'accountWorking' : auth.status === 'expired' ? 'accountSessionExpired' : auth.status === 'confirmation' ? 'accountConfirmEmail' :
      auth.status === 'offline' ? 'accountNetwork' : auth.status === 'unavailable' ? 'accountUnavailable' : !auth.ownerId ? 'accountLocalStatus'
    : ({ local: 'accountLocalStatus', paused: 'accountPaused', 'signed-in': 'accountSignedIn', offline: 'accountOffline', syncing: 'accountSyncing', current: 'accountCurrent', waiting: 'accountPending', attention: 'accountAttention' } as const)[sync.status];
  return <ScreenWrapper scroll><View style={PageLayout.content}>
    <ThemedText type="screenTitle">{t(language, 'accountTitle')}</ThemedText>
    <ThemedText>{t(language, 'accountIntro')}</ThemedText>
    <SmaranButton variant="outline" label={t(language, auth.ownerId ? 'back' : 'accountLocal')} accessibilityLabel={t(language, auth.ownerId ? 'back' : 'accountLocal')}
      onPress={() => { setPassword(''); if (router.canGoBack()) router.back(); else router.replace('/'); }} />
    {!available && <ThemedText accessibilityRole="alert">{t(language, cloudConfig ? 'accountNative' : 'accountMissing')}</ThemedText>}
    <SmaranCard><ThemedText accessibilityLiveRegion="polite" type="cardHeading">{t(language, statusKey, { count: String(sync.pending) })}</ThemedText>
      {auth.email && <ThemedText>{t(language, 'accountSignedIn')}: {auth.email}</ThemedText>}
      {!auth.ownerId && <ThemedText>{t(language, 'accountSignInToSync')}</ThemedText>}
      {auth.ownerId && <>
        <ThemedText>{t(language, 'accountPending', { count: String(sync.pending) })}</ThemedText>
        <ThemedText>{t(language, 'accountLast', { time: sync.lastSuccess ? new Date(sync.lastSuccess).toLocaleString() : t(language, 'accountNever') })}</ThemedText>
      </>}
    </SmaranCard>
    {auth.status === 'storage-error' ? <>
      <ThemedText accessibilityRole="alert">{t(language, 'accountStorage')}</ThemedText>
      {action('retry', retryAuth)}
    </> : !auth.ownerId ? <>
      <Field label={t(language, 'accountEmail')} value={email} onChangeText={setEmail} keyboardType="email-address" autoCapitalize="none"
        autoComplete="email" textContentType="emailAddress" importantForAutofill="yes" editable={available && !disabled} maxLength={254} />
      <Field label={t(language, 'accountPassword')} value={password} onChangeText={setPassword} secureTextEntry autoCapitalize="none"
        autoComplete={creating ? 'new-password' : 'current-password'} textContentType={creating ? 'newPassword' : 'password'} importantForAutofill="yes"
        editable={available && !disabled} maxLength={128} onSubmitEditing={() => { if (available) void run(() => accessEmail(email, password, creating)); }} />
      <SmaranButton label={t(language, creating ? 'accountCreate' : 'accountSignIn')} accessibilityLabel={t(language, creating ? 'accountCreate' : 'accountSignIn')}
        disabled={!available || disabled} onPress={() => void run(() => accessEmail(email, password, creating))} />
      <SmaranButton label={t(language, creating ? 'accountSignIn' : 'accountCreate')} accessibilityLabel={t(language, creating ? 'accountSignIn' : 'accountCreate')}
        disabled={!available || disabled} variant="outline" onPress={() => { setCreating(!creating); setMessage(null); }} />
      <SmaranButton label={t(language, 'accountGoogle')} accessibilityLabel={t(language, 'accountGoogle')} disabled={!available || disabled}
        variant="outline" onPress={() => void run(accessGoogle)} />
    </> : <>
      <ThemedText>{t(language, 'accountConsent')}</ThemedText>
      {sync.linked ? action('accountSyncNow', () => syncNow(true)) : action('accountEnable', enableCloudSync)}
      {sync.linked && sync.unlinked > 0 && action('accountAddProfiles', enableCloudSync, 'outline')}
      {sync.linked && action('accountPause', pauseCloudSync, 'outline')}
      {action('accountLogout', logout, 'outline')}
      <SmaranButton label={admin.mode === 'admin' ? 'Exit admin mode' : 'Admin'} accessibilityLabel={admin.mode === 'admin' ? 'Exit admin mode' : 'Admin'} variant="outline" disabled={disabled}
        onPress={() => { if (admin.mode === 'admin') exitAdmin(); else void run(async () => { if (await enterAdmin()) router.push('/admin'); else throw new Error('Admin authorization required.'); }); }} />
    </>}
    {(message || auth.message) && <ThemedText accessibilityRole="alert" accessibilityLiveRegion="polite">{t(language, message ?? auth.message!)}</ThemedText>}
    <ThemedText type="secondary">{t(language, 'accountMedia')}</ThemedText>
  </View></ScreenWrapper>;
}
