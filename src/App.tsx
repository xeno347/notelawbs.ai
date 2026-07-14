import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  useWindowDimensions,
  PanResponder,
  Pressable,
  Alert,
  AppState,
  type AppStateStatus,
  Linking,
} from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { useStore } from './store';
import { useTheme, useThemeStore } from './theme';
import { GlassView } from './components/ui';
import { useAuth } from './auth/authStore';
import { useSessionLock } from './auth/sessionLockStore';
import { getSetting, setSetting } from './storage';
import ProjectLibraryScreen from './components/ProjectLibraryScreen';
import TopBar from './components/TopBar';
import DocSidebar from './components/DocSidebar';
import PdfReader from './components/PdfReader';
import CanvasBoard from './components/CanvasBoard';
import ThreadLayer from './components/ThreadLayer';
import AnnotationBar from './components/AnnotationBar';
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
import SessionLockScreen from './components/SessionLockScreen';
import ErrorBoundary from './components/ErrorBoundary';
import {
  exportCanvasSnapshot,
  exportNotesMarkdown,
  exportNotesWord,
  exportAnnotatedReport,
  exportProjectBundle,
  exportSourcePdf,
  parseProjectBundle,
} from './services/exportService';
import DocumentPicker from 'react-native-document-picker';
import ReactNativeBlobUtil from 'react-native-blob-util';
import { useCollab, parseJoinUrl } from './collab/collabStore';
import { useAnnotation } from './annotationStore';

const SIDEBAR_W = 120;
const DIVIDER_W = 18;

/**
 * Layout: fixed / resizable PDF pane + freeform OCR canvas.
 * Threads overlay both panes in window space.
 */
