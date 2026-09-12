import { Platform } from 'react-native';
import * as Crypto from 'expo-crypto';

// Supply only the WebCrypto operations Supabase PKCE uses, backed by Expo's native implementation.
// Never permit the SDK's Math.random/plain challenge fallback on native.
export function preparePKCE() {
  if (Platform.OS === 'web') throw new Error('Cloud accounts require a supported native build.');
  if (!globalThis.crypto) Object.defineProperty(globalThis, 'crypto', { value: {}, configurable: true });
  if (!globalThis.crypto.getRandomValues) Object.assign(globalThis.crypto, { getRandomValues: Crypto.getRandomValues });
  if (!globalThis.crypto.subtle) Object.assign(globalThis.crypto, { subtle: {
    digest: (algorithm: string, data: BufferSource) => {
      if (algorithm !== 'SHA-256') throw new Error('Unsupported digest.');
      return Crypto.digest(Crypto.CryptoDigestAlgorithm.SHA256, data);
    },
  } });
  if (typeof TextEncoder === 'undefined') throw new Error('Secure account access is unavailable.');
}
