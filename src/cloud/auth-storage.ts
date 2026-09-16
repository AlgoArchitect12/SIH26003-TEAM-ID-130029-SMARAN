import { deleteSecureValue, getSecureValue, setSecureValue, type SecureStorageKey } from '../services/secure-storage.service';
import { AUTH_STORAGE_KEY } from './config';

// Two banks keep the previous session readable if a chunk write fails. Every byte stays in SecureStore.
// ponytail: 32 x 400 UTF-16 units bounds session storage; revisit only if a real provider needs larger sessions.
const MAX_CHUNKS = 32;
type Manifest = { bank: 'a' | 'b'; count: number };
export function createAuthStorage(onFailure: () => void) {
  let failed = false;
  let closed = false;
  let queue: Promise<unknown> = Promise.resolve();
  const key = (value: string): SecureStorageKey => {
    if (!/^smaran\.cloud\.[A-Za-z0-9._-]+$/.test(value)) throw new Error('Invalid auth storage key.');
    return value as SecureStorageKey;
  };
  const run = <T>(work: () => Promise<T>) => {
    const result = queue.then(async () => {
      if (failed || closed) throw new Error('Account storage needs attention.');
      try { return await work(); }
      catch { failed = true; onFailure(); throw new Error('Account storage needs attention.'); }
    });
    queue = result.catch(() => {});
    return result;
  };
  async function manifest(name: string): Promise<Manifest | null> {
    const value = await getSecureValue(key(name));
    if (value === null) return null;
    const item = JSON.parse(value) as Manifest;
    if (!item || !['a', 'b'].includes(item.bank) || !Number.isInteger(item.count) || item.count < 1 || item.count > MAX_CHUNKS) {
      throw new Error('Invalid account storage.');
    }
    return item;
  }
  return {
    close() { closed = true; },
    getItem: (name: string) => run(async () => {
      const saved = await manifest(name);
      if (!saved) return null;
      let value = '';
      for (let i = 0; i < saved.count; i++) {
        const chunk = await getSecureValue(key(`${name}.${saved.bank}.${i}`));
        if (chunk === null) throw new Error('Incomplete account storage.');
        value += chunk;
      }
      return value;
    }),
    setItem: (name: string, value: string) => run(async () => {
      const count = Math.ceil(value.length / 400);
      if (count < 1 || count > MAX_CHUNKS) throw new Error('Account session is too large.');
      const old = await manifest(name);
      const bank = old?.bank === 'a' ? 'b' : 'a';
      for (let i = 0; i < count; i++) await setSecureValue(key(`${name}.${bank}.${i}`), value.slice(i * 400, (i + 1) * 400));
      if (closed) throw new Error('Account changed.');
      await setSecureValue(key(name), JSON.stringify({ bank, count }));
    }),
    removeItem: (name: string) => run(async () => {
      // Delete chunks before the manifest: interrupted clearing is an explicit storage error, never a restored old session.
      for (const bank of ['a', 'b']) for (let i = 0; i < MAX_CHUNKS; i++) await deleteSecureValue(key(`${name}.${bank}.${i}`));
      await deleteSecureValue(key(name));
    }),
  };
}

// Hydrate before constructing Supabase: its fire-and-forget INITIAL_SESSION notification
// does not catch a throwing storage read. Unknown storage must never construct a logged-out client.
export async function restoreSessionStorage(onFailure: () => void) {
  const secure = createAuthStorage(onFailure);
  const memory = new Map<string, string | null>();
  const parseFlows = (index: string | null | undefined): string[] => {
    const flows: unknown = index == null ? [] : JSON.parse(index);
    if (!Array.isArray(flows) || flows.length > 16 || flows.some(id => typeof id !== 'string' || !/^[A-Za-z0-9_-]{8,64}$/.test(id))) {
      throw new Error('Invalid account flows.');
    }
    return flows;
  };
  const keysForFlows = (flows: string[]) => flows.map(id => `${AUTH_STORAGE_KEY}-flow-${id}-code-verifier`);
  async function finishLogout(flows: string[]) {
    for (const key of keysForFlows(flows)) await secure.removeItem(key);
    for (const suffix of ['', '-code-verifier', '-flows-code-verifier', '-user', '-callback-state']) await secure.removeItem(AUTH_STORAGE_KEY + suffix);
    await deleteSecureValue('smaran.cloud.logout-pending');
    memory.clear();
  }
  let flowKeys: string[] = [];
  try {
    const pending = await getSecureValue('smaran.cloud.logout-pending');
    // The durable intent includes flow IDs so a partially deleted index cannot prevent logout recovery.
    if (pending !== null) await finishLogout(parseFlows(pending));
    else flowKeys = keysForFlows(parseFlows(await secure.getItem(AUTH_STORAGE_KEY + '-flows-code-verifier')));
  } catch { onFailure(); throw new Error('Account storage needs attention.'); }
  for (const key of flowKeys) memory.set(key, await secure.getItem(key));
  for (const suffix of ['', '-code-verifier', '-flows-code-verifier', '-user', '-callback-state']) {
    const key = AUTH_STORAGE_KEY + suffix;
    memory.set(key, await secure.getItem(key));
  }
  const saved = memory.get(AUTH_STORAGE_KEY);
  if (saved !== null && saved !== undefined) {
    try {
      const session = JSON.parse(saved);
      if (!session || typeof session.access_token !== 'string' || !session.access_token || typeof session.refresh_token !== 'string' ||
          !session.refresh_token || !Number.isFinite(session.expires_at) ||
          !/^[0-9a-f-]{36}$/i.test(session.user?.id ?? '')) throw new Error('Invalid saved account.');
    } catch { onFailure(); throw new Error('Account storage needs attention.'); }
  }
  return {
    close: () => secure.close(),
    clearCallback: async (current: () => boolean) => {
      // This app permits one pending attempt. Clear the SDK's indexed copies too, not just its legacy slot.
      const keys = [...keysForFlows(parseFlows(memory.get(AUTH_STORAGE_KEY + '-flows-code-verifier'))),
        ...['-code-verifier', '-flows-code-verifier', '-callback-state'].map(suffix => AUTH_STORAGE_KEY + suffix)];
      for (const key of keys) {
        if (!current()) throw new Error('Account request expired.');
        await secure.removeItem(key); memory.delete(key);
      }
    },
    beginLogout: () => setSecureValue('smaran.cloud.logout-pending', JSON.stringify(parseFlows(memory.get(AUTH_STORAGE_KEY + '-flows-code-verifier')))),
    finishLogout: async () => {
      const pending = await getSecureValue('smaran.cloud.logout-pending');
      if (pending === null) throw new Error('Missing sign-out state.');
      await finishLogout(parseFlows(pending));
    },
    getItem: async (key: string) => memory.get(key) ?? null,
    setItem: async (key: string, value: string) => { await secure.setItem(key, value); memory.set(key, value); },
    removeItem: async (key: string) => { await secure.removeItem(key); memory.delete(key); },
  };
}
