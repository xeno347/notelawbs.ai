import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  ChevronLeft,
  ChevronRight,
  Search,
  Share2,
  Settings,
  SquareArrowOutUpRight,
  Sparkles,
  BookMarked,
  Link2,
  Highlighter,
} from 'lucide-react-native';
import { useStore } from '../store';
import { useCollab } from '../collab/collabStore';
import { useAnnotation } from '../annotationStore';
import { getPalette, useTheme, RADIUS, TYPE, SANS } from '../theme';
import { GlassView } from './ui';
import PresencePips from './PresencePips';

export default function TopBar({
  onHome,
  onResearch,
  onSearch,
  onBookmarks,
  onExport,
  onShare,
  onSettings,
  researchOpen,
  bookmarksOpen,
}: {
  onHome: () => void;
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
  const projectTitle = useStore((s) => s.projectTitle);
  const docName = useStore((s) => s.docName);
  const setCurrentPage = useStore((s) => s.setCurrentPage);
  const currentPage = useStore((s) => s.currentPage);
  const numPages = useStore((s) => s.numPages);
  const tool = useAnnotation((s) => s.tool);
  const setTool = useAnnotation((s) => s.setTool);
  const collabLive = useCollab((c) => c.status === 'live');
  const s = styles(p);
  const title = projectTitle || (docName ? docName.replace(/\.pdf$/i, '') : 'Untitled');
  const highlightOn = tool === 'select';

  return (
    <GlassView style={{ zIndex: 100, paddingTop: insets.top + 4 }}>
      <View style={s.row}>
        <View style={s.leading}>
          <NavBtn label="Library" onPress={onHome} p={p}>
            <Text style={[s.backText, { color: p.tint }]}>Projects</Text>
          </NavBtn>
        </View>

        <View style={s.center}>
          <Text style={s.title} numberOfLines={1}>
            {title}
          </Text>
          {numPages > 0 && (
            <Text style={s.subtitle}>
              Page {currentPage} of {numPages}
            </Text>
          )}
        </View>

        <View style={s.trailing}>
          {collabLive && (
            <TouchableOpacity onPress={onShare} style={s.iconBtn}>
              <PresencePips />
            </TouchableOpacity>
          )}
          <NavIcon icon={Settings} label="Settings" onPress={onSettings} p={p} />
        </View>
      </View>

      <View style={s.toolbar}>
        <ToolCluster p={p}>
          <NavIcon
            icon={ChevronLeft}
            label="Previous page"
            onPress={() => setCurrentPage(Math.max(1, currentPage - 1))}
            p={p}
            disabled={!docName || currentPage <= 1}
          />
          <NavIcon
            icon={ChevronRight}
            label="Next page"
            onPress={() => setCurrentPage(Math.min(numPages || currentPage + 1, currentPage + 1))}
            p={p}
            disabled={!docName || (numPages > 0 && currentPage >= numPages)}
          />
        </ToolCluster>

        <TouchableOpacity
          style={[s.pillBtn, highlightOn && { backgroundColor: p.tint }]}
            onPress={() => setTool(highlightOn ? 'navigate' : 'select')}>
            <Highlighter size={15} color={highlightOn ? '#fff' : p.tint} strokeWidth={2.2} />
            <Text style={[s.pillText, { color: highlightOn ? '#fff' : p.tint }]}>Select</Text>
          </TouchableOpacity>

        <TouchableOpacity
          style={[s.pillBtn, threadsOn && { backgroundColor: p.irisSoft, borderColor: p.iris }]}
          onPress={toggleThreads}>
          <Link2 size={15} color={threadsOn ? p.iris : p.textMid} strokeWidth={2.2} />
          <Text style={[s.pillText, { color: threadsOn ? p.iris : p.textMid }]}>Threads</Text>
        </TouchableOpacity>

        <ToolCluster p={p}>
          <NavIcon icon={Search} label="Search" onPress={onSearch} p={p} />
          <NavIcon icon={BookMarked} label="Index" onPress={onBookmarks} p={p} active={bookmarksOpen} />
          <NavIcon icon={Sparkles} label="Research" onPress={onResearch} p={p} active={researchOpen} tone={p.ai} />
          <NavIcon icon={Share2} label="Share" onPress={onShare} p={p} active={collabLive} tone={p.success} />
          <NavIcon icon={SquareArrowOutUpRight} label="Export" onPress={onExport} p={p} />
        </ToolCluster>
      </View>
      <View style={[s.hairline, { backgroundColor: p.separator }]} />
    </GlassView>
  );
}

function ToolCluster({ children, p }: { children: React.ReactNode; p: ReturnType<typeof getPalette> }) {
  return <View style={[styles(p).cluster]}>{children}</View>;
}

function NavBtn({
  children,
  onPress,
  label,
  p,
}: {
  children: React.ReactNode;
  onPress: () => void;
  label: string;
  p: ReturnType<typeof getPalette>;
}) {
  return (
    <TouchableOpacity accessibilityLabel={label} onPress={onPress} activeOpacity={0.65} style={styles(p).navBtn}>
      {children}
    </TouchableOpacity>
  );
}

function NavIcon({
  icon: Icon,
  onPress,
  label,
  p,
  active,
  disabled,
  tone,
}: {
  icon: React.ComponentType<any>;
  onPress: () => void;
  label: string;
  p: ReturnType<typeof getPalette>;
  active?: boolean;
  disabled?: boolean;
  tone?: string;
}) {
  const color = active ? (tone || p.tint) : p.textMid;
  return (
    <TouchableOpacity
      accessibilityLabel={label}
      onPress={onPress}
      disabled={disabled}
      activeOpacity={0.65}
      style={[
        styles(p).iconBtn,
        active && { backgroundColor: p.tintSoft },
        disabled && { opacity: 0.35 },
      ]}>
      <Icon size={18} color={color} strokeWidth={2} />
    </TouchableOpacity>
  );
}

const styles = (p: ReturnType<typeof getPalette>) =>
  StyleSheet.create({
    bar: {},
    row: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: 16,
      minHeight: 44,
    },
    leading: { width: 88, alignItems: 'flex-start' },
    center: { flex: 1, alignItems: 'center', paddingHorizontal: 8 },
    trailing: { width: 88, flexDirection: 'row', justifyContent: 'flex-end', gap: 4 },
    backText: { ...TYPE.body, fontSize: 17, fontWeight: '400' },
    title: { ...TYPE.headline, color: p.text, textAlign: 'center' },
    subtitle: { ...TYPE.caption2, color: p.textMid, marginTop: 1 },
    toolbar: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      flexWrap: 'wrap',
      gap: 8,
      paddingHorizontal: 12,
      paddingBottom: 10,
      paddingTop: 4,
    },
    cluster: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: p.fillSecondary,
      borderRadius: RADIUS.sm,
      padding: 3,
      gap: 2,
    },
    iconBtn: {
      width: 36,
      height: 32,
      borderRadius: 8,
      alignItems: 'center',
      justifyContent: 'center',
    },
    navBtn: { paddingVertical: 6, paddingHorizontal: 2 },
    pillBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 5,
      paddingHorizontal: 12,
      paddingVertical: 7,
      borderRadius: RADIUS.pill,
      backgroundColor: p.fillSecondary,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: 'transparent',
    },
    pillText: { fontSize: 13, fontWeight: '600', fontFamily: SANS },
    hairline: {
      height: StyleSheet.hairlineWidth,
      marginHorizontal: 0,
    },
  });
