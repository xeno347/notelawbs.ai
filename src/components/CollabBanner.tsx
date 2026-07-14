import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Eye, Radio, Loader } from 'lucide-react-native';
import { useTheme } from '../theme';
import { useCollab } from '../collab/collabStore';

export default function CollabBanner() {
  const p = useTheme();
  const status = useCollab((s) => s.status);
  const role = useCollab((s) => s.role);
  const peerCount = useCollab((s) => Object.keys(s.peers).length);

  if (status === 'off') return null;

  let bg = p.successSoft;
  let fg = p.success;
  let Icon = Radio;
  let text = 'Live — everyone sees your changes in real time';

  if (status === 'connecting') {
    bg = p.accentSoft;
    fg = p.accent;
    Icon = Loader;
    text = 'Connecting to live session…';
  } else if (status === 'error') {
    bg = p.accentSoft;
    fg = p.danger;
    Icon = Eye;
    text = useCollab.getState().error || 'Live session unavailable';
  } else if (role === 'viewer') {
    bg = p.accentSoft;
    fg = p.accent;
    Icon = Eye;
    text = 'View only — following the shared workspace';
  } else if (status === 'live') {
    text =
      peerCount > 0
        ? `Live — editing with ${peerCount} ${peerCount === 1 ? 'other' : 'others'}`
        : 'Live — waiting for people to join';
  }

  return (
    <View style={[styles.bar, { backgroundColor: bg }]}>
      <Icon size={14} color={fg} />
      <Text style={[styles.text, { color: fg }]} numberOfLines={1}>
        {text}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  bar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 6,
    paddingHorizontal: 14,
  },
  text: { fontSize: 12.5, fontWeight: '700' },
});
