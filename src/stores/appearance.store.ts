import { create } from 'zustand';
import { getSecureValue, SecureStorageKeys, setSecureValue } from '../services/secure-storage.service';

export const AppearanceModes = ['system', 'light', 'dark', 'high-contrast-light', 'high-contrast-dark'] as const;
export type AppearanceMode = typeof AppearanceModes[number];
export const useAppearanceStore = create<{ mode: AppearanceMode | null }>(() => ({ mode: null }));

export async function loadAppearance() {
  const value = await getSecureValue(SecureStorageKeys.appearance);
  if (value !== null && !AppearanceModes.includes(value as AppearanceMode)) throw new Error('Invalid saved appearance.');
  useAppearanceStore.setState({ mode: value as AppearanceMode | null });
}

export async function saveAppearance(mode: AppearanceMode) {
  if (!AppearanceModes.includes(mode)) throw new Error('Invalid appearance.');
  await setSecureValue(SecureStorageKeys.appearance, mode);
  useAppearanceStore.setState({ mode });
}
