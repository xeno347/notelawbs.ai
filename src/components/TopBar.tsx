import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ScrollView } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { BlurView } from '@react-native-community/blur';
import { GitBranch, Sparkles, Search, BookMarked, Download, Share2, Settings } from 'lucide-react-native';
import { useStore } from '../store';
import { useCollab } from '../collab/collabStore';
import { getPalette, useTheme, RADIUS } from '../theme';
import PresencePips from './PresencePips';

export default function TopBar({
  onResearch,
  onSearch,
  onBookmarks,
  onExport,
  onShare,
  onSettings,
  researchOpen,
  bookmarksOpen,
  showActions = true,
}: {
  onResearch: () => void;
  onSearch: () => void;
  onBookmarks: () => void;
  onExport: () => void;
  onShare: () => void;
  onSettings: () => void;
  researchOpen: boolean;
  bookmarksOpen: boolean;
  showActions?: boolean;
}) {
  const insets = useSafeAreaInsets();
  const p = useTheme();
  const threadsOn = useStore((s) => s.threadsOn);
  const toggleThreads = useStore((s) => s.toggleThreads);
  const docName = useStore((s) => s.docName);
  const collabLive = useCollab((c) => c.status === 'live');

  const s = styles(p);

  return (
    <View style={[s.bar, { paddingTop: insets.top + 8 }]}>
      <BlurView style={StyleSheet.absoluteFill} blurType={p.blurType} blurAmount={20} reducedTransparencyFallbackColor={p.topbar} />
      <View style={[StyleSheet.absoluteFill, { backgroundColor: p.topbar }]} />

      <View style={s.row}>
        <View style={s.spine} />
        <View style={s.brandWrap}>
          <Text style={s.brand}>
            LitNotes<Text style={s.brandLight}> Canvas</Text>
          </Text>
          <Text style={s.note} numberOfLines={1}>
            {docName || 'Single-user prototype · everything stays on this machine'}
          </Text>
        </View>

        {collabLive && (
          <TouchableOpacity onPress={onShare} accessibilityLabel="Live session">
            <PresencePips />
          </TouchableOpacity>
        )}

        {showActions && (
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.actions}>
            <IconBtn icon={GitBranch} label="Threads" active={threadsOn} onPress={toggleThreads} p={p} />
            <IconBtn icon={Search} label="Search" onPress={onSearch} p={p} />
            <IconBtn icon={BookMarked} label="Index" active={bookmarksOpen} onPress={onBookmarks} p={p} />
            <IconBtn icon={Sparkles} label="Research" active={researchOpen} onPress={onResearch} p={p} accent={p.ai} />
            <IconBtn icon={Share2} label="Share" active={collabLive} onPress={onShare} p={p} accent={p.success} />
            <IconBtn icon={Download} label="Export" onPress={onExport} p={p} />
            <IconBtn icon={Settings} label="Settings" onPress={onSettings} p={p} />
          </ScrollView>
        )}
      </View>
    </View>
  );
}

function IconBtn({
  icon: Icon,
  label,
  active,
  onPress,
  p,
  accent,
}: {
  icon: React.ComponentType<any>;
  label: string;
  active?: boolean;
  onPress: () => void;
  p: ReturnType<typeof getPalette>;
  accent?: string;
}) {
  const s = styles(p);
  const activeColor = accent || p.accent;
  return (
    <TouchableOpacity
      accessibilityLabel={label}
      style={[s.btn, active && { backgroundColor: activeColor, borderColor: activeColor }]}
      onPress={onPress}>
      <Icon size={15} color={active ? '#fff' : p.topbarText} strokeWidth={2.1} />
      <Text style={[s.btnText, active && s.btnTextActive]}>{label}</Text>
    </TouchableOpacity>
  );
}

const styles = (p: ReturnType<typeof getPalette>) =>
  StyleSheet.create({
    bar: {
      paddingHorizontal: 14,
      paddingBottom: 10,
      zIndex: 100,
      borderBottomWidth: 1,
      borderBottomColor: 'rgba(255,255,255,0.06)',
    },
    row: { flexDirection: 'row', alignItems: 'center', gap: 10 },
    spine: {
      width: 5,
      height: 22,
      borderRadius: 1.5,
      backgroundColor: p.accent,
    },
    brandWrap: { minWidth: 0, maxWidth: 170 },
    brand: { color: p.topbarText, fontSize: 17, fontWeight: '800', letterSpacing: 0.2 },
    brandLight: { color: '#9AA7B3', fontWeight: '400' },
    note: { color: p.topbarMuted, fontSize: 10.5, marginTop: 1 },
    actions: { flexDirection: 'row', gap: 6, alignItems: 'center', paddingLeft: 4 },
    btn: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      paddingHorizontal: 11,
      paddingVertical: 7,
      borderRadius: RADIUS.pill,
      borderWidth: 1,
      borderColor: 'rgba(242,244,241,0.24)',
      backgroundColor: 'rgba(255,255,255,0.04)',
    },
    btnText: { color: p.topbarText, fontSize: 11.5, fontWeight: '600' },
    btnTextActive: { color: '#fff' },
  });
