import 'react-native-url-polyfill/auto';
import { createClient, type SupabaseClient, type Session } from '@supabase/supabase-js';
import { AppState, Platform } from 'react-native';
import * as WebBrowser from 'expo-web-browser';
import * as Linking from 'expo-linking';
import { create } from 'zustand';
import { AUTH_STORAGE_KEY, cloudConfig, oauthCode, OAUTH_REDIRECT } from './config';
import { restoreSessionStorage } from './auth-storage';
import { preparePKCE } from './native-crypto';

type AuthStatus = 'unconfigured' | 'local' | 'restoring' | 'signed-in' | 'offline' | 'storage-error' | 'error';
export const useAuthStore = create<{
  ownerId: string | null; email: string | null; revision: number; status: AuthStatus; busy: boolean;
}>(() => ({ ownerId: null, email: null, revision: 0, status: cloudConfig ? 'local' : 'unconfigured', busy: false }));

let client: SupabaseClient | null = null;
let storage: Awaited<ReturnType<typeof restoreSessionStorage>> | null = null;
let unsubscribe: (() => void) | null = null;
let initialized: Promise<void> | null = null;
let signingOut = false;
let logoutPending = false;
let callbackWork: Promise<void> | null = null;
let completedCallback: string | null = null;
const requests = new Set<AbortController>();
let accountAbort = new AbortController();

