import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Alert, Pressable } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Search, MessageSquare, MoreHorizontal, ChevronLeft, FileText } from 'lucide-react-native';
import { useStore } from '../store';
import { useCollab } from '../collab/collabStore';
import { getPalette, useTheme, RADIUS, TYPE, ICON_SIZE } from '../theme';
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
  const project = projectTitle || 'Project';
  const document = docName ? docName.replace(/\.pdf$/i, '') : 'Untitled';

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
    <View style={{ zIndex: 100, paddingTop: insets.top, backgroundColor: p.bg }}>
      <View style={s.row}>
        <TouchableOpacity
          accessibilityLabel="Projects"
          onPress={onHome}
          activeOpacity={0.65}
          style={s.backBtn}
          hitSlop={8}>
          <ChevronLeft size={20} color={p.textMid} strokeWidth={1.5} />
        </TouchableOpacity>

        <View style={s.crumb}>
          <FileText size={ICON_SIZE} color={p.textMuted} strokeWidth={1.5} />
          <Text style={s.crumbMuted} numberOfLines={1}>
            {project}
          </Text>
          <Text style={s.crumbSep}>/</Text>
          <Text style={s.crumbTitle} numberOfLines={1}>
            {document}
          </Text>
        </View>

        <View style={s.trailing}>
          {collabLive ? (
            <TouchableOpacity onPress={onShare} style={s.iconBtn} accessibilityLabel="Live presence">
              <PresencePips />
            </TouchableOpacity>
          ) : null}
          <IconBtn icon={Search} label="Search" onPress={onSearch} p={p} />
          <IconBtn
            icon={MessageSquare}
            label="Threads"
            onPress={toggleThreads}
            p={p}
            active={threadsOn}
          />
          <IconBtn
            icon={MoreHorizontal}
            label="More"
            onPress={openMore}
            p={p}
            active={bookmarksOpen || !!annotationsOpen || researchOpen}
          />
        </View>
      </View>
      <View style={[s.hairline, { backgroundColor: p.separator }]} />
    </View>
  );
}

function IconBtn({
  icon: Icon,
  onPress,
  label,
  p,
  active,
}: {
  icon: React.ComponentType<any>;
  onPress: () => void;
  label: string;
  p: ReturnType<typeof getPalette>;
  active?: boolean;
}) {
  return (
    <Pressable
      accessibilityLabel={label}
      onPress={onPress}
      style={({ pressed }) => [
        styles(p).iconBtn,
        (pressed || active) && { backgroundColor: p.hover },
      ]}>
      <Icon size={ICON_SIZE} color={active ? p.text : p.textMuted} strokeWidth={1.5} />
    </Pressable>
  );
}

const styles = (p: ReturnType<typeof getPalette>) =>
  StyleSheet.create({
    row: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: 8,
      paddingVertical: 4,
      minHeight: 44,
      gap: 4,
    },
    backBtn: {
      width: 32,
      height: 32,
      alignItems: 'center',
      justifyContent: 'center',
      borderRadius: RADIUS.md,
    },
    crumb: {
      flex: 1,
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      minWidth: 0,
      paddingHorizontal: 4,
    },
    crumbMuted: {
      ...TYPE.subhead,
      color: p.textMid,
      flexShrink: 1,
    },
    crumbSep: {
      ...TYPE.subhead,
      color: p.textMuted,
    },
    crumbTitle: {
      ...TYPE.subhead,
      fontWeight: '500',
      color: p.text,
      flexShrink: 1,
    },
    trailing: { flexDirection: 'row', alignItems: 'center', gap: 0 },
    iconBtn: {
      width: 32,
      height: 32,
      borderRadius: RADIUS.md,
      alignItems: 'center',
      justifyContent: 'center',
    },
    hairline: { height: StyleSheet.hairlineWidth },
  });
