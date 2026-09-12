import type { Language } from '../db/schema.types';

const en = {
  accountTitle: 'Account & Sync',
  accountIntro: 'An account is optional. You can keep using Smaran and all your local activities without signing in.',
  accountLocal: 'Continue using Smaran locally',
  accountMissing: 'Cloud sync is not configured on this build.',
  accountNative: 'Cloud accounts and sync require the Android or iOS app.',
  accountEmail: 'Email', accountPassword: 'Password', accountSignIn: 'Sign in', accountCreate: 'Create account',
  accountGoogle: 'Continue with Google', accountLogout: 'Logout', accountEnable: 'Enable backup and sync',
  accountConsent: 'Enabling sync backs up structured records for local people who are not linked to another account. Photos and dates of birth stay on this device. Local people remain visible to anyone using this unlocked device.',
  accountSyncNow: 'Sync now', accountLast: 'Last successful sync: {time}', accountNever: 'Not yet',
  accountPending: '{count} changes waiting', accountStorage: 'Account storage needs attention. Cloud sync is stopped. Your local records are still here.',
  accountFailure: 'Account access could not be completed. Check your connection and details, then try again.',
  accountCheckEmail: 'Check your email to confirm your account, then sign in here.', accountCancelled: 'Google sign-in was cancelled.',
  accountOfflineLogout: 'Signed out on this device. The server could not be reached to end the remote session.',
  accountLocalStatus: 'Local only', accountSignedIn: 'Signed in', accountOffline: 'Offline', accountSyncing: 'Syncing',
  accountCurrent: 'Up to date', accountAttention: 'Sync needs attention', accountRestoring: 'Restoring account',
  accountMedia: 'Text and structured records can sync. Personal photos are not backed up.',
} as const;
// New account copy uses explicit English fallback where a reviewed regional translation is not available.
export const accountStrings: Record<Language, Record<keyof typeof en, string>> = {
  en, hi: { ...en, accountTitle: 'खाता और सिंक', accountEmail: 'ईमेल', accountPassword: 'पासवर्ड', accountSignIn: 'साइन इन करें', accountCreate: 'खाता बनाएँ', accountGoogle: 'Google से जारी रखें', accountLogout: 'लॉग आउट', accountLocal: 'स्मरण का स्थानीय उपयोग जारी रखें' },
  as: { ...en, accountTitle: 'একাউণ্ট আৰু ছিংক', accountEmail: 'ইমেইল', accountPassword: 'পাছৱৰ্ড' },
  bn: { ...en, accountTitle: 'অ্যাকাউন্ট ও সিঙ্ক', accountEmail: 'ইমেইল', accountPassword: 'পাসওয়ার্ড' },
  mni: { ...en }, kha: { ...en }, lus: { ...en },
};
