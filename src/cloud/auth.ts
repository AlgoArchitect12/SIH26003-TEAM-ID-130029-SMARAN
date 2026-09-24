import 'react-native-url-polyfill/auto';
import { createClient, type SupabaseClient, type Session } from '@supabase/supabase-js';
import { AppState, Platform } from 'react-native';
import * as WebBrowser from 'expo-web-browser';
import * as Linking from 'expo-linking';
import { create } from 'zustand';
import { AccountError, AUTH_STORAGE_KEY, cloudConfig, oauthCode, OAUTH_REDIRECT } from './config';
import { restoreSessionStorage } from './auth-storage';
import { preparePKCE } from './native-crypto';

type AuthStatus = 'unconfigured' | 'local' | 'restoring' | 'signed-in' | 'offline' | 'storage-error' | 'error' | 'expired' | 'confirmation' | 'unavailable';
export const useAuthStore = create<{
  ownerId: string | null; email: string | null; revision: number; status: AuthStatus; busy: boolean;
  message: AccountError['key'] | null;
}>(() => ({ ownerId: null, email: null, revision: 0, status: cloudConfig ? 'local' : 'unconfigured', busy: false, message: null }));

let client: SupabaseClient | null = null;
let storage: Awaited<ReturnType<typeof restoreSessionStorage>> | null = null;
let unsubscribe: (() => void) | null = null;
let initialized: Promise<void> | null = null;
let signingOut = false;
let logoutPending = false;
let callbackWork: Promise<void> | null = null;
let completedCallback: string | null = null;
let pendingCallback: string | null = null;
let restoring = false;
let validation: Promise<void> | null = null;
let authOperation = 0;
let sessionExpiry: ReturnType<typeof setTimeout> | undefined;
const requests = new Set<AbortController>();
let accountAbort = new AbortController();

export function invalidateCloudWork() {
  accountAbort.abort(); accountAbort = new AbortController();
  for (const request of requests) request.abort();
  useAuthStore.setState(state => ({ revision: state.revision + 1 }));
}
function storageFailed() {
  invalidateCloudWork();
  useAuthStore.setState({ status: 'storage-error', message: 'accountStorage' });
  void client?.auth.stopAutoRefresh();
}
function acceptSession(session: Session | null) {
  if (restoring || signingOut || logoutPending || useAuthStore.getState().status === 'storage-error') return;
  clearTimeout(sessionExpiry);
  if (session?.expires_at) {
    const remaining = session.expires_at * 1000 - Date.now();
    if (remaining <= 0) { sessionExpired(); return; }
    sessionExpiry = setTimeout(() => sessionExpired(), remaining);
    // Node regression harnesses must not stay alive solely for this native lifecycle timer.
    (sessionExpiry as unknown as { unref?: () => void }).unref?.();
  }
  const ownerId = session?.user.id ?? null;
  if (useAuthStore.getState().ownerId !== ownerId) invalidateCloudWork();
  useAuthStore.setState({ ownerId, email: session?.user.email ?? null, status: session ? 'signed-in' : 'local', message: null });
}
export function captureAccount() {
  const { ownerId, revision, status } = useAuthStore.getState();
  const signal = accountAbort.signal;
  return { ownerId, signal, current: () => {
    const now = useAuthStore.getState();
    return !!ownerId && status === 'signed-in' && !signingOut && !logoutPending && !signal.aborted && now.status === 'signed-in' &&
      now.ownerId === ownerId && now.revision === revision;
  } };
}

async function boundedFetch(input: RequestInfo | URL, init?: RequestInit) {
  const request = new AbortController();
  const revision = useAuthStore.getState().revision;
  const external = init?.signal;
  const abort = () => request.abort();
  if (external?.aborted) request.abort();
  external?.addEventListener('abort', abort);
  requests.add(request);
  const timer = setTimeout(abort, 15000);
  try {
    const response = await fetch(input, { ...init, signal: request.signal });
    const body = await response.text();
    if (new TextEncoder().encode(body).length > 2097152) throw new Error('Account response is too large.');
    if (request.signal.aborted || revision !== useAuthStore.getState().revision) throw new Error('Account request expired.');
    return new Response(body || null, { status: response.status, statusText: response.statusText, headers: response.headers });
  } catch (error) {
    if (error instanceof TypeError || request.signal.aborted) throw new AccountError('accountNetwork');
    throw error;
  } finally { clearTimeout(timer); requests.delete(request); external?.removeEventListener('abort', abort); }
}

