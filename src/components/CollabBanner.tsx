import React, { useState } from 'react';
import { View, Text, StyleSheet, Pressable } from 'react-native';
import { Eye, Radio, Loader, X } from 'lucide-react-native';
import { useTheme, ICON_SIZE } from '../theme';
import { useCollab } from '../collab/collabStore';

export default function CollabBanner() {
  const p = useTheme();
  const status = useCollab((s) => s.status);
  const role = useCollab((s) => s.role);
  const peerCount = useCollab((s) => Object.keys(s.peers).length);
  const [dismissed, setDismissed] = useState(false);

  if (status === 'off' || dismissed) return null;

  let bg = p.successSoft;
  let fg = p.success;
  let Icon = Radio;
  let text = 'Live — everyone sees your changes in real time';

  if (status === 'connecting') {
    bg = p.tintSoft;
    fg = p.tint;
    Icon = Loader;
    text = 'Connecting to live session…';
  } else if (status === 'error') {
    bg = '#FFE2DD';
    fg = p.danger;
    Icon = Eye;
    text = useCollab.getState().error || 'Live session unavailable';
  } else if (role === 'viewer') {
    bg = p.tintSoft;
    fg = p.tint;
    Icon = Eye;
    text = 'View only — following the shared workspace';
  } else if (status === 'live') {
    text =
      peerCount > 0
        ? `Live — editing with ${peerCount} ${peerCount === 1 ? 'other' : 'others'}`
        : 'Live — waiting for people to join';
  }

  return (
    <View style={[styles.bar, { backgroundColor: bg, borderBottomColor: p.separator }]}>
      <Icon size={14} color={fg} strokeWidth={1.5} />
      <Text style={[styles.text, { color: fg }]} numberOfLines={1}>
        {text}
      </Text>
      <Pressable
        onPress={() => setDismissed(true)}
        hitSlop={8}
        accessibilityLabel="Dismiss"
        style={styles.dismiss}>
        <X size={ICON_SIZE} color={fg} strokeWidth={1.5} />
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  bar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 5,
    paddingHorizontal: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  text: { fontSize: 12, fontWeight: '500', flex: 1 },
  dismiss: { padding: 2 },
});
