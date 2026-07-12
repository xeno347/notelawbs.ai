import AsyncStorage from '@react-native-async-storage/async-storage';
import ReactNativeBlobUtil from 'react-native-blob-util';
import { Platform } from 'react-native';

const WORKSPACE_KEY = 'litnotes.workspace.v1';
const SETTINGS_KEY = 'litnotes.settings.v1';

export type Persisted = {
  docName: string;
  docUri: string;
  numPages: number;
  highlights: any[];
  nodes: any[];
  edges: any[];
  ink: { strokes: any[]; links: any[] };
};

export async function loadWorkspace(): Promise<Persisted | null> {
  try {
    const raw = await AsyncStorage.getItem(WORKSPACE_KEY);
    return raw ? (JSON.parse(raw) as Persisted) : null;
  } catch {
    return null;
  }
}

let saveTimer: ReturnType<typeof setTimeout> | null = null;
export function saveWorkspaceDebounced(data: Persisted) {
  if (saveTimer) clearTimeout(saveTimer);
  saveTimer = setTimeout(() => {
    AsyncStorage.setItem(WORKSPACE_KEY, JSON.stringify(data)).catch(() => {});
  }, 400);
}

export async function clearWorkspace(): Promise<void> {
  try {
    await AsyncStorage.removeItem(WORKSPACE_KEY);
  } catch {
    /* noop */
  }
}

export async function getSetting(key: string): Promise<string | null> {
  try {
    const raw = await AsyncStorage.getItem(SETTINGS_KEY);
    const obj = raw ? JSON.parse(raw) : {};
    return obj[key] ?? null;
  } catch {
    return null;
  }
}

export async function setSetting(key: string, value: string): Promise<void> {
  try {
    const raw = await AsyncStorage.getItem(SETTINGS_KEY);
    const obj = raw ? JSON.parse(raw) : {};
    obj[key] = value;
    await AsyncStorage.setItem(SETTINGS_KEY, JSON.stringify(obj));
  } catch {
    /* noop */
  }
}

/**
 * Copy a picked PDF into the app's document directory so it survives restarts
 * and content-URIs (Android) stay readable. Returns a stable file path.
 */
export async function persistPdf(sourceUri: string, name: string): Promise<string> {
  const dir = ReactNativeBlobUtil.fs.dirs.DocumentDir;
  const safe = name.replace(/[^\w.\-]/g, '_') || 'document.pdf';
  const dest = `${dir}/litnotes_current.pdf`;
  try {
    const exists = await ReactNativeBlobUtil.fs.exists(dest);
    if (exists) {
      await ReactNativeBlobUtil.fs.unlink(dest);
    }
    let src = sourceUri;
    if (Platform.OS === 'android' && sourceUri.startsWith('content://')) {
      const tmp = `${dir}/tmp_${safe}`;
      await ReactNativeBlobUtil.fs.cp(sourceUri, tmp);
      src = tmp;
    }
    const cleanSrc = src.replace('file://', '');
    await ReactNativeBlobUtil.fs.cp(cleanSrc, dest);
    return Platform.OS === 'android' ? `file://${dest}` : dest;
  } catch {
    return sourceUri;
  }
}
