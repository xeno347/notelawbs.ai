import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Pressable,
  Share,
  useWindowDimensions,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { X, Users, Radio, LogIn, Copy, Crown, Eye, Pencil, Clock, Link2 } from 'lucide-react-native';
import { useTheme, RADIUS, ELEVATION } from '../theme';
import { useCollab, type CollabAccess, type CollabRole } from '../collab/collabStore';
import { isSupabaseConfigured } from '../services/supabase';
import {
  clearRecentRooms,
  loadRecentRooms,
  type RecentRoom,
} from '../collab/inviteTokens';
import { AppButton, Field, Segmented, Aurora } from './ui';

const ROLE_META: Record<CollabRole, { label: string; icon: React.ComponentType<any> }> = {
  owner: { label: 'Owner', icon: Crown },
  editor: { label: 'Can edit', icon: Pencil },
  viewer: { label: 'Viewing', icon: Eye },
};

export default function ShareModal({ onClose }: { onClose: () => void }) {
  const p = useTheme();
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const isTablet = width >= 768;

  const status = useCollab((s) => s.status);
  const error = useCollab((s) => s.error);
  const roomId = useCollab((s) => s.roomId);
  const role = useCollab((s) => s.role);
  const access = useCollab((s) => s.access);
  const shareLink = useCollab((s) => s.shareLink);
  const inviteToken = useCollab((s) => s.inviteToken);
  const selfName = useCollab((s) => s.selfName);
  const peers = useCollab((s) => s.peers);
  const startShare = useCollab((s) => s.startShare);
  const join = useCollab((s) => s.join);
  const leave = useCollab((s) => s.leave);
  const setAccess = useCollab((s) => s.setAccess);

  const [joinCode, setJoinCode] = useState('');
  const [pickAccess, setPickAccess] = useState<CollabAccess>('edit');
  const [joinAccess, setJoinAccess] = useState<CollabAccess>('edit');
  const [recent, setRecent] = useState<RecentRoom[]>([]);
  const [copied, setCopied] = useState(false);

  const configured = isSupabaseConfigured();
  const live = status === 'live';
  const isOwner = role === 'owner';
  const peerList = Object.values(peers).sort((a, b) => a.ts - b.ts);

  useEffect(() => {
    loadRecentRooms().then(setRecent).catch(() => setRecent([]));
  }, [live, roomId]);

  const invite = async () => {
    if (!shareLink || !roomId) return;
    const label = access === 'view' ? 'view only' : 'can edit';
    const tokenLine = inviteToken ? `\nInvite token: ${inviteToken}` : '';
    await Share.share({
      message: `Join my NoteLawbs.Ai workspace (${label}).\nRoom: ${roomId}${tokenLine}\n\n${shareLink}`,
    }).catch(() => {});
  };

  const copyLink = async () => {
    if (!shareLink) return;
    try {
      await Share.share({ message: shareLink });
      setCopied(true);
      setTimeout(() => setCopied(false), 1600);
    } catch {
      /* cancelled */
    }
  };

  const joinRecent = (r: RecentRoom) => {
    if (r.shareLink) void join(r.shareLink);
    else void join(r.roomId, r.access);
  };

  return (
    <View style={[StyleSheet.absoluteFill, styles.backdrop]}>
      <Pressable style={StyleSheet.absoluteFill} onPress={onClose} />
      <View
        style={[
          styles.sheet,
          {
            backgroundColor: p.bg,
            borderColor: p.border,
            marginTop: insets.top + 40,
            maxWidth: isTablet ? 480 : 520,
          },
          ELEVATION.panel,
        ]}>
        <Aurora />
        <View style={styles.header}>
          <View style={styles.headerTitleRow}>
            <Users size={18} color={p.accent} />
            <Text style={[styles.title, { color: p.text }]}>Live share</Text>
          </View>
          <Pressable accessibilityLabel="Close" onPress={onClose} style={[styles.closeBtn, { borderColor: p.border }]}>
            <X size={18} color={p.text} />
          </Pressable>
        </View>

        <ScrollView
          contentContainerStyle={{ padding: 20, paddingBottom: insets.bottom + 28, gap: 16 }}
          showsVerticalScrollIndicator={false}>
          {!configured ? (
            <View style={[styles.notice, { backgroundColor: p.surface, borderColor: p.border }]}>
              <Text style={[styles.noticeTitle, { color: p.text }]}>Connect a sync backend</Text>
              <Text style={[styles.noticeBody, { color: p.textMuted }]}>
                Live sharing runs on Supabase Realtime. Add your Supabase URL and anon key in
                Settings → Advanced → Backend, then reopen this panel.
              </Text>
            </View>
          ) : live ? (
            <>
              <View style={[styles.roomCard, { backgroundColor: p.surface, borderColor: p.border }]}>
                <Text style={[styles.roomLabel, { color: p.textMuted }]}>ROOM CODE</Text>
                <Text style={[styles.roomCode, { color: p.text }]}>{roomId}</Text>
                {inviteToken ? (
                  <>
                    <Text style={[styles.roomLabel, { color: p.textMuted, marginTop: 12 }]}>
                      INVITE TOKEN
                    </Text>
                    <Text style={[styles.token, { color: p.accent }]} selectable>
                      {inviteToken}
                    </Text>
                  </>
                ) : null}
                <Text style={[styles.roomLink, { color: p.textMid }]} numberOfLines={2} selectable>
                  {shareLink}
                </Text>
              </View>

              <View style={{ flexDirection: 'row', gap: 8 }}>
                <View style={{ flex: 1 }}>
                  <AppButton label="Invite people" onPress={invite} leading={<Link2 size={17} color="#fff" />} full />
                </View>
                <View style={{ flex: 1 }}>
                  <AppButton
                    label={copied ? 'Copied' : 'Copy link'}
                    variant="secondary"
                    onPress={copyLink}
                    leading={<Copy size={17} color={p.text} />}
                    full
                  />
                </View>
              </View>

              {isOwner && (
                <View style={{ gap: 8 }}>
                  <Text style={[styles.sectionLabel, { color: p.textMuted }]}>PEOPLE JOIN AS</Text>
                  <Segmented
                    options={[
                      { key: 'edit', label: 'Can edit' },
                      { key: 'view', label: 'Can view' },
                    ]}
                    value={access}
                    onChange={(k) => setAccess(k as CollabAccess)}
                  />
                  <Text style={[styles.hint, { color: p.textMuted }]}>
                    Regenerates the invite link for new joiners. Existing peers keep their current role.
                  </Text>
                </View>
              )}

              <View style={{ gap: 8 }}>
                <Text style={[styles.sectionLabel, { color: p.textMuted }]}>
                  IN THIS SESSION · {peerList.length + 1}
                </Text>
                <Participant name={`${selfName || 'You'} (you)`} role={role} color={p.accent} p={p} />
                {peerList.map((peer) => (
                  <Participant key={peer.id} name={peer.name} role={peer.role} color={peer.color} p={p} />
                ))}
              </View>

              <AppButton
                label={isOwner ? 'Stop sharing' : 'Leave session'}
                variant="secondary"
                tone={p.danger}
                onPress={async () => {
                  await leave();
                  onClose();
                }}
                full
              />
            </>
          ) : (
            <>
              <Text style={[styles.lead, { color: p.textMid }]}>
                Share this workspace live. Invite links include a room code and a private token so
                people join with the right access — edit or view-only.
              </Text>

              <View style={{ gap: 8 }}>
                <Text style={[styles.sectionLabel, { color: p.textMuted }]}>WHEN I START, PEOPLE CAN</Text>
                <Segmented
                  options={[
                    { key: 'edit', label: 'Edit with me' },
                    { key: 'view', label: 'View only' },
                  ]}
                  value={pickAccess}
                  onChange={(k) => setPickAccess(k as CollabAccess)}
                />
              </View>

              <AppButton
                label="Start live session"
                onPress={() => startShare(pickAccess)}
                loading={status === 'connecting'}
                leading={<Radio size={17} color="#fff" />}
                full
              />

              {recent.length > 0 && (
                <View style={{ gap: 8 }}>
                  <View style={styles.recentHeader}>
                    <Text style={[styles.sectionLabel, { color: p.textMuted }]}>PREVIOUSLY CONNECTED</Text>
                    <Pressable
                      onPress={async () => {
                        await clearRecentRooms();
                        setRecent([]);
                      }}>
                      <Text style={{ color: p.accent, fontSize: 12, fontWeight: '600' }}>Clear</Text>
                    </Pressable>
                  </View>
                  {recent.slice(0, 6).map((r) => (
                    <Pressable
                      key={`${r.roomId}-${r.lastJoinedAt}`}
                      onPress={() => joinRecent(r)}
                      style={[styles.recentRow, { backgroundColor: p.surface, borderColor: p.border }]}>
                      <Clock size={16} color={p.textMuted} />
                      <View style={{ flex: 1 }}>
                        <Text style={{ color: p.text, fontWeight: '700', fontSize: 14 }} numberOfLines={1}>
                          {r.title || r.roomId}
                        </Text>
                        <Text style={{ color: p.textMuted, fontSize: 11 }}>
                          {r.roomId} · {r.access === 'view' ? 'view' : 'edit'} ·{' '}
                          {new Date(r.lastJoinedAt).toLocaleDateString()}
                        </Text>
                      </View>
                      <LogIn size={16} color={p.accent} />
                    </Pressable>
                  ))}
                </View>
              )}

              <View style={styles.dividerRow}>
                <View style={[styles.hr, { backgroundColor: p.border }]} />
                <Text style={[styles.dividerText, { color: p.textMuted }]}>or join with code / link</Text>
                <View style={[styles.hr, { backgroundColor: p.border }]} />
              </View>

              <Field
                label="Room code or invite link"
                value={joinCode}
                onChangeText={setJoinCode}
                placeholder="K7P2QX or litnotes://join/…"
                autoCapitalize="none"
              />
              {!joinCode.includes('/join/') && (
                <View style={{ gap: 8 }}>
                  <Text style={[styles.sectionLabel, { color: p.textMuted }]}>JOIN AS (code only)</Text>
                  <Segmented
                    options={[
                      { key: 'edit', label: 'Editor' },
                      { key: 'view', label: 'Viewer' },
                    ]}
                    value={joinAccess}
                    onChange={(k) => setJoinAccess(k as CollabAccess)}
                  />
                </View>
              )}
              <AppButton
                label="Join session"
                variant="secondary"
                onPress={() =>
                  joinCode.trim() &&
                  join(
                    joinCode.trim(),
                    joinCode.includes('/join/') ? undefined : joinAccess,
                  )
                }
                leading={<LogIn size={17} color={p.text} />}
                full
              />

              {error ? (
                <View style={[styles.errorBox, { backgroundColor: p.accentSoft, borderColor: p.danger }]}>
                  <Text style={{ color: p.danger, fontSize: 13 }}>{error}</Text>
                </View>
              ) : null}
            </>
          )}
        </ScrollView>
      </View>
    </View>
  );
}