export function getCloudClient() {
  if (!cloudConfig || Platform.OS === 'web') throw new Error('Cloud sync is not configured on this build.');
  if (useAuthStore.getState().status === 'storage-error') throw new Error('Account storage needs attention.');
  if (!client) {
    if (!storage) throw new Error('Restore account storage first.');
    preparePKCE();
    client = createClient(cloudConfig.url, cloudConfig.key, {
      auth: { storage, storageKey: AUTH_STORAGE_KEY, persistSession: true, autoRefreshToken: false,
        detectSessionInUrl: false, flowType: 'pkce' },
      global: { fetch: boundedFetch },
    });
    const { data } = client.auth.onAuthStateChange((event, session) => {
      if (event === 'INITIAL_SESSION') return; // Restored identity is validated below before sync can start.
      const expired = event === 'SIGNED_OUT' && !!useAuthStore.getState().ownerId && !signingOut;
      acceptSession(session);
      if (expired) useAuthStore.setState({ status: 'expired', message: 'accountSessionExpired' });
    });
    unsubscribe = () => data.subscription.unsubscribe();
  }
  return client;
}
function reportAuthError(error: unknown) {
  const failure = error as { name?: string; code?: string; status?: number } | null;
  const messages = { invalid_credentials: 'accountCredentials', email_not_confirmed: 'accountCheckEmail', user_already_exists: 'accountDuplicate',
      email_exists: 'accountDuplicate', weak_password: 'accountWeakPassword', email_address_invalid: 'accountInvalidEmail',
      over_request_rate_limit: 'accountRateLimit', over_email_send_rate_limit: 'accountRateLimit', otp_expired: 'accountExpiredLink',
      flow_state_expired: 'accountExpiredLink', bad_code_verifier: 'accountInvalidLink', flow_state_not_found: 'accountInvalidLink',
      provider_disabled: 'accountGoogleMissing', session_not_found: 'accountSessionExpired', refresh_token_not_found: 'accountSessionExpired',
      refresh_token_already_used: 'accountSessionExpired', bad_jwt: 'accountSessionExpired', user_banned: 'accountSessionExpired',
    } as const;
  const known = failure?.code && Object.hasOwn(messages, failure.code) ? messages[failure.code as keyof typeof messages] : undefined;
  const key = useAuthStore.getState().status === 'storage-error' ? 'accountStorage' : error instanceof AccountError ? error.key : known ??
    (failure?.status === 429 ? 'accountRateLimit' : failure?.status && failure.status >= 500 ? 'accountUnavailable' :
      ['AuthRetryableFetchError', 'AbortError'].includes(failure?.name ?? '') ? 'accountNetwork' :
        failure?.status === 401 || failure?.status === 403 ? 'accountSessionExpired' : 'accountFailure');
  if (key === 'accountSessionExpired') { invalidateCloudWork(); useAuthStore.setState({ ownerId: null, email: null }); void client?.auth.stopAutoRefresh(); }
  useAuthStore.setState({ message: key, status: key === 'accountStorage' ? 'storage-error' : key === 'accountNetwork' ? 'offline' :
    key === 'accountUnavailable' ? 'unavailable' : key === 'accountSessionExpired' ? 'expired' : key === 'accountCheckEmail' ? 'confirmation' :
      useAuthStore.getState().ownerId ? 'signed-in' : 'error' });
  return new AccountError(key);
}
export function sessionExpired() { reportAuthError(new AccountError('accountSessionExpired')); }

