import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  useWindowDimensions,
  PanResponder,
  Alert,
} from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { useStore } from './store';
import { useTheme, useThemeStore } from './theme';
import { useAuth } from './auth/authStore';
import { getSetting, setSetting } from './storage';
import TopBar from './components/TopBar';
import NavRail from './components/NavRail';
import PdfReader from './components/PdfReader';
import CanvasBoard from './components/CanvasBoard';
import ThreadLayer from './components/ThreadLayer';
import ResearchPanel from './components/ResearchPanel';
import SearchOverlay from './components/SearchOverlay';
import BookmarkPanel from './components/BookmarkPanel';
import SplashScreen from './components/SplashScreen';
import AuthScreen from './components/AuthScreen';
import PermissionsScreen from './components/PermissionsScreen';
import SettingsScreen from './components/SettingsScreen';
import OnboardingScreen from './components/OnboardingScreen';
import ShareModal from './components/ShareModal';
import CollabBanner from './components/CollabBanner';
import { exportCanvasSnapshot, exportNotesMarkdown } from './services/exportService';
import { useCollab, parseJoinUrl } from './collab/collabStore';
import { Linking } from 'react-native';

function Workspace() {
  const { width } = useWindowDimensions();
  const isTablet = width >= 768;
  const p = useTheme();

  const linking = useStore((s) => s.linking);
  const docName = useStore((s) => s.docName);
  const highlights = useStore((s) => s.highlights);
  const nodes = useStore((s) => s.nodes);
  const bookmarks = useStore((s) => s.bookmarks);

  const [researchOpen, setResearchOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [bookmarksOpen, setBookmarksOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [shareOpen, setShareOpen] = useState(false);
  const [showOnboarding, setShowOnboarding] = useState(false);
  const [tab, setTab] = useState<'reader' | 'canvas'>('reader');
  const [splitRatio, setSplitRatio] = useState(0.52);
  const [wsWidth, setWsWidth] = useState(0);
  const ratioStart = useRef(0.52);
  const canvasRef = useRef<View>(null);

  const dividerPan = useMemo(
    () =>
      PanResponder.create({
        onStartShouldSetPanResponder: () => true,
        onMoveShouldSetPanResponder: () => true,
        onPanResponderGrant: () => {
          ratioStart.current = splitRatio;
        },
        onPanResponderMove: (_e, g) => {
          if (!wsWidth) return;
          const next = ratioStart.current + g.dx / wsWidth;
          setSplitRatio(Math.min(0.75, Math.max(0.28, next)));
        },
      }),
    [splitRatio, wsWidth],
  );

  useEffect(() => {
    if (linking.active && linking.step === 'pdf' && !isTablet) {
      setTab('reader');
    }
  }, [linking, isTablet]);

  useEffect(() => {
    getSetting('onboarded').then((v) => {
      if (v !== '1') setShowOnboarding(true);
    });
  }, []);

  // Auto-join a live session from a shared deep link (litnotes://join/CODE?a=…).
  useEffect(() => {
    const tryJoin = (url: string | null) => {
      const parsed = url ? parseJoinUrl(url) : null;
      if (parsed) {
        useCollab.getState().join(parsed.roomId, parsed.access);
        setShareOpen(true);
      }
    };
    Linking.getInitialURL().then(tryJoin);
    const sub = Linking.addEventListener('url', (e) => tryJoin(e.url));
    return () => sub.remove();
  }, []);

  const dismissOnboarding = () => {
    setShowOnboarding(false);
    setSetting('onboarded', '1').catch(() => {});
  };

  const onExport = () => {
    Alert.alert('Export', 'What would you like to export?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Canvas snapshot (PNG)',
        onPress: () => {
          if (!canvasRef.current) {
            Alert.alert('Canvas not visible', 'Switch to the Canvas tab, then try exporting again.');
            return;
          }
          exportCanvasSnapshot(canvasRef, docName).catch(() => {
            Alert.alert('Export failed', 'Could not capture the canvas.');
          });
        },
      },
      {
        text: 'Notes & index (Markdown)',
        onPress: () => {
          exportNotesMarkdown({ docName, highlights, nodes, bookmarks }).catch(() => {
            Alert.alert('Export failed', 'Could not build the notes export.');
          });
        },
      },
    ]);
  };

  return (
    <View style={[styles.flex, { backgroundColor: p.bg }]}>
      <TopBar
        onResearch={() => setResearchOpen(true)}
        onSearch={() => setSearchOpen(true)}
        onBookmarks={() => setBookmarksOpen(true)}
        onExport={onExport}
        onShare={() => setShareOpen(true)}
        onSettings={() => setSettingsOpen(true)}
        researchOpen={researchOpen}
        bookmarksOpen={bookmarksOpen}
        showActions={!isTablet}
      />

      <CollabBanner />

      {!isTablet && (
        <View style={[styles.tabs, { borderBottomColor: p.border, backgroundColor: p.surface }]}>
          <TabBtn label="Reader" active={tab === 'reader'} onPress={() => setTab('reader')} />
          <TabBtn label="Canvas" active={tab === 'canvas'} onPress={() => setTab('canvas')} />
        </View>
      )}

      <View
        style={[styles.workspace, isTablet && styles.workspaceRow]}
        onLayout={(e) => setWsWidth(e.nativeEvent.layout.width)}>
        {isTablet ? (
          <>
            <NavRail
              onResearch={() => setResearchOpen(true)}
              onSearch={() => setSearchOpen(true)}
              onBookmarks={() => setBookmarksOpen(true)}
              onExport={onExport}
              onShare={() => setShareOpen(true)}
              onSettings={() => setSettingsOpen(true)}
              researchOpen={researchOpen}
              bookmarksOpen={bookmarksOpen}
            />
            <View style={{ width: wsWidth ? wsWidth * splitRatio : undefined, flex: wsWidth ? undefined : 1 }}>
              <PdfReader />
            </View>
            <View style={[styles.divider, { backgroundColor: p.bg2 }]} {...dividerPan.panHandlers}>
              <View style={[styles.grab, { backgroundColor: p.borderStrong }]} />
            </View>
            <View style={styles.pane}>
              <View ref={canvasRef} collapsable={false} style={styles.flex}>
                <CanvasBoard />
              </View>
            </View>
          </>
        ) : (
          <>
            {tab === 'reader' ? (
              <PdfReader />
            ) : (
              <View ref={canvasRef} collapsable={false} style={styles.flex}>
                <CanvasBoard />
              </View>
            )}
          </>
        )}
        <ThreadLayer />
      </View>

      {researchOpen && <ResearchPanel onClose={() => setResearchOpen(false)} />}
      {searchOpen && <SearchOverlay onClose={() => setSearchOpen(false)} />}
      {bookmarksOpen && <BookmarkPanel onClose={() => setBookmarksOpen(false)} />}
      {settingsOpen && <SettingsScreen onClose={() => setSettingsOpen(false)} />}
      {shareOpen && <ShareModal onClose={() => setShareOpen(false)} />}
      {showOnboarding && <OnboardingScreen onDone={dismissOnboarding} />}
    </View>
  );
}