function Workspace() {
  const { width } = useWindowDimensions();
  const isTablet = width >= 768;
  const p = useTheme();

  const linking = useStore((s) => s.linking);
  const view = useStore((s) => s.view);
  const goToLibrary = useStore((s) => s.goToLibrary);
  const projectTitle = useStore((s) => s.projectTitle);
  const docName = useStore((s) => s.docName);
  const highlights = useStore((s) => s.highlights);
  const nodes = useStore((s) => s.nodes);
  const edges = useStore((s) => s.edges);
  const bookmarks = useStore((s) => s.bookmarks);
  const ink = useStore((s) => s.ink);
  const ocrPages = useStore((s) => s.ocr.pages);
  const numPages = useStore((s) => s.numPages);
  const docUri = useStore((s) => s.docUri);
  const importCanvasBundle = useStore((s) => s.importCanvasBundle);

  const [researchOpen, setResearchOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [bookmarksOpen, setBookmarksOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [shareOpen, setShareOpen] = useState(false);
  const [showOnboarding, setShowOnboarding] = useState(false);
  const [tab, setTab] = useState<'reader' | 'canvas'>('reader');
  const canvasRef = useRef<View>(null);

  // Split ratio of the PDF pane within (workspace − sidebar − divider).
  const splitRatio = useSharedValue(0.48);
  const wsWidthSV = useSharedValue(width);
  const ratioStart = useRef(0.48);
  const dragActive = useSharedValue(0);

  const readerPaneStyle = useAnimatedStyle(() => {
    const usable = Math.max(0, wsWidthSV.value - SIDEBAR_W - DIVIDER_W);
    return { width: usable * splitRatio.value };
  });

  const dividerStyle = useAnimatedStyle(() => ({
    opacity: withTiming(dragActive.value ? 1 : 0.9, { duration: 140 }),
    transform: [{ scaleX: withSpring(dragActive.value ? 1.7 : 1, { damping: 16, stiffness: 220 }) }],
  }));

  const dividerPan = useMemo(
    () =>
      PanResponder.create({
        onStartShouldSetPanResponder: () => true,
        onMoveShouldSetPanResponder: () => true,
        onPanResponderGrant: () => {
          ratioStart.current = splitRatio.value;
          dragActive.value = 1;
        },
        onPanResponderMove: (_e, g) => {
          const usable = wsWidthSV.value - SIDEBAR_W - DIVIDER_W;
          if (usable <= 0) return;
          splitRatio.value = Math.min(0.72, Math.max(0.28, ratioStart.current + g.dx / usable));
        },
        onPanResponderRelease: () => {
          dragActive.value = 0;
          useStore.getState().bumpLayoutEpoch();
        },
        onPanResponderTerminate: () => {
          dragActive.value = 0;
          useStore.getState().bumpLayoutEpoch();
        },
      }),
    [splitRatio, wsWidthSV, dragActive],
  );

  useEffect(() => {
    if (linking.active && linking.step === 'pdf' && !isTablet) setTab('reader');
    if (linking.active && linking.step === 'canvas' && !isTablet) setTab('canvas');
  }, [linking, isTablet]);

  useEffect(() => {
    getSetting('onboarded').then((v) => {
      if (v !== '1') setShowOnboarding(true);
    });
  }, []);

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
    const outline = {
      docName: projectTitle || docName,
      highlights,
      nodes,
      bookmarks,
      edges,
    };
    Alert.alert('Export & sync', 'Choose a format', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Canvas snapshot (PNG)',
        onPress: () => {
          if (!isTablet && tab !== 'canvas') {
            Alert.alert('Canvas not visible', 'Switch to the Canvas tab, then export again.');
            return;
          }
          if (!canvasRef.current) {
            Alert.alert('Export failed', 'Canvas is not ready yet.');
            return;
          }
          exportCanvasSnapshot(canvasRef, docName).catch(() => {
            Alert.alert('Export failed', 'Could not capture the canvas.');
          });
        },
      },
      {
        text: 'Notes outline (Markdown)',
        onPress: () => {
          exportNotesMarkdown(outline).catch(() => {
            Alert.alert('Export failed', 'Could not build the notes export.');
          });
        },
      },
      {
        text: 'Word / Docs (.doc)',
        onPress: () => {
          exportNotesWord(outline).catch(() => {
            Alert.alert('Export failed', 'Could not build the Word export.');
          });
        },
      },
      {
        text: 'Annotated report (HTML)',
        onPress: () => {
          exportAnnotatedReport({
            docName: outline.docName,
            highlights,
            bookmarks,
          }).catch(() => {
            Alert.alert('Export failed', 'Could not build the annotated report.');
          });
        },
      },
      {
        text: 'Source PDF',
        onPress: () => {
          exportSourcePdf(docUri, docName).catch(() => {
            Alert.alert('Export failed', 'No PDF open to share.');
          });
        },
      },
      {
        text: 'Project sync JSON',
        onPress: () => {
          exportProjectBundle({
            version: 1,
            exportedAt: Date.now(),
            title: projectTitle || docName || 'LitNotes',
            docName,
            numPages,
            highlights,
            nodes,
            edges,
            ink,
            ocrPages,
            bookmarks,
          }).catch(() => {
            Alert.alert('Export failed', 'Could not build the project bundle.');
          });
        },
      },
      {
        text: 'Import project JSON',
        onPress: async () => {
          try {
            const file = await DocumentPicker.pickSingle({
              type: [DocumentPicker.types.allFiles, DocumentPicker.types.plainText],
              copyTo: 'cachesDirectory',
            });
            const uri = (file.fileCopyUri || file.uri || '').replace('file://', '');
            const raw = await ReactNativeBlobUtil.fs.readFile(uri, 'utf8');
            const bundle = await parseProjectBundle(raw);
            importCanvasBundle(bundle);
            Alert.alert('Imported', 'Canvas notes, highlights, and index were restored. Open the matching PDF if needed.');
          } catch (e: any) {
            if (DocumentPicker.isCancel(e)) return;
            Alert.alert('Import failed', e?.message || 'Invalid LitNotes project file.');
          }
        },
      },
    ]);
  };

  if (view === 'library') {
    return (
      <View style={[styles.flex, { backgroundColor: p.bg }]}>
        <ProjectLibraryScreen onSettings={() => setSettingsOpen(true)} />
        {settingsOpen && <SettingsScreen onClose={() => setSettingsOpen(false)} />}
        {showOnboarding && <OnboardingScreen onDone={dismissOnboarding} />}
      </View>
    );
  }

  return (
    <View style={[styles.flex, { backgroundColor: p.bg }]}>
      <TopBar
        onHome={() => goToLibrary()}
        onResearch={() => setResearchOpen(true)}
        onSearch={() => setSearchOpen(true)}
        onBookmarks={() => setBookmarksOpen(true)}
        onExport={onExport}
        onShare={() => setShareOpen(true)}
        onSettings={() => setSettingsOpen(true)}
        researchOpen={researchOpen}
        bookmarksOpen={bookmarksOpen}
      />

      <CollabBanner />

      {!isTablet && (
        <GlassView style={styles.tabGlass}>
          <View style={styles.tabs}>
            <TabBtn label="Reader" active={tab === 'reader'} onPress={() => setTab('reader')} />
            <TabBtn label="Canvas" active={tab === 'canvas'} onPress={() => setTab('canvas')} />
          </View>
        </GlassView>
      )}

      <View
        style={[styles.workspace, isTablet && styles.workspaceRow]}
        onLayout={(e) => {
          wsWidthSV.value = e.nativeEvent.layout.width;
        }}>
        {isTablet ? (
          <>
            <DocSidebar />
            <Animated.View style={[readerPaneStyle, styles.pane]}>
              <ErrorBoundary fallbackTitle="Reader error">
                <PdfReader />
              </ErrorBoundary>
            </Animated.View>
            <View style={styles.divider} {...dividerPan.panHandlers}>
              <Animated.View
                style={[styles.dividerTrack, { backgroundColor: p.separator }, dividerStyle]}
              />
            </View>
            <View style={[styles.pane, { backgroundColor: p.bg }]}>
              <View ref={canvasRef} collapsable={false} style={styles.flex}>
                <ErrorBoundary fallbackTitle="Canvas error">
                  <CanvasBoard />
                </ErrorBoundary>
              </View>
            </View>
          </>
        ) : (
          <>
            {tab === 'reader' ? (
              <View style={styles.phoneRow}>
                <DocSidebar />
                <View style={styles.flex}>
                  <ErrorBoundary fallbackTitle="Reader error">
                    <PdfReader />
                  </ErrorBoundary>
                </View>
              </View>
            ) : (
              <View ref={canvasRef} collapsable={false} style={styles.flex}>
                <ErrorBoundary fallbackTitle="Canvas error">
                  <CanvasBoard />
                </ErrorBoundary>
              </View>
            )}
          </>
        )}
        <ThreadLayer />
        <AnnotationBar onFitCanvas={() => useAnnotation.getState().requestFit()} />
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
  const sessionLockInit = useSessionLock((s) => s.init);
  const sessionLocked = useSessionLock((s) => s.locked);
  const onAppBackground = useSessionLock((s) => s.onAppBackground);
  const onAppActive = useSessionLock((s) => s.onAppActive);
  const unlockSession = useSessionLock((s) => s.unlock);

  const [minElapsed, setMinElapsed] = useState(false);

  useEffect(() => {
    initTheme();
    authInit();
    sessionLockInit();
    const t = setTimeout(() => setMinElapsed(true), 1000);
    return () => clearTimeout(t);
  }, [initTheme, authInit, sessionLockInit]);

  useEffect(() => {
    let prev: AppStateStatus = AppState.currentState;
    const sub = AppState.addEventListener('change', (next) => {
      if (authStatus !== 'authenticated') {
        unlockSession();
        prev = next;
        return;
      }
      if ((next === 'background' || next === 'inactive') && prev === 'active') {
        onAppBackground();
      } else if (next === 'active') {
        onAppActive();
      }
      prev = next;
    });
    return () => sub.remove();
  }, [authStatus, onAppBackground, onAppActive, unlockSession]);

  useEffect(() => {
    if (authStatus !== 'authenticated') unlockSession();
  }, [authStatus, unlockSession]);

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
      <SafeAreaProvider>
        <ErrorBoundary>
          {content}
          {authStatus === 'authenticated' && sessionLocked ? <SessionLockScreen /> : null}
        </ErrorBoundary>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}

