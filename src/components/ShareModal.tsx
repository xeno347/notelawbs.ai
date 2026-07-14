import React, { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable, Share, useWindowDimensions } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { X, Users, Radio, LogIn, Copy, Crown, Eye, Pencil } from 'lucide-react-native';
import { useTheme, RADIUS, ELEVATION } from '../theme';
import { useCollab, type CollabAccess, type CollabRole } from '../collab/collabStore';
import { isSupabaseConfigured } from '../services/supabase';
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
  const selfName = useCollab((s) => s.selfName);
  const peers = useCollab((s) => s.peers);
  const startShare = useCollab((s) => s.startShare);
  const join = useCollab((s) => s.join);
  const leave = useCollab((s) => s.leave);
  const setAccess = useCollab((s) => s.setAccess);

  const [joinCode, setJoinCode] = useState('');
  const [pickAccess, setPickAccess] = useState<CollabAccess>('edit');

  const configured = isSupabaseConfigured();
  const live = status === 'live';
  const isOwner = role === 'owner';

  const invite = async () => {
    if (!shareLink) return;
    const label = access === 'view' ? 'view' : 'edit';
    await Share.share({
      message: `Join my LitNotes Canvas workspace (${label}). Room code: ${roomId}\n${shareLink}`,
    }).catch(() => {});
  };

  const peerList = Object.values(peers).sort((a, b) => a.ts - b.ts);

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
            maxWidth: isTablet ? 460 : 520,
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
                Settings → Collaboration (or in supabaseConfig.ts), then reopen this panel to go
                live.
              </Text>
            </View>
          ) : live ? (
            <>
              <View style={[styles.roomCard, { backgroundColor: p.surface, borderColor: p.border }]}>
                <Text style={[styles.roomLabel, { color: p.textMuted }]}>ROOM CODE</Text>
                <Text style={[styles.roomCode, { color: p.text }]}>{roomId}</Text>
                <Text style={[styles.roomLink, { color: p.accent }]} numberOfLines={1}>
                  {shareLink}
                </Text>
              </View>

              <AppButton label="Invite people" onPress={invite} leading={<Copy size={17} color="#fff" />} full />

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
                    Applies to people who join from now on.
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
                Share this workspace live. Anyone with the link sees your canvas, threads and
                highlights update in real time — like a shared board.
              </Text>

              <View style={{ gap: 8 }}>
                <Text style={[styles.sectionLabel, { color: p.textMuted }]}>PEOPLE CAN</Text>
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

              <View style={styles.dividerRow}>
                <View style={[styles.hr, { backgroundColor: p.border }]} />
                <Text style={[styles.dividerText, { color: p.textMuted }]}>or join one</Text>
                <View style={[styles.hr, { backgroundColor: p.border }]} />
              </View>

              <Field
                label="Room code"
                value={joinCode}
                onChangeText={(t) => setJoinCode(t.toUpperCase())}
                placeholder="e.g. K7P2QX"
                autoCapitalize="characters"
              />
              <AppButton
                label="Join session"
                variant="secondary"
                onPress={() => joinCode.trim() && join(joinCode.trim(), 'edit')}
                leading={<LogIn size={17} color={p.text} />}
                full
              />

              {error ? (
                <View style={[styles.errorBox, { backgroundColor: p.accentSoft, borderColor: p.danger }]}>
                  <Text style={[styles.errorText, { color: p.danger }]}>{error}</Text>
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
  const meta = ROLE_META[role];
  const Icon = meta.icon;
  return (
    <View style={[styles.participant, { backgroundColor: p.surface, borderColor: p.border }]}>
      <View style={[styles.dot, { backgroundColor: color }]} />
      <Text style={[styles.pName, { color: p.text }]} numberOfLines={1}>
        {name}
      </Text>
      <View style={styles.roleTag}>
        <Icon size={13} color={p.textMuted} />
        <Text style={[styles.roleText, { color: p.textMuted }]}>{meta.label}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  backdrop: { backgroundColor: 'rgba(0,0,0,0.45)', zIndex: 300, alignItems: 'center' },
  sheet: {
    width: '92%',
    borderRadius: RADIUS.xl,
    borderWidth: 1,
    overflow: 'hidden',
    maxHeight: '82%',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 18,
    paddingTop: 16,
    paddingBottom: 12,
  },
  headerTitleRow: { flexDirection: 'row', alignItems: 'center', gap: 9 },
  title: { fontSize: 18, fontWeight: '800' },
  closeBtn: {
    width: 34,
    height: 34,
    borderRadius: RADIUS.pill,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  lead: { fontSize: 14, lineHeight: 21 },
  sectionLabel: { fontSize: 11, fontWeight: '800', letterSpacing: 0.7 },
  hint: { fontSize: 12, lineHeight: 16 },

  notice: { borderRadius: RADIUS.lg, borderWidth: 1, padding: 16, gap: 8 },
  noticeTitle: { fontSize: 15, fontWeight: '700' },
  noticeBody: { fontSize: 13, lineHeight: 19 },

  roomCard: { borderRadius: RADIUS.lg, borderWidth: 1, padding: 18, alignItems: 'center', gap: 4 },
  roomLabel: { fontSize: 11, fontWeight: '800', letterSpacing: 1 },
  roomCode: { fontSize: 34, fontWeight: '900', letterSpacing: 4 },
  roomLink: { fontSize: 12.5, marginTop: 4 },

  dividerRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  hr: { flex: 1, height: 1 },
  dividerText: { fontSize: 12 },

  participant: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    borderRadius: RADIUS.md,
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 11,
  },
  dot: { width: 10, height: 10, borderRadius: 5 },
  pName: { flex: 1, fontSize: 14, fontWeight: '600' },
  roleTag: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  roleText: { fontSize: 12, fontWeight: '600' },

  errorBox: { borderRadius: RADIUS.md, borderWidth: 1, padding: 12 },
  errorText: { fontSize: 13, fontWeight: '600' },
});
