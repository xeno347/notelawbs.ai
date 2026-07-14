import { create } from 'zustand';
import type { RealtimeChannel } from '@supabase/supabase-js';
import { getSupabase, isSupabaseConfigured } from '../services/supabase';
import { useStore, type CanvasSync } from '../store';
import { setPersistListener } from '../storage';
import { useAuth } from '../auth/authStore';

export type CollabRole = 'owner' | 'editor' | 'viewer';
export type CollabAccess = 'edit' | 'view';
export type CollabStatus = 'off' | 'connecting' | 'live' | 'error';

export type Peer = {
  id: string;
  name: string;
  color: string;
  role: CollabRole;
  x: number | null; // cursor in canvas/world coordinates
  y: number | null;
  ts: number;
};

const PEER_COLORS = ['#6C8CFF', '#26C0A8', '#E0794B', '#B983FF', '#F25C7F', '#43B0F1', '#F2C14E'];

function colorFor(id: string): string {
  let h = 0;
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) >>> 0;
  return PEER_COLORS[h % PEER_COLORS.length];
}

function shortId(len = 6): string {
  const abc = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let s = '';
  for (let i = 0; i < len; i++) s += abc[Math.floor(Math.random() * abc.length)];
  return s;
}

export const JOIN_URL_PREFIX = 'litnotes://join/';

function buildShareLink(roomId: string, access: CollabAccess): string {
  return `${JOIN_URL_PREFIX}${roomId}?a=${access}`;
}

export function parseJoinUrl(url: string): { roomId: string; access: CollabAccess } | null {
  if (!url || !url.includes('/join/')) return null;
  try {
    const after = url.split('/join/')[1];
    const [roomId, query] = after.split('?');
    const access: CollabAccess = /a=view/.test(query || '') ? 'view' : 'edit';
    return roomId ? { roomId: roomId.trim(), access } : null;
  } catch {
    return null;
  }
}

type CollabState = {
  status: CollabStatus;
  error: string | null;
  roomId: string | null;
  access: CollabAccess;
  role: CollabRole;
  selfId: string;
  selfName: string;
  peers: Record<string, Peer>;
  shareLink: string | null;

  startShare: (access?: CollabAccess) => Promise<void>;
  join: (roomId: string, access?: CollabAccess) => Promise<void>;
  setAccess: (access: CollabAccess) => Promise<void>;
  leave: () => Promise<void>;
  sendCursor: (x: number, y: number) => void;
  canEdit: () => boolean;
};

let channel: RealtimeChannel | null = null;
let lastSyncedJson = '';
let cursorThrottle = 0;

function selfIdentity(): { id: string; name: string } {
  const user = useAuth.getState().user;
  if (user) return { id: user.id, name: user.displayName || user.email || 'Member' };
  return { id: `guest-${shortId(8)}`, name: 'Guest' };
}

function broadcastSnapshot(force = false) {
  if (!channel) return;
  const sync = useStore.getState().getSyncState();
  const json = JSON.stringify(sync);
  if (!force && json === lastSyncedJson) return;
  lastSyncedJson = json;
  channel.send({
    type: 'broadcast',
    event: 'snapshot',
    payload: { by: useCollab.getState().selfId, sync },
  });
}

function applyIncomingSnapshot(sync: CanvasSync) {
  const json = JSON.stringify(sync);
  if (json === lastSyncedJson) return;
  lastSyncedJson = json;
  useStore.getState().applyRemoteSnapshot(sync);
}

function refreshPeersFromPresence() {
  if (!channel) return;
  const state = channel.presenceState() as Record<string, any[]>;
  const self = useCollab.getState().selfId;
  const prev = useCollab.getState().peers;
  const next: Record<string, Peer> = {};
  Object.values(state).forEach((entries) => {
    entries.forEach((meta: any) => {
      if (!meta?.id || meta.id === self) return;
      const existing = prev[meta.id];
      next[meta.id] = {
        id: meta.id,
        name: meta.name || 'Guest',
        color: meta.color || colorFor(meta.id),
        role: meta.role || 'viewer',
        x: existing?.x ?? null,
        y: existing?.y ?? null,
        ts: Date.now(),
      };
    });
  });
  useCollab.setState({ peers: next });
}

