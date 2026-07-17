/**
 * Hardware-backed secret storage (iOS Keychain / Android Keystore).
 * Falls back to AsyncStorage only when Keychain is unavailable (e.g. Jest).
 */
import * as Keychain from 'react-native-keychain';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { reportError } from './errorReporting';

const SERVICE = 'ai.notelawbs.secrets';
const FALLBACK_KEY = 'litnotes.secure.fallback.v1';

async function readFallback(): Promise<Record<string, string>> {
  try {
    const raw = await AsyncStorage.getItem(FALLBACK_KEY);
    return raw ? (JSON.parse(raw) as Record<string, string>) : {};
  } catch {
    return {};
  }
}

async function writeFallback(map: Record<string, string>): Promise<void> {
  try {
    await AsyncStorage.setItem(FALLBACK_KEY, JSON.stringify(map));
  } catch (e) {
    reportError(e, { where: 'secureStore.writeFallback' }, 'error');
  }
}

export async function getSecret(key: string): Promise<string | null> {
  try {
    const creds = await Keychain.getGenericPassword({ service: `${SERVICE}.${key}` });
    if (creds && typeof creds !== 'boolean') {
      return creds.password || null;
    }
  } catch (e) {
    if (__DEV__) console.warn('[secureStore] keychain read failed, using fallback', key, e);
  }
  const map = await readFallback();
  return map[key] ?? null;
}

export async function setSecret(key: string, value: string): Promise<void> {
  const trimmed = value.trim();
  try {
    if (!trimmed) {
      await Keychain.resetGenericPassword({ service: `${SERVICE}.${key}` });
    } else {
      await Keychain.setGenericPassword(key, trimmed, {
        service: `${SERVICE}.${key}`,
        accessible: Keychain.ACCESSIBLE.WHEN_UNLOCKED_THIS_DEVICE_ONLY,
      });
    }
    // Clear any plaintext fallback copy after a successful keychain write.
    const map = await readFallback();
    if (key in map) {
      delete map[key];
      await writeFallback(map);
    }
    return;
  } catch (e) {
    reportError(e, { where: 'secureStore.setSecret', key }, 'warning');
  }
  const map = await readFallback();
  if (!trimmed) delete map[key];
  else map[key] = trimmed;
  await writeFallback(map);
}

export async function deleteSecret(key: string): Promise<void> {
  await setSecret(key, '');
}

/** Move a plaintext AsyncStorage setting into the keychain, then clear it. */
export async function migrateSettingToSecret(
  settingKey: string,
  readSetting: (k: string) => Promise<string | null>,
  clearSetting: (k: string) => Promise<void>,
  secretKey = settingKey,
): Promise<void> {
  const existing = await getSecret(secretKey);
  if (existing) {
    await clearSetting(settingKey);
    return;
  }
  const plain = await readSetting(settingKey);
  if (!plain?.trim()) return;
  await setSecret(secretKey, plain.trim());
  await clearSetting(settingKey);
}