export function validateSession() {
  validation ??= (async () => {
    if (!client || signingOut || logoutPending || useAuthStore.getState().status === 'storage-error') return;
    const revision = useAuthStore.getState().revision;
    restoring = true;
    try {
      const { data, error } = await client.auth.getSession();
      if (error) throw error;
      if (data.session) {
        const user = await client.auth.getUser();
        if (user.error) throw user.error;
        if (!user.data.user || user.data.user.id !== data.session.user.id) throw new AccountError('accountSessionExpired');
      }
      if (revision !== useAuthStore.getState().revision) return;
      restoring = false;
      acceptSession(data.session);
    } catch (error) { if (revision === useAuthStore.getState().revision) reportAuthError(error); }
    finally { restoring = false; }
  })().finally(() => { validation = null; });
  return validation;
}
export function initializeAuth() {
  if (!cloudConfig || Platform.OS === 'web') return Promise.resolve();
  initialized ??= (async () => {
    useAuthStore.setState({ status: 'restoring' });
    try {
      storage = await restoreSessionStorage(storageFailed);
      getCloudClient();
      await validateSession();
    } catch (error) { reportAuthError(error); }
    finally {
      if (!logoutPending && !['storage-error', 'expired'].includes(useAuthStore.getState().status) && AppState.currentState === 'active') {
        await client?.auth.startAutoRefresh();
      }
    }
  })();
  return initialized;
}
async function authAction<T>(work: (cloud: SupabaseClient, current: () => boolean) => Promise<T>) {
  if (useAuthStore.getState().busy || signingOut || callbackWork) throw new Error('Account access is already in progress.');
  const operation = ++authOperation;
  const current = () => operation === authOperation && !signingOut && !logoutPending;
  useAuthStore.setState({ busy: true, message: null });
  let revision = useAuthStore.getState().revision;
  try {
    await initializeAuth(); await validation;
    revision = useAuthStore.getState().revision;
    if (!current()) throw new AccountError('accountFailure');
    return await work(getCloudClient(), current);
  } catch (error) {
    if (!current() || (revision !== useAuthStore.getState().revision && useAuthStore.getState().status !== 'storage-error')) throw new AccountError('accountFailure');
    throw reportAuthError(error);
  }
  finally { if (operation === authOperation) useAuthStore.setState({ busy: false }); }
}
export async function accessEmail(email: string, password: string, createAccount = false) {
  return authAction(async (cloud, current) => {
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim()) || email.length > 254) throw new AccountError('accountInvalidEmail');
    if (password.length < (createAccount ? 8 : 1) || password.length > 128) throw new AccountError(createAccount ? 'accountWeakPassword' : 'accountCredentials');
    const emailRedirectTo = createAccount ? await beginCallback('email') : undefined;
    if (!current()) throw new AccountError('accountFailure');
    const { data, error } = createAccount ? await cloud.auth.signUp({ email: email.trim(), password,
      options: { emailRedirectTo } })
      : await cloud.auth.signInWithPassword({ email: email.trim(), password });
    if (!current()) throw new AccountError('accountFailure');
    if (error) throw error;
    if (!data.session && (!createAccount || !data.user?.id)) throw new AccountError('accountFailure');
    acceptSession(data.session);
    if (!data.session) useAuthStore.setState({ status: 'confirmation', message: 'accountCheckEmail' });
    else await storage!.clearCallback(current);
    if (!current()) throw new AccountError('accountFailure');
    return data.session ? 'signed-in' : 'check-email';
  });
}
async function beginCallback(kind: 'email' | 'google') {
  preparePKCE();
  const state = Array.from(crypto.getRandomValues(new Uint8Array(32)), byte => byte.toString(16).padStart(2, '0')).join('');
  await storage!.setItem(`${AUTH_STORAGE_KEY}-callback-state`, JSON.stringify({ state, expires: Date.now() + (kind === 'email' ? 86400000 : 600000) }));
  completedCallback = null;
  return `${OAUTH_REDIRECT}?state=${state}`;
}
export function completeOAuth(url: string) {
  if (url === completedCallback) return Promise.resolve();
  if (callbackWork && pendingCallback !== url) return Promise.reject(new AccountError('accountInvalidLink'));
  pendingCallback = url;
  let callbackRevision = useAuthStore.getState().revision;
  let callbackOperation = authOperation;
  callbackWork ??= (async () => {
    await initializeAuth();
    await validation;
    const cloud = getCloudClient();
    const revision = useAuthStore.getState().revision;
    callbackRevision = revision;
    callbackOperation = authOperation;
    const saved = await storage?.getItem(`${AUTH_STORAGE_KEY}-callback-state`);
    const attempt = saved ? JSON.parse(saved) : null;
    if (!attempt || !/^[a-f0-9]{64}$/.test(attempt.state) || !Number.isFinite(attempt.expires)) throw new AccountError('accountInvalidLink');
    const code = oauthCode(url, attempt.state);
    if (attempt.expires < Date.now()) throw new AccountError('accountExpiredLink');
    if (signingOut || logoutPending || !await storage?.getItem(`${AUTH_STORAGE_KEY}-code-verifier`)) throw new AccountError('accountInvalidLink');
    if (revision !== useAuthStore.getState().revision) throw new Error('Account changed.');
    const { data, error } = await cloud.auth.exchangeCodeForSession(code);
    if (error) throw error;
    if (!data.session || !data.user || useAuthStore.getState().ownerId !== data.user.id || signingOut || logoutPending) throw new AccountError('accountFailure');
    await storage!.clearCallback(() => callbackOperation === authOperation && !signingOut && !logoutPending);
    if (callbackOperation !== authOperation) throw new AccountError('accountFailure');
    completedCallback = url;
  })().catch(error => {
    if (callbackRevision !== useAuthStore.getState().revision && useAuthStore.getState().status !== 'storage-error') throw new AccountError('accountFailure');
    throw reportAuthError(error);
  })
    .finally(() => { callbackWork = null; pendingCallback = null; });
  return callbackWork;
}
export async function accessGoogle() {
  if (!cloudConfig) throw reportAuthError(new AccountError('accountGoogleMissing'));
  return authAction(async (cloud, current) => {
    const settings = await boundedFetch(`${cloudConfig!.url}/auth/v1/settings`, { headers: { apikey: cloudConfig!.key } });
    if (!settings.ok) throw new AccountError(settings.status === 429 ? 'accountRateLimit' : 'accountUnavailable');
    const providers: unknown = await settings.json();
    if (!providers || typeof providers !== 'object' || !('external' in providers) || !providers.external || typeof providers.external !== 'object' ||
      ('google' in providers.external && typeof providers.external.google !== 'boolean')) throw new AccountError('accountUnavailable');
    if (!('google' in providers.external) || !providers.external.google) throw new AccountError('accountGoogleMissing');
    const redirectTo = await beginCallback('google');
    if (!current()) throw new AccountError('accountFailure');
    const { data, error } = await cloud.auth.signInWithOAuth({ provider: 'google',
      options: { redirectTo, skipBrowserRedirect: true } });
    if (error || !data.url) throw error ?? new Error('Google access is unavailable.');
    const authorization = new URL(data.url);
    if (authorization.origin !== cloudConfig?.url || authorization.pathname !== '/auth/v1/authorize' || authorization.username || authorization.password ||
      authorization.searchParams.get('redirect_to') !== redirectTo || authorization.searchParams.get('provider') !== 'google' ||
      !/^[A-Za-z0-9_-]{43}$/.test(authorization.searchParams.get('code_challenge') ?? '') || authorization.searchParams.get('code_challenge_method') !== 's256') {
      throw new Error('Secure Google access is unavailable.');
    }
    const result = await WebBrowser.openAuthSessionAsync(data.url, OAUTH_REDIRECT);
    if (!current()) throw new AccountError('accountFailure');
    if (result.type !== 'success') {
      await storage!.clearCallback(current);
      return 'cancelled';
    }
    await completeOAuth(result.url);
    if (!current()) throw new AccountError('accountFailure');
    return 'signed-in';
  });
}
export async function logout() {
  if (signingOut) return;
  signingOut = true;
  clearTimeout(sessionExpiry);
  authOperation++;
  logoutPending = true;
  completedCallback = null;
  invalidateCloudWork();
  useAuthStore.setState({ busy: true });
  let failed = false;
  try {
    if (!storage) throw new Error('Account storage needs attention.');
    await storage.beginLogout();
    const cloud = client;
    await cloud?.auth.stopAutoRefresh();
    const result = await cloud?.auth.signOut({ scope: 'local' });
    // Current Supabase clears the local session even if remote revocation is unreachable.
    failed = !!result?.error;
    await storage.finishLogout();
    logoutPending = false;
    useAuthStore.setState({ ownerId: null, email: null, status: failed ? 'offline' : 'local', message: null });
  } catch { storageFailed(); throw new Error('Account storage needs attention. Cloud sync is stopped. Retry sign out.'); }
  finally { signingOut = false; useAuthStore.setState({ busy: false }); }
  return failed ? 'local-offline' : 'local';
}
export async function retryAuth() {
  authOperation++;
  invalidateCloudWork(); unsubscribe?.(); storage?.close(); await client?.auth.stopAutoRefresh();
  await validation;
  client = null; storage = null; initialized = null;
  useAuthStore.setState({ status: 'local', ownerId: null, email: null, message: null });
  await initializeAuth();
  if (logoutPending && useAuthStore.getState().status !== 'storage-error') await logout();
}
export function startAuthLifecycle() {
  void initializeAuth();
  const app = AppState.addEventListener('change', state => {
    if (state === 'active' && !logoutPending && !useAuthStore.getState().busy && !['storage-error', 'expired'].includes(useAuthStore.getState().status)) {
      void validateSession(); void client?.auth.startAutoRefresh();
    }
    else void client?.auth.stopAutoRefresh();
  });
  const handle = (url: string) => {
    if (url.startsWith(OAUTH_REDIRECT)) void completeOAuth(url).catch(() => {});
  };
  void Linking.getInitialURL().then(url => { if (url) handle(url); }).catch(() => {});
  const links = Linking.addEventListener('url', event => handle(event.url));
  return () => { app.remove(); links.remove(); void client?.auth.stopAutoRefresh(); };
}