async function connect(roomId: string, role: CollabRole, access: CollabAccess) {
  if (!isSupabaseConfigured()) {
    useCollab.setState({ status: 'error', error: 'Connect Supabase in Settings to share live.' });
    return;
  }
  const sb = getSupabase();
  if (!sb) {
    useCollab.setState({ status: 'error', error: 'Realtime is not available.' });
    return;
  }

  const { id, name } = selfIdentity();
  const color = colorFor(id);
  useCollab.setState({
    status: 'connecting',
    error: null,
    roomId,
    role,
    access,
    selfId: id,
    selfName: name,
    peers: {},
    shareLink: buildShareLink(roomId, access),
  });
  lastSyncedJson = '';

  const ch = sb.channel(`room:${roomId}`, {
    config: { presence: { key: id }, broadcast: { self: false } },
  });

  ch.on('broadcast', { event: 'snapshot' }, ({ payload }) => {
    if (payload?.by === id || !payload?.sync) return;
    applyIncomingSnapshot(payload.sync as CanvasSync);
  });

  ch.on('broadcast', { event: 'request_snapshot' }, () => {
    if (useCollab.getState().canEdit()) broadcastSnapshot(true);
  });

  ch.on('broadcast', { event: 'cursor' }, ({ payload }) => {
    if (!payload?.id || payload.id === id) return;
    useCollab.setState((s) => {
      const peer = s.peers[payload.id];
      if (!peer) return s;
      return { peers: { ...s.peers, [payload.id]: { ...peer, x: payload.x, y: payload.y, ts: Date.now() } } };
    });
  });

  ch.on('presence', { event: 'sync' }, refreshPeersFromPresence);
  ch.on('presence', { event: 'join' }, () => {
    refreshPeersFromPresence();
    // Someone new arrived — if we can edit, push current state so they catch up.
    if (useCollab.getState().canEdit()) setTimeout(() => broadcastSnapshot(true), 250);
  });
  ch.on('presence', { event: 'leave' }, refreshPeersFromPresence);

  channel = ch;

  ch.subscribe((status) => {
    if (status === 'SUBSCRIBED') {
      ch.track({ id, name, color, role });
      useCollab.setState({ status: 'live' });
      // Editors/owners publish; late joiners ask for the current state.
      if (useCollab.getState().canEdit()) {
        broadcastSnapshot(true);
        setPersistListener(() => {
          if (useCollab.getState().canEdit()) broadcastSnapshot(false);
        });
      } else {
        ch.send({ type: 'broadcast', event: 'request_snapshot', payload: { by: id } });
      }
    } else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
      useCollab.setState({ status: 'error', error: 'Lost connection to the live session.' });
    }
  });
}

export const useCollab = create<CollabState>((set, get) => ({
  status: 'off',
  error: null,
  roomId: null,
  access: 'edit',
  role: 'viewer',
  selfId: '',
  selfName: '',
  peers: {},
  shareLink: null,

  startShare: async (access = 'edit') => {
    const roomId = shortId(6);
    await connect(roomId, 'owner', access);
  },

  join: async (roomId, access = 'edit') => {
    await connect(roomId.trim().toUpperCase(), access === 'view' ? 'viewer' : 'editor', access);
  },

  setAccess: async (access) => {
    const { roomId, status } = get();
    set({ access, shareLink: roomId ? buildShareLink(roomId, access) : null });
    // Re-broadcast link only; role changes for existing peers apply on rejoin.
    if (status === 'live') { /* access affects future joiners */ }
  },

  leave: async () => {
    setPersistListener(null);
    if (channel) {
      try {
        await channel.unsubscribe();
      } catch {
        /* noop */
      }
      const sb = getSupabase();
      if (sb) sb.removeChannel(channel);
    }
    channel = null;
    lastSyncedJson = '';
    set({
      status: 'off',
      error: null,
      roomId: null,
      role: 'viewer',
      peers: {},
      shareLink: null,
    });
  },

  sendCursor: (x, y) => {
    if (!channel || get().status !== 'live') return;
    const now = Date.now();
    if (now - cursorThrottle < 45) return; // ~22fps
    cursorThrottle = now;
    channel.send({ type: 'broadcast', event: 'cursor', payload: { id: get().selfId, x, y } });
  },

  canEdit: () => {
    const { status, role } = get();
    return status === 'live' && (role === 'owner' || role === 'editor');
  },
}));

/** True when the user is in a live session as a read-only viewer. */
export function useViewerLocked(): boolean {
  return useCollab((s) => s.status === 'live' && s.role === 'viewer');
}
