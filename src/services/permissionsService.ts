import { PermissionsAndroid, Platform, Linking } from 'react-native';
import {
  PERMISSIONS,
  RESULTS,
  check,
  request,
  openSettings,
  requestNotifications as requestIosNotifications,
  type Permission,
  type PermissionStatus,
} from 'react-native-permissions';
import { getSetting, setSetting } from '../storage';

export type PermissionKey = 'notifications' | 'media' | 'camera' | 'microphone';
export type PermissionState = 'granted' | 'denied' | 'unavailable' | 'blocked';

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
    description: 'Open PDFs and save exported canvas snapshots to Photos and Files.',
  },
  {
    key: 'camera',
    label: 'Camera',
    description: 'Capture pages or documents with the camera when importing judgments.',
  },
  {
    key: 'microphone',
    label: 'Microphone',
    description: 'Voice notes and spoken research prompts when those features are available.',
  },
];

function mapStatus(status: PermissionStatus): PermissionState {
  switch (status) {
    case RESULTS.GRANTED:
    case RESULTS.LIMITED:
      return 'granted';
    case RESULTS.UNAVAILABLE:
      return 'unavailable';
    case RESULTS.BLOCKED:
      return 'blocked';
    case RESULTS.DENIED:
    default:
      return 'denied';
  }
}

async function requestAndroid(perm: string | undefined): Promise<PermissionState> {
  if (!perm) return 'unavailable';
  try {
    const res = await PermissionsAndroid.request(perm as any);
    if (res === PermissionsAndroid.RESULTS.GRANTED) return 'granted';
    if (res === PermissionsAndroid.RESULTS.NEVER_ASK_AGAIN) return 'blocked';
    return 'denied';
  } catch {
    return 'denied';
  }
}

async function requestViaPermissionsLib(perm: Permission): Promise<PermissionState> {
  try {
    const current = await check(perm);
    if (current === RESULTS.GRANTED || current === RESULTS.LIMITED) return 'granted';
    if (current === RESULTS.UNAVAILABLE) return 'unavailable';
    if (current === RESULTS.BLOCKED) return 'blocked';
    const next = await request(perm);
    return mapStatus(next);
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
  try {
    const { status } = await requestIosNotifications(['alert', 'badge', 'sound']);
    return mapStatus(status);
  } catch {
    return 'denied';
  }
}

async function requestMedia(): Promise<PermissionState> {
  if (Platform.OS === 'android') {
    if (Number(Platform.Version) >= 33) {
      const images = await requestAndroid((PermissionsAndroid.PERMISSIONS as any).READ_MEDIA_IMAGES);
      const docs = await requestAndroid(
        (PermissionsAndroid.PERMISSIONS as any).READ_MEDIA_VISUAL_USER_SELECTED,
      );
      return images === 'granted' || docs === 'granted' ? 'granted' : images;
    }
    return requestAndroid(PermissionsAndroid.PERMISSIONS.WRITE_EXTERNAL_STORAGE);
  }
  const library = await requestViaPermissionsLib(PERMISSIONS.IOS.PHOTO_LIBRARY);
  if (library === 'granted') return library;
  const addOnly = await requestViaPermissionsLib(PERMISSIONS.IOS.PHOTO_LIBRARY_ADD_ONLY);
  return addOnly === 'granted' ? addOnly : library;
}

async function requestCamera(): Promise<PermissionState> {
  if (Platform.OS === 'android') {
    return requestAndroid(PermissionsAndroid.PERMISSIONS.CAMERA);
  }
  return requestViaPermissionsLib(PERMISSIONS.IOS.CAMERA);
}

async function requestMicrophone(): Promise<PermissionState> {
  if (Platform.OS === 'android') {
    return requestAndroid(PermissionsAndroid.PERMISSIONS.RECORD_AUDIO);
  }
  return requestViaPermissionsLib(PERMISSIONS.IOS.MICROPHONE);
}

/** Open system Settings when a permission was previously blocked. */
export async function openAppPermissionSettings(): Promise<void> {
  try {
    await openSettings();
  } catch {
    try {
      await Linking.openSettings();
    } catch {
      /* ignore */
    }
  }
}

export async function savePermissionState(key: PermissionKey, state: PermissionState): Promise<void> {
  await setSetting(`perm.${key}`, state);
}

export async function loadPermissionState(key: PermissionKey): Promise<PermissionState | null> {
  const v = (await getSetting(`perm.${key}`)) as PermissionState | null;
  return v || null;
}

export async function checkPermission(key: PermissionKey): Promise<PermissionState> {
  try {
    if (key === 'camera') {
      if (Platform.OS === 'android') {
        const ok = await PermissionsAndroid.check(PermissionsAndroid.PERMISSIONS.CAMERA);
        return ok ? 'granted' : 'denied';
      }
      return mapStatus(await check(PERMISSIONS.IOS.CAMERA));
    }
    if (key === 'microphone') {
      if (Platform.OS === 'android') {
        const ok = await PermissionsAndroid.check(PermissionsAndroid.PERMISSIONS.RECORD_AUDIO);
        return ok ? 'granted' : 'denied';
      }
      return mapStatus(await check(PERMISSIONS.IOS.MICROPHONE));
    }
    if (key === 'media') {
      if (Platform.OS === 'ios') {
        return mapStatus(await check(PERMISSIONS.IOS.PHOTO_LIBRARY));
      }
      return 'granted';
    }
  } catch {
    return 'denied';
  }
  return 'denied';
}

export async function requestPermission(key: PermissionKey): Promise<PermissionState> {
  let state: PermissionState;
  switch (key) {
    case 'notifications':
      state = await requestNotifications();
      break;
    case 'media':
      state = await requestMedia();
      break;
    case 'camera':
      state = await requestCamera();
      break;
    case 'microphone':
      state = await requestMicrophone();
      break;
    default:
      state = 'unavailable';
  }
  // iOS won't re-show the dialog once blocked — jump to Settings so the user can enable it.
  if (state === 'blocked') {
    await openAppPermissionSettings();
  }
  const persisted: PermissionState = state === 'blocked' ? 'denied' : state;
  await savePermissionState(key, persisted);
  return state;
}

/** Explicit capture pipeline: camera + microphone system prompts. */
export async function requestCapturePermissions(): Promise<{
  camera: PermissionState;
  microphone: PermissionState;
}> {
  const camera = await requestPermission('camera');
  const microphone = await requestPermission('microphone');
  return { camera, microphone };
}

export async function requestAllPermissions(): Promise<PermissionResult> {
  const notifications = await requestNotifications();
  const media = await requestMedia();
  const camera = await requestCamera();
  const microphone = await requestMicrophone();
  const normalize = (s: PermissionState): PermissionState => (s === 'blocked' ? 'denied' : s);
  await savePermissionState('notifications', normalize(notifications));
  await savePermissionState('media', normalize(media));
  await savePermissionState('camera', normalize(camera));
  await savePermissionState('microphone', normalize(microphone));
  if (camera === 'blocked' || microphone === 'blocked') {
    await openAppPermissionSettings();
  }
  return {
    notifications: normalize(notifications),
    media: normalize(media),
    camera: normalize(camera),
    microphone: normalize(microphone),
  };
}
