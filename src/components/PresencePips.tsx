import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useTheme, RADIUS } from '../theme';
import { useCollab } from '../collab/collabStore';

function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return '?';
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

export default function PresencePips({ max = 4 }: { max?: number }) {
  const p = useTheme();
  const peers = useCollab((s) => s.peers);
  const selfName = useCollab((s) => s.selfName);
  const list = Object.values(peers).sort((a, b) => a.ts - b.ts);
  const shown = list.slice(0, max);
  const extra = list.length - shown.length;

  return (
    <View style={[styles.wrap, { borderColor: p.glassBorder, backgroundColor: 'rgba(255,255,255,0.06)' }]}>
      <View style={[styles.liveDot, { backgroundColor: p.success }]} />
      <Text style={[styles.liveText, { color: p.topbarText }]}>Live</Text>
      <View style={styles.avatars}>
        <Avatar label={initials(selfName || 'You')} color={p.accent} you />
        {shown.map((peer) => (
          <Avatar key={peer.id} label={initials(peer.name)} color={peer.color} />
        ))}
        {extra > 0 && <Avatar label={`+${extra}`} color={p.textMuted} />}
      </View>
    </View>
  );
}

function Avatar({ label, color, you }: { label: string; color: string; you?: boolean }) {
  return (
    <View style={[styles.avatar, { backgroundColor: color, borderColor: you ? '#fff' : 'rgba(0,0,0,0.15)' }]}>
      <Text style={styles.avatarText}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 8,
    paddingVertical: 5,
    borderRadius: RADIUS.pill,
    borderWidth: 1,
  },
  liveDot: { width: 7, height: 7, borderRadius: 4 },
  liveText: { fontSize: 11, fontWeight: '700' },
  avatars: { flexDirection: 'row', marginLeft: 2 },
  avatar: {
    width: 22,
    height: 22,
    borderRadius: 11,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.5,
    marginLeft: -6,
  },
  avatarText: { color: '#fff', fontSize: 9.5, fontWeight: '800' },
});