function TabBtn({ label, active, onPress }: { label: string; active: boolean; onPress: () => void }) {
  const p = useTheme();
  const press = useSharedValue(0);
  const btnStyle = useAnimatedStyle(() => ({
    transform: [{ scale: withSpring(press.value ? 0.96 : 1, { damping: 15, stiffness: 300 }) }],
  }));
  return (
    <Pressable
      onPress={onPress}
      onPressIn={() => (press.value = 1)}
      onPressOut={() => (press.value = 0)}
      style={styles.flex}>
      <Animated.View style={[styles.tabBtn, btnStyle, active && { backgroundColor: p.tintSoft }]}>
        <Text
          style={{
            textAlign: 'center',
            fontWeight: active ? '600' : '400',
            fontSize: 15,
            color: active ? p.tint : p.textMid,
          }}>
          {label}
        </Text>
      </Animated.View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  tabGlass: { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: 'rgba(128,128,128,0.2)' },
  tabs: { flexDirection: 'row', paddingHorizontal: 8, paddingVertical: 6, gap: 6 },
  tabBtn: { paddingVertical: 8, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  workspace: { flex: 1, position: 'relative' },
  workspaceRow: { flexDirection: 'row' },
  phoneRow: { flex: 1, flexDirection: 'row' },
  pane: { flex: 1, minWidth: 0 },
  divider: { width: DIVIDER_W, alignItems: 'center', justifyContent: 'center', zIndex: 2 },
  dividerTrack: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    width: StyleSheet.hairlineWidth * 2,
  },
});
