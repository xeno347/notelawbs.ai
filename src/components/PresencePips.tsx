import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useTheme } from '../theme';
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
    <View style={styles.wrap}>
      <View style={styles.avatars}>
        <Avatar label={initials(selfName || 'You')} color={p.tint} border={p.bg} />
        {shown.map((peer) => (
          <Avatar key={peer.id} label={initials(peer.name)} color={peer.color} border={p.bg} />
        ))}
        {extra > 0 && <Avatar label={`+${extra}`} color={p.textMuted} border={p.bg} />}
      </View>
    </View>
  );
}

function Avatar({ label, color, border }: { label: string; color: string; border: string }) {
  return (
    <View style={[styles.avatar, { backgroundColor: color, borderColor: border }]}>
      <Text style={styles.avatarText}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 2,
  },
  avatars: { flexDirection: 'row', paddingLeft: 8 },
  avatar: {
    width: 24,
    height: 24,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.5,
    marginLeft: -8,
  },
  avatarText: { color: '#fff', fontSize: 9, fontWeight: '600' },
});