function invalidate() {
  accountAbort.abort(); accountAbort = new AbortController();
  for (const request of requests) request.abort();
  useAuthStore.setState(state => ({ revision: state.revision + 1 }));
}
function storageFailed() {
  invalidate();
  useAuthStore.setState({ status: 'storage-error' });
  void client?.auth.stopAutoRefresh();
}
function acceptSession(session: Session | null) {
  if (signingOut || logoutPending || useAuthStore.getState().status === 'storage-error') return;
  const ownerId = session?.user.id ?? null;
  if (useAuthStore.getState().ownerId !== ownerId) invalidate();
  useAuthStore.setState({ ownerId, email: session?.user.email ?? null, status: session ? 'signed-in' : 'local' });
}
export function captureAccount() {
  const { ownerId, revision, status } = useAuthStore.getState();
  const signal = accountAbort.signal;
  return { ownerId, signal, current: () => {
    const now = useAuthStore.getState();
    return !!ownerId && status !== 'storage-error' && !signingOut && !logoutPending && !signal.aborted && now.status !== 'storage-error' &&
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
    const { data } = client.auth.onAuthStateChange((_event, session) => acceptSession(session));
    unsubscribe = () => data.subscription.unsubscribe();
  }
  return client;
}
function reportAuthError(error: unknown) {
  if (useAuthStore.getState().status === 'storage-error') return;
  const name = error && typeof error === 'object' && 'name' in error ? String(error.name) : '';
  useAuthStore.setState({ status: ['AuthRetryableFetchError', 'TypeError', 'AbortError'].includes(name) ? 'offline' : 'error' });
}
export function initializeAuth() {
  if (!cloudConfig || Platform.OS === 'web') return Promise.resolve();
  initialized ??= (async () => {
    useAuthStore.setState({ status: 'restoring' });
    try {
      storage = await restoreSessionStorage(storageFailed);
      const cloud = getCloudClient();
      const { data, error } = await cloud.auth.getSession();
      if (error) throw error;
      acceptSession(data.session);
    } catch (error) { reportAuthError(error); }
    finally {
      if (!logoutPending && useAuthStore.getState().status !== 'storage-error' && AppState.currentState === 'active') {
        await client?.auth.startAutoRefresh();
      }
    }
  })();
  return initialized;
}
async function authAction<T>(work: (cloud: SupabaseClient) => Promise<T>) {
  if (useAuthStore.getState().busy || signingOut) throw new Error('Account access is already in progress.');
  useAuthStore.setState({ busy: true });
  try { await initializeAuth(); return await work(getCloudClient()); }
  catch (error) { reportAuthError(error); throw new Error('Account access could not be completed. Please try again.'); }
  finally { useAuthStore.setState({ busy: false }); }
}
export async function accessEmail(email: string, password: string, createAccount = false) {
  return authAction(async cloud => {
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim()) || email.length > 254 || password.length < (createAccount ? 8 : 1) || password.length > 128) {
      throw new Error('Check your email and password.');
    }
    const { data, error } = createAccount ? await cloud.auth.signUp({ email: email.trim(), password })
      : await cloud.auth.signInWithPassword({ email: email.trim(), password });
    if (error) throw error;
    acceptSession(data.session);
    return data.session ? 'signed-in' : 'check-email';
  });
}
export function completeOAuth(url: string) {
  if (url === completedCallback) return Promise.resolve();
  callbackWork ??= (async () => {
    const code = oauthCode(url);
    await initializeAuth();
    const cloud = getCloudClient();
    const revision = useAuthStore.getState().revision;
    if (signingOut || !await storage?.getItem(`${AUTH_STORAGE_KEY}-code-verifier`)) throw new Error('Start account access again.');
    if (revision !== useAuthStore.getState().revision) throw new Error('Account changed.');
    const { error } = await cloud.auth.exchangeCodeForSession(code);
    if (error) throw error;
    completedCallback = url;
  })().catch(error => { reportAuthError(error); throw new Error('Account access was not completed. Please start again.'); })
    .finally(() => { callbackWork = null; });
  return callbackWork;
}
export async function accessGoogle() {
  return authAction(async cloud => {
    const { data, error } = await cloud.auth.signInWithOAuth({ provider: 'google',
      options: { redirectTo: OAUTH_REDIRECT, skipBrowserRedirect: true } });
    if (error || !data.url) throw error ?? new Error('Google access is unavailable.');
    const authorization = new URL(data.url);
    if (authorization.origin !== cloudConfig?.url || authorization.searchParams.get('code_challenge_method') !== 's256') {
      throw new Error('Secure Google access is unavailable.');
    }
    const result = await WebBrowser.openAuthSessionAsync(data.url, OAUTH_REDIRECT);
    if (result.type !== 'success') {
      await storage?.removeItem(`${AUTH_STORAGE_KEY}-code-verifier`);
      return 'cancelled';
    }
    await completeOAuth(result.url);
    return 'signed-in';
  });
}
export async function logout() {
  if (signingOut) return;
  signingOut = true;
  logoutPending = true;
  completedCallback = null;
  invalidate();
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
    useAuthStore.setState({ ownerId: null, email: null, status: failed ? 'offline' : 'local' });
  } catch { storageFailed(); throw new Error('Account storage needs attention. Cloud sync is stopped. Retry sign out.'); }
  finally { signingOut = false; useAuthStore.setState({ busy: false }); }
  return failed ? 'local-offline' : 'local';
}
export async function retryAuth() {
  invalidate(); unsubscribe?.(); storage?.close(); await client?.auth.stopAutoRefresh();
  client = null; storage = null; initialized = null;
  useAuthStore.setState({ status: 'local' });
  await initializeAuth();
  if (logoutPending && useAuthStore.getState().status !== 'storage-error') await logout();
}
export function startAuthLifecycle() {
  void initializeAuth();
  const app = AppState.addEventListener('change', state => {
    if (state === 'active' && !logoutPending && useAuthStore.getState().status !== 'storage-error') void client?.auth.startAutoRefresh();
    else void client?.auth.stopAutoRefresh();
  });
  const handle = (url: string) => {
    if (url.startsWith(OAUTH_REDIRECT)) void completeOAuth(url).catch(() => {});
  };
  void Linking.getInitialURL().then(url => { if (url) handle(url); }).catch(() => {});
  const links = Linking.addEventListener('url', event => handle(event.url));
  return () => { app.remove(); links.remove(); void client?.auth.stopAutoRefresh(); };
}
