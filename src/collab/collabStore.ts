import { create } from 'zustand';
import type { RealtimeChannel } from '@supabase/supabase-js';
import { getSupabase, isSupabaseConfigured } from '../services/supabase';
import { useStore, type CanvasSync } from '../store';
import { setPersistListener } from '../storage';
import { useAuth } from '../auth/authStore';
import {
  buildInviteLink,
  inviteIsFresh,
  mintInvite,
  parseInviteUrl,
  rememberRoom,
  roleFromInvite,
  saveRoomPolicy,
  type InvitePayload,
} from './inviteTokens';
import { randomString } from '../services/secureRandom';

export type CollabRole = 'owner' | 'editor' | 'viewer';
export type CollabAccess = import('./inviteTokens').CollabAccess;
export type CollabStatus = 'off' | 'connecting' | 'live' | 'error';

export type Peer = {
  id: string;
  name: string;
  color: string;
  role: CollabRole;
  x: number | null;
  y: number | null;
  ts: number;
};

const PEER_COLORS = ['#6C8CFF', '#26C0A8', '#E0794B', '#B983FF', '#F25C7F', '#43B0F1', '#F2C14E'];

function colorFor(id: string): string {
  let h = 0;
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) >>> 0;
  return PEER_COLORS[h % PEER_COLORS.length];
}

function shortId(len = 10): string {
  return randomString(len, 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789');
}

export const JOIN_URL_PREFIX = 'litnotes://join/';

/** @deprecated Prefer parseInviteUrl — kept for App.tsx deep-link callers. */
export function parseJoinUrl(url: string): { roomId: string; access: CollabAccess; token?: string } | null {
  const invite = parseInviteUrl(url);
  if (!invite) return null;
  return { roomId: invite.roomId, access: invite.access, token: invite.token || undefined };
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
  /** Current session invite token (owner). */
  inviteToken: string | null;
  inviteExp: number | null;

  startShare: (access?: CollabAccess) => Promise<void>;
  join: (roomIdOrUrl: string, access?: CollabAccess) => Promise<void>;
  joinInvite: (invite: InvitePayload) => Promise<void>;
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

async function connect(
  roomId: string,
  role: CollabRole,
  access: CollabAccess,
  invite: InvitePayload | null,
) {
  if (!isSupabaseConfigured()) {
    useCollab.setState({ status: 'error', error: 'Connect Supabase in Settings → Advanced to share live.' });
    return;
  }
  const sb = getSupabase();
  if (!sb) {
    useCollab.setState({ status: 'error', error: 'Realtime is not available.' });
    return;
  }

  // Tear down any previous channel before joining another room.
  if (channel) {
    try {
      await channel.unsubscribe();
    } catch {
      /* noop */
    }
    sb.removeChannel(channel);
    channel = null;
  }

  const { id, name } = selfIdentity();
  const color = colorFor(id);
  const link = invite ? buildInviteLink(invite) : `${JOIN_URL_PREFIX}${roomId}?a=${access}`;

  useCollab.setState({
    status: 'connecting',
    error: null,
    roomId,
    role,
    access,
    selfId: id,
    selfName: name,
    peers: {},
    shareLink: link,
    inviteToken: invite?.token || null,
    inviteExp: invite?.exp || null,
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
    if (useCollab.getState().canEdit()) setTimeout(() => broadcastSnapshot(true), 250);
  });
  ch.on('presence', { event: 'leave' }, refreshPeersFromPresence);

  channel = ch;

  ch.subscribe((status) => {
    if (status === 'SUBSCRIBED') {
      ch.track({
        id,
        name,
        color,
        role,
        token: invite?.token || '',
      });
      useCollab.setState({ status: 'live' });
      void rememberRoom({
        roomId,
        access,
        title: useStore.getState().projectTitle || useStore.getState().docName || `Room ${roomId}`,
        shareLink: link,
        token: invite?.token,
        exp: invite?.exp,
      });
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
  inviteToken: null,
  inviteExp: null,

  startShare: async (access = 'edit') => {
    // ~50 bits of entropy (10 chars × 32-symbol alphabet) — not a substitute for
    // Realtime Authorization / RLS, but far harder to brute-force than 6 chars.
    const roomId = shortId(10);
    const invite = mintInvite(roomId, access);
    await saveRoomPolicy({
      roomId,
      access,
      token: invite.token,
      exp: invite.exp,
      createdAt: Date.now(),
    });
    await connect(roomId, 'owner', access, invite);
  },

  join: async (roomIdOrUrl, access = 'edit') => {
    const asUrl = roomIdOrUrl.includes('/join/') ? parseInviteUrl(roomIdOrUrl) : null;
    if (asUrl) {
      await get().joinInvite(asUrl);
      return;
    }
    const roomId = roomIdOrUrl.trim().toUpperCase();
    if (!roomId) {
      set({ status: 'error', error: 'Enter a room code or paste an invite link.' });
      return;
    }
    // Code-only join cannot self-elevate: viewer until a tokenized invite proves edit access.
    // Full server-side gating still requires Supabase Realtime Authorization / RLS.
    void access;
    await connect(roomId, 'viewer', 'view', null);
  },

  joinInvite: async (invite) => {
    if (!inviteIsFresh(invite)) {
      set({ status: 'error', error: 'This invite link has expired. Ask for a new one.' });
      return;
    }
    if (!invite.token) {
      // Legacy link without token — cannot self-elevate to editor.
      await connect(invite.roomId, 'viewer', 'view', invite);
      return;
    }
    const access = roleFromInvite(invite);
    await connect(invite.roomId, access === 'view' ? 'viewer' : 'editor', access, invite);
  },

  setAccess: async (access) => {
    const { roomId, status, inviteToken, inviteExp } = get();
    if (!roomId) {
      set({ access });
      return;
    }
    const invite = mintInvite(roomId, access);
    // Preserve remaining TTL window when regenerating for a new access level.
    if (inviteExp && inviteExp > Date.now()) {
      invite.exp = inviteExp;
    }
    // Keep a stable token if we already have one for this live session.
    if (inviteToken) invite.token = inviteToken;
    await saveRoomPolicy({
      roomId,
      access,
      token: invite.token,
      exp: invite.exp,
      createdAt: Date.now(),
    });
    set({
      access,
      shareLink: buildInviteLink(invite),
      inviteToken: invite.token,
      inviteExp: invite.exp,
    });
    void status;
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
      inviteToken: null,
      inviteExp: null,
    });
  },

  sendCursor: (x, y) => {
    if (!channel || get().status !== 'live') return;
    const now = Date.now();
    if (now - cursorThrottle < 45) return;
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
