import AsyncStorage from '@react-native-async-storage/async-storage';

export type CollabAccess = 'edit' | 'view';

const RECENT_KEY = 'litnotes.collab.recent.v1';
const POLICY_KEY = 'litnotes.collab.policies.v1';
const MAX_RECENT = 12;
/** Invite tokens expire after 7 days. */
export const INVITE_TTL_MS = 7 * 24 * 60 * 60 * 1000;

export type InvitePayload = {
  roomId: string;
  access: CollabAccess;
  /** Unix ms expiry */
  exp: number;
  /** Unguessable share secret — required to join with the linked role. */
  token: string;
};

export type RecentRoom = {
  roomId: string;
  access: CollabAccess;
  title: string;
  lastJoinedAt: number;
  shareLink: string;
  token?: string;
  exp?: number;
};

export type RoomPolicy = {
  roomId: string;
  access: CollabAccess;
  token: string;
  exp: number;
  createdAt: number;
};

function randomToken(bytes = 12): string {
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789abcdefghijkmnopqrstuvwxyz';
  let out = '';
  const buf = new Uint8Array(bytes);
  try {
    const g = globalThis as { crypto?: { getRandomValues?: (a: Uint8Array) => Uint8Array } };
    if (g.crypto?.getRandomValues) g.crypto.getRandomValues(buf);
    else for (let i = 0; i < bytes; i++) buf[i] = Math.floor(Math.random() * 256);
  } catch {
    for (let i = 0; i < bytes; i++) buf[i] = Math.floor(Math.random() * 256);
  }
  for (let i = 0; i < bytes; i++) out += alphabet[buf[i] % alphabet.length];
  return out;
}

export function mintInvite(roomId: string, access: CollabAccess, ttlMs = INVITE_TTL_MS): InvitePayload {
  return {
    roomId: roomId.trim().toUpperCase(),
    access,
    exp: Date.now() + ttlMs,
    token: randomToken(14),
  };
}

export function buildInviteLink(payload: InvitePayload): string {
  const { roomId, access, exp, token } = payload;
  return `litnotes://join/${roomId}?a=${access}&t=${token}&e=${exp}`;
}

export function parseInviteUrl(url: string): InvitePayload | null {
  if (!url || !url.includes('/join/')) return null;
  try {
    const after = url.split('/join/')[1];
    const [roomPart, query = ''] = after.split('?');
    const roomId = (roomPart || '').trim().toUpperCase();
    if (!roomId) return null;
    const params = Object.fromEntries(
      query.split('&').filter(Boolean).map((pair) => {
        const [k, v] = pair.split('=');
        return [k, decodeURIComponent(v || '')];
      }),
    );
    const access: CollabAccess = params.a === 'view' ? 'view' : 'edit';
    const token = params.t || '';
    const exp = Number(params.e || 0);
    return { roomId, access, exp: exp || Date.now() + INVITE_TTL_MS, token };
  } catch {
    return null;
  }
}

/** Owner-side: persist the room policy so re-shares and rejoins stay consistent. */
export async function saveRoomPolicy(policy: RoomPolicy): Promise<void> {
  const all = await loadPolicies();
  all[policy.roomId] = policy;
  try {
    await AsyncStorage.setItem(POLICY_KEY, JSON.stringify(all));
  } catch {
    /* noop */
  }
}

export async function getRoomPolicy(roomId: string): Promise<RoomPolicy | null> {
  const all = await loadPolicies();
  return all[roomId.trim().toUpperCase()] || null;
}

/** Validate a join attempt against the owner's stored policy (same device) or expiry. */
export function inviteIsFresh(payload: InvitePayload): boolean {
  if (!payload.roomId) return false;
  if (payload.exp && Date.now() > payload.exp) return false;
  return true;
}

/**
 * When the joiner presents a tokenized link, access comes from the link — not a
 * self-selected role. Empty token = legacy room-code join (role chosen in UI).
 */
export function roleFromInvite(payload: InvitePayload): CollabAccess {
  return payload.access === 'view' ? 'view' : 'edit';
}

async function loadPolicies(): Promise<Record<string, RoomPolicy>> {
  try {
    const raw = await AsyncStorage.getItem(POLICY_KEY);
    if (!raw) return {};
    const data = JSON.parse(raw) as Record<string, RoomPolicy>;
    return data && typeof data === 'object' ? data : {};
  } catch {
    return {};
  }
}

export async function loadRecentRooms(): Promise<RecentRoom[]> {
  try {
    const raw = await AsyncStorage.getItem(RECENT_KEY);
    if (!raw) return [];
    const list = JSON.parse(raw) as RecentRoom[];
    return Array.isArray(list) ? list : [];
  } catch {
    return [];
  }
}

export async function rememberRoom(
  entry: Omit<RecentRoom, 'lastJoinedAt'> & { lastJoinedAt?: number },
): Promise<void> {
  const list = await loadRecentRooms();
  const next: RecentRoom = {
    ...entry,
    lastJoinedAt: entry.lastJoinedAt ?? Date.now(),
  };
  const filtered = [next, ...list.filter((r) => r.roomId !== next.roomId)].slice(0, MAX_RECENT);
  try {
    await AsyncStorage.setItem(RECENT_KEY, JSON.stringify(filtered));
  } catch {
    /* noop */
  }
}

export async function clearRecentRooms(): Promise<void> {
  try {
    await AsyncStorage.removeItem(RECENT_KEY);
  } catch {
    /* noop */
  }
}
