import * as SecureStore from 'expo-secure-store';

export const SecureStorageKeys = {
  onboardingCompleted: 'smaran.onboarding-completed',
  activeProfileId: 'smaran.active-profile-id',
  authToken: 'smaran.auth-token',
  appearance: 'smaran.appearance',
  pendingPersonId: 'smaran.pending-person-id',
} as const;

export type SecureStorageKey = (typeof SecureStorageKeys)[keyof typeof SecureStorageKeys] | `smaran.dob.${string}`;

export class SecureStorageUnavailableError extends Error {
  constructor() {
    super('Secure storage is unavailable on this device.');
    this.name = 'SecureStorageUnavailableError';
  }
}

export async function isSecureStorageAvailable() {
  try {
    return await SecureStore.isAvailableAsync();
  } catch {
    return false;
  }
}

export async function getSecureValue(key: SecureStorageKey) {
  if (!(await isSecureStorageAvailable())) {
    throw new SecureStorageUnavailableError();
  }
  return SecureStore.getItemAsync(key);
}

export async function setSecureValue(key: SecureStorageKey, value: string) {
  if (!(await isSecureStorageAvailable())) {
    throw new SecureStorageUnavailableError();
  }
  await SecureStore.setItemAsync(key, value);
}

export async function deleteSecureValue(key: SecureStorageKey) {
  if (!(await isSecureStorageAvailable())) {
    throw new SecureStorageUnavailableError();
  }
  await SecureStore.deleteItemAsync(key);
  return true;
}
