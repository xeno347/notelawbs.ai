import React from 'react';
import { View, Text, Pressable, StyleSheet, Image } from 'react-native';
import {
  GitBranch,
  Search,
  BookMarked,
  Highlighter,
  Sparkles,
  Download,
  Share2,
  Settings,
} from 'lucide-react-native';
import { useStore } from '../store';
import { useCollab } from '../collab/collabStore';
import { useTheme, RADIUS, SIDEBAR_COMPACT_W, ICON_SIZE } from '../theme';

const LOGO = require('../assets/notelawbs-logo.png');

export default function NavRail({
  onSearch,
  onResearch,
  onBookmarks,
  onAnnotations,
  onExport,
  onShare,
  onSettings,
  researchOpen,
  bookmarksOpen,
  annotationsOpen,
}: {
  onSearch: () => void;
  onResearch: () => void;
  onBookmarks: () => void;
  onAnnotations: () => void;
  onExport: () => void;
  onShare: () => void;
  onSettings: () => void;
  researchOpen: boolean;
  bookmarksOpen: boolean;
  annotationsOpen: boolean;
}) {
  const p = useTheme();
  const threadsOn = useStore((s) => s.threadsOn);
  const toggleThreads = useStore((s) => s.toggleThreads);
  const collabLive = useCollab((s) => s.status === 'live');

  return (
    <View style={[styles.rail, { backgroundColor: p.sidebar, borderRightColor: p.border }]}>
      <View style={styles.group}>
        <Image source={LOGO} style={styles.logo} resizeMode="contain" accessibilityLabel="NoteLawbs.Ai" />
        <RailBtn icon={GitBranch} label="Threads" active={threadsOn} onPress={toggleThreads} p={p} />
        <RailBtn icon={Search} label="Search" onPress={onSearch} p={p} />
        <RailBtn icon={BookMarked} label="Index" active={bookmarksOpen} onPress={onBookmarks} p={p} />
        <RailBtn icon={Highlighter} label="Marks" active={annotationsOpen} onPress={onAnnotations} p={p} />
        <RailBtn icon={Sparkles} label="Research" active={researchOpen} onPress={onResearch} p={p} />
        <RailBtn icon={Share2} label="Share" active={collabLive} onPress={onShare} p={p} />
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
}: {
  icon: React.ComponentType<any>;
  label: string;
  active?: boolean;
  onPress: () => void;
  p: ReturnType<typeof useTheme>;
}) {
  return (
    <Pressable
      accessibilityLabel={label}
      onPress={onPress}
      style={({ pressed }) => [
        styles.btn,
        (active || pressed) && { backgroundColor: p.hover },
      ]}>
      <Icon size={ICON_SIZE} color={active ? p.text : p.textMuted} strokeWidth={1.5} />
      <Text style={[styles.label, { color: active ? p.text : p.textMuted }]} numberOfLines={1}>
        {label}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  rail: {
    width: SIDEBAR_COMPACT_W,
    borderRightWidth: StyleSheet.hairlineWidth,
    paddingVertical: 10,
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  logo: { width: 28, height: 28, marginBottom: 8 },
  group: { alignItems: 'center', gap: 2, width: '100%', paddingHorizontal: 6 },
  btn: {
    alignItems: 'center',
    width: '100%',
    paddingVertical: 8,
    gap: 2,
    borderRadius: RADIUS.md,
  },
  label: { fontSize: 9, fontWeight: '500' },
});
