import * as Battery from 'expo-battery';
import { Platform } from 'react-native';

// One local read on request. Never stored, synced, or presented as another device's battery.
export async function readBatteryPercent(): Promise<number | null> {
  try {
    if (Platform.OS === 'web' || !(await Battery.isAvailableAsync())) return null;
    const level = await Battery.getBatteryLevelAsync();
    return Number.isFinite(level) && level >= 0 && level <= 1 ? Math.round(level * 100) : null;
  } catch { return null; }
}
