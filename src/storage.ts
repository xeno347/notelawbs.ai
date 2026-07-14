import AsyncStorage from '@react-native-async-storage/async-storage';
import ReactNativeBlobUtil from 'react-native-blob-util';
import { Platform } from 'react-native';

const WORKSPACE_KEY = 'litnotes.workspace.v1';
const SETTINGS_KEY = 'litnotes.settings.v1';
const AUTH_USERS_KEY = 'litnotes.auth.users.v1';
const SESSION_KEY = 'litnotes.auth.session.v1';

export type Persisted = {
  docName: string;
  docUri: string;
  numPages: number;
  highlights: any[];
  nodes: any[];
  edges: any[];
  ink: { strokes: any[]; links: any[] };
  ocrPages: Record<number, string>;
  bookmarks: any[];
};

// Workspaces are scoped per signed-in user so accounts on the same device never
// share notes. Set before hydrating; falls back to a shared "guest" bucket.
let workspaceScope = 'guest';

export function setWorkspaceScope(userId: string | null): void {
  workspaceScope = userId && userId.length ? userId : 'guest';
}

export function getWorkspaceScope(): string {
  return workspaceScope;
}

function workspaceKey(): string {
  return `${WORKSPACE_KEY}::${workspaceScope}`;
}

export async function loadWorkspace(): Promise<Persisted | null> {
  try {
    const raw = await AsyncStorage.getItem(workspaceKey());
    return raw ? (JSON.parse(raw) as Persisted) : null;
  } catch {
    return null;
  }
}

// Optional listener notified (debounced) whenever the workspace is persisted.
// Used by the collaboration layer to broadcast local edits to peers.
let persistListener: ((data: Persisted) => void) | null = null;
export function setPersistListener(l: ((data: Persisted) => void) | null): void {
  persistListener = l;
}

let saveTimer: ReturnType<typeof setTimeout> | null = null;
export function saveWorkspaceDebounced(data: Persisted) {
  const key = workspaceKey();
  if (saveTimer) clearTimeout(saveTimer);
  saveTimer = setTimeout(() => {
    AsyncStorage.setItem(key, JSON.stringify(data)).catch(() => {});
    if (persistListener) {
      try {
        persistListener(data);
      } catch {
        /* noop */
      }
    }
  }, 400);
}

export async function clearWorkspace(): Promise<void> {
  try {
    await AsyncStorage.removeItem(workspaceKey());
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

/* ------------------------------------------------------------------ */
/* Local auth + session (on-device only — no backend server).          */
/* Passwords are stored as a lightweight salted hash so the raw value  */
/* never touches disk. This is a device-local trial gate, not a        */
/* security boundary; swap in a real provider before production auth.  */
/* ------------------------------------------------------------------ */

export type AuthUser = {
  id: string;
  email: string;
  displayName: string;
  createdAt: number;
};

type StoredUser = AuthUser & { hash: string };

export type Session = { userId: string; email: string; issuedAt: number };

// Deterministic non-cryptographic hash (djb2) with a fixed salt. Adequate to
// avoid storing plaintext for a local demo; not a substitute for bcrypt.
function hashPassword(password: string): string {
  const salted = `lnc::${password}`;
  let h = 5381;
  for (let i = 0; i < salted.length; i++) {
    h = (h * 33) ^ salted.charCodeAt(i);
  }
  return (h >>> 0).toString(16);
}

async function loadUsers(): Promise<Record<string, StoredUser>> {
  try {
    const raw = await AsyncStorage.getItem(AUTH_USERS_KEY);
    return raw ? (JSON.parse(raw) as Record<string, StoredUser>) : {};
  } catch {
    return {};
  }
}

async function saveUsers(users: Record<string, StoredUser>): Promise<void> {
  try {
    await AsyncStorage.setItem(AUTH_USERS_KEY, JSON.stringify(users));
  } catch {
    /* noop */
  }
}

function toPublic(u: StoredUser): AuthUser {
  return { id: u.id, email: u.email, displayName: u.displayName, createdAt: u.createdAt };
}

export type AuthResult = { ok: true; user: AuthUser } | { ok: false; error: string };

export async function signUp(
  email: string,
  password: string,
  displayName: string,
): Promise<AuthResult> {
  const key = email.trim().toLowerCase();
  if (!key) return { ok: false, error: 'Enter an email address.' };
  if (password.length < 6) return { ok: false, error: 'Password must be at least 6 characters.' };
  const users = await loadUsers();
  if (users[key]) return { ok: false, error: 'An account with this email already exists.' };
  const user: StoredUser = {
    id: `u_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    email: key,
    displayName: displayName.trim() || key.split('@')[0],
    createdAt: Date.now(),
    hash: hashPassword(password),
  };
  users[key] = user;
  await saveUsers(users);
  return { ok: true, user: toPublic(user) };
}

export async function signIn(email: string, password: string): Promise<AuthResult> {
  const key = email.trim().toLowerCase();
  const users = await loadUsers();
  const user = users[key];
  if (!user) return { ok: false, error: 'No account found for this email.' };
  if (user.hash !== hashPassword(password)) return { ok: false, error: 'Incorrect password.' };
  return { ok: true, user: toPublic(user) };
}

export async function saveSession(session: Session): Promise<void> {
  try {
    await AsyncStorage.setItem(SESSION_KEY, JSON.stringify(session));
  } catch {
    /* noop */
  }
}

export async function loadSession(): Promise<Session | null> {
  try {
    const raw = await AsyncStorage.getItem(SESSION_KEY);
    return raw ? (JSON.parse(raw) as Session) : null;
  } catch {
    return null;
  }
}

export async function clearSession(): Promise<void> {
  try {
    await AsyncStorage.removeItem(SESSION_KEY);
  } catch {
    /* noop */
  }
}

export async function getUserById(id: string): Promise<AuthUser | null> {
  const users = await loadUsers();
  for (const key of Object.keys(users)) {
    if (users[key].id === id) return toPublic(users[key]);
  }
  return null;
}

/**
 * Copy a picked PDF into the app's document directory so it survives restarts
 * and content-URIs (Android) stay readable. Returns a stable file path.
 */
export async function persistPdf(sourceUri: string, name: string): Promise<string> {
  const dir = ReactNativeBlobUtil.fs.dirs.DocumentDir;
  const safe = name.replace(/[^\w.\-]/g, '_') || 'document.pdf';
  const dest = `${dir}/litnotes_${workspaceScope}.pdf`;
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