export default function App() {
  const hydrated = useStore((s) => s.hydrated);
  const hydrate = useStore((s) => s.hydrate);
  const clearInMemory = useStore((s) => s.clearInMemory);
  const initTheme = useThemeStore((s) => s.initTheme);
  const authStatus = useAuth((s) => s.status);
  const authInit = useAuth((s) => s.init);
  const userId = useAuth((s) => s.user?.id ?? null);
  const permissionsHandled = useAuth((s) => s.permissionsHandled);

  const [minElapsed, setMinElapsed] = useState(false);

  useEffect(() => {
    initTheme();
    authInit();
    const t = setTimeout(() => setMinElapsed(true), 1000);
    return () => clearTimeout(t);
  }, [initTheme, authInit]);

  // Load the signed-in user's workspace; clear memory when signed out so notes
  // never bleed across accounts on the same device.
  useEffect(() => {
    if (authStatus === 'authenticated' && userId) {
      hydrate();
    } else if (authStatus === 'unauthenticated') {
      if (useCollab.getState().status !== 'off') useCollab.getState().leave();
      clearInMemory();
    }
  }, [authStatus, userId, hydrate, clearInMemory]);

  let content: React.ReactNode;
  if (!minElapsed || authStatus === 'loading') content = <SplashScreen />;
  else if (authStatus === 'unauthenticated') content = <AuthScreen />;
  else if (!permissionsHandled) content = <PermissionsScreen />;
  else if (!hydrated) content = <SplashScreen />;
  else content = <Workspace />;

  return (
    <GestureHandlerRootView style={styles.flex}>
      <SafeAreaProvider>{content}</SafeAreaProvider>
    </GestureHandlerRootView>
  );
}

function TabBtn({ label, active, onPress }: { label: string; active: boolean; onPress: () => void }) {
  const p = useTheme();
  return (
    <Text
      onPress={onPress}
      style={{
        flex: 1,
        textAlign: 'center',
        paddingVertical: 10,
        fontWeight: active ? '700' : '500',
        color: active ? p.accent : p.textMuted,
        borderBottomWidth: active ? 2 : 0,
        borderBottomColor: p.accent,
      }}>
      {label}
    </Text>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  tabs: { flexDirection: 'row', borderBottomWidth: 1 },
  workspace: { flex: 1, position: 'relative' },
  workspaceRow: { flexDirection: 'row' },
  pane: { flex: 1, minWidth: 0 },
  divider: { width: 16, alignItems: 'center', justifyContent: 'center' },
  grab: { width: 4, height: 44, borderRadius: 2 },
});
