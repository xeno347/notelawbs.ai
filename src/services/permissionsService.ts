import { PermissionsAndroid, Platform } from 'react-native';
import { getSetting, setSetting } from '../storage';

export type PermissionKey = 'notifications' | 'media';
export type PermissionState = 'granted' | 'denied' | 'unavailable';

export type PermissionResult = Record<PermissionKey, PermissionState>;

export type PermissionMeta = {
  key: PermissionKey;
  label: string;
  description: string;
};

export const PERMISSION_ITEMS: PermissionMeta[] = [
  {
    key: 'notifications',
    label: 'Notifications',
    description: 'Alerts when a document scan finishes or a research memo is ready.',
  },
  {
    key: 'media',
    label: 'Photos & files',
    description: 'Save exported canvas snapshots and note bundles to your device.',
  },
];

async function requestAndroid(perm: string | undefined): Promise<PermissionState> {
  if (!perm) return 'unavailable';
  try {
    const res = await PermissionsAndroid.request(perm as any);
    return res === PermissionsAndroid.RESULTS.GRANTED ? 'granted' : 'denied';
  } catch {
    return 'denied';
  }
}

async function requestNotifications(): Promise<PermissionState> {
  if (Platform.OS === 'android') {
    if (Number(Platform.Version) >= 33) {
      return requestAndroid((PermissionsAndroid.PERMISSIONS as any).POST_NOTIFICATIONS);
    }
    return 'granted';
  }
  // iOS notification permission needs a native module we don't bundle; the OS
  // will prompt on first scheduled notification. Treat as handled here.
  return 'granted';
}

async function requestMedia(): Promise<PermissionState> {
  if (Platform.OS === 'android') {
    if (Number(Platform.Version) >= 33) {
      return requestAndroid((PermissionsAndroid.PERMISSIONS as any).READ_MEDIA_IMAGES);
    }
    return requestAndroid(PermissionsAndroid.PERMISSIONS.WRITE_EXTERNAL_STORAGE);
  }
  // iOS grants photo access through the system share/save sheet at use time.
  return 'granted';
}

export async function savePermissionState(key: PermissionKey, state: PermissionState): Promise<void> {
  await setSetting(`perm.${key}`, state);
}

export async function loadPermissionState(key: PermissionKey): Promise<PermissionState | null> {
  const v = (await getSetting(`perm.${key}`)) as PermissionState | null;
  return v || null;
}

export async function requestPermission(key: PermissionKey): Promise<PermissionState> {
  const state = key === 'notifications' ? await requestNotifications() : await requestMedia();
  await savePermissionState(key, state);
  return state;
}

export async function requestAllPermissions(): Promise<PermissionResult> {
  const notifications = await requestNotifications();
  const media = await requestMedia();
  await savePermissionState('notifications', notifications);
  await savePermissionState('media', media);
  return { notifications, media };
}
