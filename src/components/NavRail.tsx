import React from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import { GitBranch, Search, BookMarked, Sparkles, Download, Share2, Settings } from 'lucide-react-native';
import { useStore } from '../store';
import { useCollab } from '../collab/collabStore';
import { useTheme, RADIUS, glow } from '../theme';

export default function NavRail({
  onSearch,
  onResearch,
  onBookmarks,
  onExport,
  onShare,
  onSettings,
  researchOpen,
  bookmarksOpen,
}: {
  onSearch: () => void;
  onResearch: () => void;
  onBookmarks: () => void;
  onExport: () => void;
  onShare: () => void;
  onSettings: () => void;
  researchOpen: boolean;
  bookmarksOpen: boolean;
}) {
  const p = useTheme();
  const threadsOn = useStore((s) => s.threadsOn);
  const toggleThreads = useStore((s) => s.toggleThreads);
  const collabLive = useCollab((s) => s.status === 'live');

  return (
    <View style={[styles.rail, { backgroundColor: p.surface, borderRightColor: p.border }]}>
      <View style={styles.group}>
        <RailBtn icon={GitBranch} label="Threads" active={threadsOn} onPress={toggleThreads} p={p} />
        <RailBtn icon={Search} label="Search" onPress={onSearch} p={p} />
        <RailBtn icon={BookMarked} label="Index" active={bookmarksOpen} onPress={onBookmarks} p={p} />
        <RailBtn icon={Sparkles} label="Research" active={researchOpen} onPress={onResearch} p={p} tint={p.ai} />
        <RailBtn icon={Share2} label="Share" active={collabLive} onPress={onShare} p={p} tint={p.success} />
        <RailBtn icon={Download} label="Export" onPress={onExport} p={p} />
      </View>
      <View style={styles.group}>
        <RailBtn icon={Settings} label="Settings" onPress={onSettings} p={p} />
      </View>
    </View>
  );
}

function RailBtn({
  icon: Icon,
  label,
  active,
  onPress,
  p,
  tint,
}: {
  icon: React.ComponentType<any>;
  label: string;
  active?: boolean;
  onPress: () => void;
  p: ReturnType<typeof useTheme>;
  tint?: string;
}) {
  const accent = tint || p.accent;
  return (
    <Pressable
      accessibilityLabel={label}
      onPress={onPress}
      style={({ pressed }) => [
        styles.btn,
        { transform: [{ scale: pressed ? 0.94 : 1 }] },
      ]}>
      <View
        style={[
          styles.iconWrap,
          active && { backgroundColor: p.accentSoft, borderColor: accent },
          active && glow(accent, 0.25),
        ]}>
        <Icon size={20} color={active ? accent : p.textMid} strokeWidth={2.1} />
      </View>
      <Text style={[styles.label, { color: active ? accent : p.textMuted }]} numberOfLines={1}>
        {label}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  rail: {
    width: 76,
    borderRightWidth: 1,
    paddingVertical: 12,
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  group: { alignItems: 'center', gap: 6, width: '100%' },
  btn: { alignItems: 'center', width: '100%', paddingVertical: 4, gap: 3 },
  iconWrap: {
    width: 46,
    height: 40,
    borderRadius: RADIUS.md,
    borderWidth: 1,
    borderColor: 'transparent',
    alignItems: 'center',
    justifyContent: 'center',
  },
  label: { fontSize: 10, fontWeight: '600', letterSpacing: 0.2 },
});
