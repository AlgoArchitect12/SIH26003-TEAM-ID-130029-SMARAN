export function readCloudConfig(url?: string, key?: string) {
  if (!url || !key) return null;
  try {
    const parsed = new URL(url);
    // Only the modern public key contract is supported; reject private keys by construction.
    if (parsed.protocol !== 'https:' || parsed.username || parsed.password || parsed.search || parsed.hash ||
        parsed.pathname !== '/' || !/^sb_publishable_[A-Za-z0-9_-]+$/.test(key)) return null;
    return { url: parsed.origin, key };
  } catch { return null; }
}

export const cloudConfig = readCloudConfig(
  process.env.EXPO_PUBLIC_SUPABASE_URL,
  process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY
);
export const AUTH_STORAGE_KEY = 'smaran.cloud.session';
export const OAUTH_REDIRECT = 'smaran-ai://auth/callback';

export function oauthCode(url: string) {
  const parsed = new URL(url);
  if (`${parsed.protocol}//${parsed.host}${parsed.pathname}` !== OAUTH_REDIRECT || parsed.username || parsed.password ||
      parsed.hash || parsed.searchParams.has('access_token') || parsed.searchParams.has('refresh_token') ||
      [...parsed.searchParams.keys()].some(key => !['code', 'error', 'error_code', 'error_description'].includes(key))) {
    throw new Error('Invalid account callback.');
  }
  if (parsed.searchParams.has('error')) throw new Error('Account access was not completed.');
  const codes = parsed.searchParams.getAll('code');
  if (codes.length !== 1 || !/^[A-Za-z0-9_-]{8,2048}$/.test(codes[0])) throw new Error('Invalid account callback.');
  return codes[0];
}
