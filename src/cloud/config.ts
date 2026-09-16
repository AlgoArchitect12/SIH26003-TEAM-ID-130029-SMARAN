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

export class AccountError extends Error {
  constructor(public readonly key: 'accountInvalidEmail' | 'accountWeakPassword' | 'accountCredentials' | 'accountDuplicate' |
    'accountCheckEmail' | 'accountRateLimit' | 'accountExpiredLink' | 'accountInvalidLink' | 'accountGoogleMissing' |
    'accountNetwork' | 'accountUnavailable' | 'accountSessionExpired' | 'accountFailure' | 'accountStorage') {
    super(key);
  }
}

export function oauthCode(url: string, state?: string) {
  if (url.length > 4096 || url.split(/[?#]/, 1)[0] !== OAUTH_REDIRECT) throw new AccountError('accountInvalidLink');
  let parsed: URL;
  try { parsed = new URL(url); } catch { throw new AccountError('accountInvalidLink'); }
  if (`${parsed.protocol}//${parsed.host}${parsed.pathname}` !== OAUTH_REDIRECT || parsed.username || parsed.password ||
      (state !== undefined && parsed.searchParams.get('state') !== state) ||
      [...parsed.searchParams.keys()].some(key => !['code', 'state', 'error', 'error_code', 'error_description'].includes(key)) ||
      [...parsed.searchParams.keys()].some(key => parsed.searchParams.getAll(key).length !== 1)) {
    throw new AccountError('accountInvalidLink');
  }
  // Supabase may return verification errors in the fragment. Never accept fragment tokens.
  const fragment = new URLSearchParams(parsed.hash.slice(1));
  if (parsed.hash && (!fragment.has('error') || [...fragment.keys()].some(key =>
    !['error', 'error_code', 'error_description'].includes(key) || fragment.getAll(key).length !== 1))) throw new AccountError('accountInvalidLink');
  if (parsed.searchParams.has('error') || fragment.has('error')) {
    const code = parsed.searchParams.get('error_code') ?? fragment.get('error_code');
    throw new AccountError(code === 'otp_expired' || code === 'flow_state_expired' ? 'accountExpiredLink' : 'accountInvalidLink');
  }
  if (parsed.hash || parsed.searchParams.has('error_code') || parsed.searchParams.has('error_description')) throw new AccountError('accountInvalidLink');
  const codes = parsed.searchParams.getAll('code');
  if (codes.length !== 1 || !/^[A-Za-z0-9_-]{8,2048}$/.test(codes[0])) throw new AccountError('accountInvalidLink');
  return codes[0];
}