function Participant({
  name,
  role,
  color,
  p,
}: {
  name: string;
  role: CollabRole;
  color: string;
  p: ReturnType<typeof useTheme>;
}) {
  const Meta = ROLE_META[role];
  const Icon = Meta.icon;
  return (
    <View style={[styles.peer, { borderColor: p.border, backgroundColor: p.surface }]}>
      <View style={[styles.avatar, { backgroundColor: color }]} />
      <Text style={[styles.peerName, { color: p.text }]} numberOfLines={1}>
        {name}
      </Text>
      <View style={styles.roleChip}>
        <Icon size={12} color={p.textMuted} />
        <Text style={{ color: p.textMuted, fontSize: 11, fontWeight: '600' }}>{Meta.label}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  backdrop: { backgroundColor: 'rgba(10,12,18,0.45)', alignItems: 'center', justifyContent: 'flex-start' },
  sheet: {
    width: '92%',
    borderRadius: RADIUS.xl,
    borderWidth: StyleSheet.hairlineWidth,
    overflow: 'hidden',
    maxHeight: '88%',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 18,
    paddingTop: 16,
    paddingBottom: 8,
  },
  headerTitleRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  title: { fontSize: 18, fontWeight: '800', letterSpacing: -0.3 },
  closeBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    borderWidth: StyleSheet.hairlineWidth,
    alignItems: 'center',
    justifyContent: 'center',
  },
  lead: { fontSize: 14, lineHeight: 20 },
  sectionLabel: { fontSize: 11, fontWeight: '700', letterSpacing: 0.6 },
  hint: { fontSize: 12, lineHeight: 17 },
  roomCard: { borderRadius: RADIUS.lg, borderWidth: StyleSheet.hairlineWidth, padding: 16 },
  roomLabel: { fontSize: 10, fontWeight: '700', letterSpacing: 0.8 },
  roomCode: { fontSize: 28, fontWeight: '800', letterSpacing: 3, marginTop: 4 },
  token: { fontSize: 16, fontWeight: '700', letterSpacing: 1, marginTop: 4, fontVariant: ['tabular-nums'] },
  roomLink: { fontSize: 11, marginTop: 10, lineHeight: 16 },
  notice: { borderRadius: RADIUS.lg, borderWidth: StyleSheet.hairlineWidth, padding: 14, gap: 6 },
  noticeTitle: { fontSize: 15, fontWeight: '700' },
  noticeBody: { fontSize: 13, lineHeight: 19 },
  dividerRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  hr: { flex: 1, height: StyleSheet.hairlineWidth },
  dividerText: { fontSize: 11, fontWeight: '600' },
  errorBox: { borderRadius: RADIUS.md, borderWidth: 1, padding: 12 },
  peer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: RADIUS.md,
    borderWidth: StyleSheet.hairlineWidth,
  },
  avatar: { width: 10, height: 10, borderRadius: 5 },
  peerName: { flex: 1, fontSize: 14, fontWeight: '600' },
  roleChip: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  recentHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  recentRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    padding: 12,
    borderRadius: RADIUS.md,
    borderWidth: StyleSheet.hairlineWidth,
  },
});
