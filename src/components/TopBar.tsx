import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Alert } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Search, Sparkles, Link2, MoreHorizontal, ChevronLeft } from 'lucide-react-native';
import { useStore } from '../store';
import { useCollab } from '../collab/collabStore';
import { getPalette, useTheme, RADIUS, TYPE, SANS } from '../theme';
import { GlassView } from './ui';
import PresencePips from './PresencePips';

export default function TopBar({
  onHome,
  onResearch,
  onTranslate,
  onSearch,
  onBookmarks,
  onAnnotations,
  onExport,
  onShare,
  onSettings,
  researchOpen,
  bookmarksOpen,
  annotationsOpen,
}: {
  onHome: () => void;
  onResearch: () => void;
  onTranslate?: () => void;
  onSearch: () => void;
  onBookmarks: () => void;
  onAnnotations?: () => void;
  onExport: () => void;
  onShare: () => void;
  onSettings: () => void;
  researchOpen: boolean;
  bookmarksOpen: boolean;
  annotationsOpen?: boolean;
  showActions?: boolean;
}) {
  const insets = useSafeAreaInsets();
  const p = useTheme();
  const threadsOn = useStore((s) => s.threadsOn);
  const toggleThreads = useStore((s) => s.toggleThreads);
  const projectTitle = useStore((s) => s.projectTitle);
  const docName = useStore((s) => s.docName);
  const collabLive = useCollab((c) => c.status === 'live');
  const s = styles(p);
  const title = projectTitle || (docName ? docName.replace(/\.pdf$/i, '') : 'Untitled');

  const openMore = () => {
    const buttons: Array<{ text: string; onPress?: () => void; style?: 'cancel' | 'destructive' }> = [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Index / bookmarks', onPress: onBookmarks },
    ];
    if (onAnnotations) buttons.push({ text: 'Marks', onPress: onAnnotations });
    buttons.push({ text: 'Research', onPress: onResearch });
    if (onTranslate) buttons.push({ text: 'Translate to English', onPress: onTranslate });
    buttons.push({ text: 'Share workspace', onPress: onShare });
    buttons.push({ text: 'Export…', onPress: onExport });
    buttons.push({ text: 'Settings', onPress: onSettings });
    Alert.alert('More', undefined, buttons);
  };

  return (
    <GlassView style={{ zIndex: 100, paddingTop: insets.top }}>
      <View style={s.row}>
        <TouchableOpacity
          accessibilityLabel="Projects"
          onPress={onHome}
          activeOpacity={0.65}
          style={s.backBtn}
          hitSlop={8}>
          <ChevronLeft size={22} color={p.tint} strokeWidth={2.2} />
          <Text style={[s.backText, { color: p.tint }]}>Projects</Text>
        </TouchableOpacity>

        <View style={s.center}>
          <Text style={s.title} numberOfLines={1}>
            {title}
          </Text>
        </View>

        <View style={s.trailing}>
          {collabLive ? (
            <TouchableOpacity onPress={onShare} style={s.iconBtn} accessibilityLabel="Live presence">
              <PresencePips />
            </TouchableOpacity>
          ) : null}
          <IconBtn
            icon={Search}
            label="Search"
            onPress={onSearch}
            p={p}
          />
          <IconBtn
            icon={Link2}
            label="Threads"
            onPress={toggleThreads}
            p={p}
            active={threadsOn}
            tone={p.iris}
          />
          <IconBtn
            icon={Sparkles}
            label="Research"
            onPress={onResearch}
            p={p}
            active={researchOpen}
            tone={p.ai}
          />
          <IconBtn
            icon={MoreHorizontal}
            label="More"
            onPress={openMore}
            p={p}
            active={bookmarksOpen || !!annotationsOpen}
          />
        </View>
      </View>
      <View style={[s.hairline, { backgroundColor: p.separator }]} />
    </GlassView>
  );
}

function IconBtn({
  icon: Icon,
  onPress,
  label,
  p,
  active,
  tone,
}: {
  icon: React.ComponentType<any>;
  onPress: () => void;
  label: string;
  p: ReturnType<typeof getPalette>;
  active?: boolean;
  tone?: string;
}) {
  const color = active ? tone || p.tint : p.textMid;
  return (
    <TouchableOpacity
      accessibilityLabel={label}
      onPress={onPress}
      activeOpacity={0.65}
      style={[styles(p).iconBtn, active && { backgroundColor: (tone || p.tint) + '18' }]}>
      <Icon size={20} color={color} strokeWidth={2} />
    </TouchableOpacity>
  );
}

const styles = (p: ReturnType<typeof getPalette>) =>
  StyleSheet.create({
    row: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: 10,
      paddingVertical: 6,
      minHeight: 48,
      gap: 4,
    },
    backBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      marginLeft: -4,
      paddingRight: 4,
      maxWidth: 110,
    },
    center: { flex: 1, alignItems: 'center', paddingHorizontal: 6, minWidth: 0 },
    trailing: { flexDirection: 'row', alignItems: 'center', gap: 2 },
    backText: { fontSize: 17, fontWeight: '400', fontFamily: SANS, marginLeft: -2 },
    title: {
      ...TYPE.headline,
      fontSize: 17,
      fontWeight: '600',
      color: p.text,
      textAlign: 'center',
      letterSpacing: -0.3,
    },
    iconBtn: {
      width: 40,
      height: 36,
      borderRadius: RADIUS.sm,
      alignItems: 'center',
      justifyContent: 'center',
    },
    hairline: { height: StyleSheet.hairlineWidth },
  });
