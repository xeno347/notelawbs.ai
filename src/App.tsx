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
  withTiming,
} from 'react-native-reanimated';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { useStore } from './store';
import { useTheme, useThemeStore, SIDEBAR_W, SIDEBAR_COMPACT_W } from './theme';
import { AUTH_DISABLED, useAuth } from './auth/authStore';
import { useSessionLock } from './auth/sessionLockStore';
import { flushWorkspaceNow, getSetting, setSetting, setSaveErrorListener } from './storage';
import { initErrorReporting } from './services/errorReporting';
import { migrateAiSecrets } from './services/aiClient';
import ProjectLibraryScreen from './components/ProjectLibraryScreen';
import TopBar from './components/TopBar';
import NavRail from './components/NavRail';
import DocSidebar, { DOC_SIDEBAR_COLLAPSED_W } from './components/DocSidebar';
import PdfReader from './components/PdfReader';
import CanvasBoard from './components/CanvasBoard';
import LinearNotesPanel from './components/LinearNotesPanel';
import ThreadLayer from './components/ThreadLayer';
import AnnotationBar from './components/AnnotationBar';
import ExportSheet, { type ExportPreset } from './components/ExportSheet';
import ResearchPanel from './components/ResearchPanel';
import SearchOverlay from './components/SearchOverlay';
import BookmarkPanel from './components/BookmarkPanel';
import AnnotationsPanel from './components/AnnotationsPanel';
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
import { exportAnnotatedPdf } from './services/annotatedPdfExport';
import {
  compressPdfCopy,
  exportPdfTextAsWord,
  importWordAsPdf,
} from './services/pdfUtilities';
import { translateDocumentPages } from './services/documentTranslate';
import DocumentPicker from 'react-native-document-picker';
import ReactNativeBlobUtil from 'react-native-blob-util';
import { useCollab } from './collab/collabStore';
import { parseInviteUrl } from './collab/inviteTokens';
import { useAnnotation } from './annotationStore';

const DIVIDER_W = 12;

/**
 * Layout: fixed / resizable PDF pane + freeform OCR canvas.
 * Threads overlay both panes in window space.
 */
const SPLIT_MIN = 0.15;
const SPLIT_MAX = 0.85;

function Workspace() {
  const { width, height } = useWindowDimensions();
  const isTablet = width >= 768;
  const compactChrome = !isTablet || width < 900 || height > width;
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
  const openPdf = useStore((s) => s.openPdf);
  const setTranslations = useStore((s) => s.setTranslations);
  const setTranslationView = useStore((s) => s.setTranslationView);

  const [researchOpen, setResearchOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [bookmarksOpen, setBookmarksOpen] = useState(false);
  const [annotationsOpen, setAnnotationsOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [shareOpen, setShareOpen] = useState(false);
  const [exportOpen, setExportOpen] = useState(false);
  const [showOnboarding, setShowOnboarding] = useState(false);
  const [tab, setTab] = useState<'reader' | 'canvas'>('reader');
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [canvasArmed, setCanvasArmed] = useState(true);
  const canvasRef = useRef<View>(null);
  const rightPaneMode = useStore((s) => s.rightPaneMode);
  const setRightPaneMode = useStore((s) => s.setRightPaneMode);
  const pdfVisible = isTablet || tab === 'reader';

  const sidebarWidth = sidebarCollapsed
    ? DOC_SIDEBAR_COLLAPSED_W
    : compactChrome
      ? SIDEBAR_COMPACT_W
      : SIDEBAR_W;

  // After a PDF opens, delay mounting Skia canvas so PDFium can settle first
  // (combined GPU + JS pressure jetsams older iPads).
  useEffect(() => {
    if (!docUri) {
      setCanvasArmed(true);
      return;
    }
    setCanvasArmed(false);
    const t = setTimeout(() => setCanvasArmed(true), 2200);
    return () => clearTimeout(t);
  }, [docUri]);

  // Force-disable legacy auto-OCR prefs that caused open-time crashes.
  useEffect(() => {
    setSetting('autoOcr', '0').catch(() => {});
    if (useStore.getState().autoOcr) useStore.getState().setAutoOcr(false);
  }, []);

  const toggleSidebarCollapsed = () => {
    setSidebarCollapsed((v) => {
      const next = !v;
      setSetting('sidebarCollapsed', next ? '1' : '0').catch(() => {});
      return next;
    });
  };

  // Split ratio of the PDF pane within (workspace − sidebar − divider).
  const splitRatio = useSharedValue(0.48);
  const wsWidthSV = useSharedValue(width);
  const sidebarWSV = useSharedValue(sidebarWidth);
  const ratioStart = useRef(0.48);
  const dragActive = useSharedValue(0);

  useEffect(() => {
    sidebarWSV.value = sidebarWidth;
    useStore.getState().bumpLayoutEpoch();
  }, [sidebarWidth, sidebarWSV]);

  const readerPaneStyle = useAnimatedStyle(() => {
    const usable = Math.max(0, wsWidthSV.value - sidebarWSV.value - DIVIDER_W);
    return { width: usable * splitRatio.value };
  });

  const dividerStyle = useAnimatedStyle(() => ({
    opacity: withTiming(dragActive.value ? 1 : 0.85, { duration: 160 }),
    backgroundColor: 'transparent',
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
          const usable = wsWidthSV.value - sidebarWSV.value - DIVIDER_W;
          if (usable <= 0) return;
          splitRatio.value = Math.min(
            SPLIT_MAX,
            Math.max(SPLIT_MIN, ratioStart.current + g.dx / usable),
          );
        },
        onPanResponderRelease: () => {
          dragActive.value = 0;
          useStore.getState().bumpLayoutEpoch();
          setSetting('splitRatio', String(splitRatio.value)).catch(() => {});
        },
        onPanResponderTerminate: () => {
          dragActive.value = 0;
          useStore.getState().bumpLayoutEpoch();
          setSetting('splitRatio', String(splitRatio.value)).catch(() => {});
        },
      }),
    [splitRatio, wsWidthSV, sidebarWSV, dragActive],
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

  // Restore the reader/canvas split ratio from the last session (layout
  // preference, not per-project — matches how `threadsOn` behaves).
  useEffect(() => {
    getSetting('splitRatio').then((v) => {
      const parsed = v ? parseFloat(v) : NaN;
      if (Number.isFinite(parsed) && parsed >= SPLIT_MIN && parsed <= SPLIT_MAX) {
        splitRatio.value = parsed;
        ratioStart.current = parsed;
      }
    });
    getSetting('sidebarCollapsed').then((v) => {
      if (v === '1') setSidebarCollapsed(true);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const tryJoin = (url: string | null) => {
      if (!url) return;
      const invite = parseInviteUrl(url);
      if (invite) {
        void useCollab.getState().joinInvite(invite);
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

  const onTranslateDoc = () => {
    const pages = useStore.getState().ocr.pages;
    const keys = Object.keys(pages).filter((k) => (pages[Number(k)] || '').trim().length > 20);
    if (!keys.length) {
      Alert.alert(
        'No text yet',
        'Import the PDF text layer or run OCR on a few pages first, then translate to English.',
      );
      return;
    }
    Alert.alert('Translate to English', `Translate ${Math.min(keys.length, 40)} pages with text?`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Translate',
        onPress: async () => {
          try {
            const result = await translateDocumentPages(pages, { maxPages: 40 });
            setTranslations({ ...useStore.getState().translations, ...result });
            setTranslationView('side');
            Alert.alert(
              'English ready',
              `${Object.keys(result).length} page(s) translated. Tap EN on the reader pager to cycle views.`,
            );
          } catch (e: any) {
            Alert.alert('Translate failed', e?.message || 'Could not translate this document.');
          }
        },
      },
    ]);
  };

  const exportOutline = () => ({
    docName: projectTitle || docName,
    highlights,
    nodes,
    bookmarks,
    edges,
  });

  const runCanvasPng = () => {
    if (!isTablet && tab !== 'canvas') {
      Alert.alert('Map not visible', 'Switch to Workspace → Map, then export again.');
      return;
    }
    if (!canvasRef.current) {
      Alert.alert('Export failed', 'Canvas is not ready yet.');
      return;
    }
    exportCanvasSnapshot(canvasRef, docName).catch(() => {
      Alert.alert('Export failed', 'Could not capture the canvas.');
    });
  };

  const runAnnotatedPdf = () => {
    if (!docUri) {
      Alert.alert('Export failed', 'Open a PDF first.');
      return;
    }
    exportAnnotatedPdf({
      docUri,
      docName: exportOutline().docName,
      highlights,
      inkStrokes: ink.strokes,
    }).catch((e: any) => {
      Alert.alert('Export failed', e?.message || 'Could not bake annotations into the PDF.');
    });
  };

  const runMatterBackup = () => {
    exportProjectBundle({
      version: 1,
      exportedAt: Date.now(),
      title: projectTitle || docName || 'NoteLawbs.Ai',
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
  };

  const onExportPreset = (preset: ExportPreset) => {
    const outline = exportOutline();
    switch (preset) {
      case 'chamber_brief':
        runAnnotatedPdf();
        exportNotesMarkdown(outline).catch(() => {
          Alert.alert('Export failed', 'Could not build the notes outline for the chamber brief.');
        });
        break;
      case 'canvas_png':
        runCanvasPng();
        break;
      case 'notes_md':
        exportNotesMarkdown(outline).catch(() => {
          Alert.alert('Export failed', 'Could not build the notes export.');
        });
        break;
      case 'notes_word':
        exportNotesWord(outline).catch(() => {
          Alert.alert('Export failed', 'Could not build the Word export.');
        });
        break;
      case 'annotated_pdf':
        runAnnotatedPdf();
        break;
      case 'annotated_html':
        exportAnnotatedReport({
          docName: outline.docName,
          highlights,
          bookmarks,
        }).catch(() => {
          Alert.alert('Export failed', 'Could not build the annotated report.');
        });
        break;
      case 'source_pdf':
        exportSourcePdf(docUri, docName).catch(() => {
          Alert.alert('Export failed', 'No PDF open to share.');
        });
        break;
      case 'matter_backup':
        runMatterBackup();
        break;
      case 'import_backup':
        void (async () => {
          try {
            const file = await DocumentPicker.pickSingle({
              type: [DocumentPicker.types.allFiles, DocumentPicker.types.plainText],
              copyTo: 'cachesDirectory',
            });
            const uri = (file.fileCopyUri || file.uri || '').replace('file://', '');
            const raw = await ReactNativeBlobUtil.fs.readFile(uri, 'utf8');
            const bundle = await parseProjectBundle(raw);
            importCanvasBundle(bundle);
            Alert.alert(
              'Imported',
              'Canvas notes, highlights, and index were restored. Open the matching PDF if needed.',
            );
          } catch (e: any) {
            if (DocumentPicker.isCancel(e)) return;
            Alert.alert('Import failed', e?.message || 'Invalid NoteLawbs.Ai project file.');
          }
        })();
        break;
      case 'compress_pdf':
        if (!docUri) {
          Alert.alert('Export failed', 'Open a PDF first.');
          return;
        }
        compressPdfCopy(docUri, docName || 'document')
          .then(({ before, after }) => {
            const saved = Math.max(0, before - after);
            const pct = before > 0 ? Math.round((saved / before) * 100) : 0;
            Alert.alert(
              'Compressed',
              `${(before / 1024).toFixed(0)} KB → ${(after / 1024).toFixed(0)} KB (${pct}% smaller). Share sheet opened.`,
            );
          })
          .catch((e: any) => {
            Alert.alert('Compress failed', e?.message || 'Could not compress this PDF.');
          });
        break;
      case 'import_word':
        void (async () => {
          try {
            const imported = await importWordAsPdf();
            if (!imported) return;
            await openPdf(imported.uri, imported.name, { forceNew: true });
            Alert.alert('Imported', 'Converted to PDF and opened in the library.');
          } catch (e: any) {
            Alert.alert('Import failed', e?.message || 'Could not import that file.');
          }
        })();
        break;
      case 'pdf_to_word':
        exportPdfTextAsWord({ docName: outline.docName, pages: ocrPages }).catch((e: any) => {
          Alert.alert('Export failed', e?.message || 'Could not export PDF text to Word.');
        });
        break;
      default:
        break;
    }
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
        onTranslate={onTranslateDoc}
        onSearch={() => setSearchOpen(true)}
        onBookmarks={() => setBookmarksOpen(true)}
        onAnnotations={() => setAnnotationsOpen(true)}
        onExport={() => setExportOpen(true)}
        onShare={() => setShareOpen(true)}
        onSettings={() => setSettingsOpen(true)}
        researchOpen={researchOpen}
        bookmarksOpen={bookmarksOpen}
        annotationsOpen={annotationsOpen}
      />

      <CollabBanner />

      {!isTablet && (
        <View style={[styles.phoneTabRow, { borderBottomColor: p.separator, backgroundColor: p.grouped }]}>
          <View style={[styles.segment, { backgroundColor: p.fillSecondary }]}>
            <TabBtn label="Reader" active={tab === 'reader'} onPress={() => setTab('reader')} />
            <TabBtn
              label="Map"
              active={tab === 'canvas' && rightPaneMode === 'canvas'}
              onPress={() => {
                setRightPaneMode('canvas');
                setTab('canvas');
              }}
            />
            <TabBtn
              label="Outline"
              active={tab === 'canvas' && rightPaneMode === 'notes'}
              onPress={() => {
                setRightPaneMode('notes');
                setTab('canvas');
              }}
            />
          </View>
        </View>
      )}

      <View style={[styles.flex, isTablet && styles.workspaceRow]}>
        {isTablet ? (
          <NavRail
            onSearch={() => setSearchOpen(true)}
            onResearch={() => setResearchOpen(true)}
            onBookmarks={() => setBookmarksOpen(true)}
            onAnnotations={() => setAnnotationsOpen(true)}
            onExport={() => setExportOpen(true)}
            onShare={() => setShareOpen(true)}
            onSettings={() => setSettingsOpen(true)}
            researchOpen={researchOpen}
            bookmarksOpen={bookmarksOpen}
            annotationsOpen={annotationsOpen}
          />
        ) : null}

        <View
          style={[styles.workspace, isTablet && styles.workspaceRow]}
          onLayout={(e) => {
            wsWidthSV.value = e.nativeEvent.layout.width;
          }}>
          {isTablet ? (
            <>
              <DocSidebar
                compact={compactChrome}
                collapsed={sidebarCollapsed}
                onToggleCollapse={toggleSidebarCollapsed}
              />
              <Animated.View style={[readerPaneStyle, styles.pane]}>
                <ErrorBoundary fallbackTitle="Reader error">
                  <PdfReader />
                </ErrorBoundary>
              </Animated.View>
              <View style={styles.divider} {...dividerPan.panHandlers}>
                <Animated.View
                  style={[styles.dividerTrack, { backgroundColor: p.border }, dividerStyle]}
                />
                <View style={[styles.dividerGrip, { backgroundColor: p.textMuted }]} />
              </View>
              <View style={[styles.pane, { backgroundColor: p.bg }]}>
                <View style={[styles.paneModeRow, { borderBottomColor: p.separator }]}>
                  <View style={[styles.segment, { backgroundColor: p.fillSecondary }]}>
                    <TabBtn
                      label="Map"
                      active={rightPaneMode === 'canvas'}
                      onPress={() => setRightPaneMode('canvas')}
                    />
                    <TabBtn
                      label="Outline"
                      active={rightPaneMode === 'notes'}
                      onPress={() => setRightPaneMode('notes')}
                    />
                  </View>
                </View>
                {rightPaneMode === 'notes' ? (
                  <ErrorBoundary fallbackTitle="Notes error">
                    <LinearNotesPanel />
                  </ErrorBoundary>
                ) : (
                  <View ref={canvasRef} collapsable={false} style={styles.flex}>
                    <ErrorBoundary fallbackTitle="Canvas error">
                      {canvasArmed ? (
                        <CanvasBoard />
                      ) : (
                        <View style={[styles.flex, { alignItems: 'center', justifyContent: 'center' }]}>
                          <Text style={{ color: p.textMuted, fontSize: 13 }}>Preparing canvas…</Text>
                        </View>
                      )}
                    </ErrorBoundary>
                  </View>
                )}
              </View>
            </>
          ) : (
            <>
              {tab === 'reader' ? (
                <View style={styles.phoneRow}>
                  <DocSidebar
                    compact
                    collapsed={sidebarCollapsed}
                    onToggleCollapse={toggleSidebarCollapsed}
                  />
                  <View style={styles.flex}>
                    <ErrorBoundary fallbackTitle="Reader error">
                      <PdfReader />
                    </ErrorBoundary>
                  </View>
                </View>
              ) : rightPaneMode === 'notes' ? (
                <ErrorBoundary fallbackTitle="Notes error">
                  <LinearNotesPanel />
                </ErrorBoundary>
              ) : (
                <View ref={canvasRef} collapsable={false} style={styles.flex}>
                  <ErrorBoundary fallbackTitle="Canvas error">
                    {canvasArmed ? <CanvasBoard /> : null}
                  </ErrorBoundary>
                </View>
              )}
            </>
          )}
          <ThreadLayer />
          {pdfVisible ? (
            <AnnotationBar
              onFitCanvas={() => useAnnotation.getState().requestFit()}
              onScanPage={() => useAnnotation.getState().requestScanPage()}
            />
          ) : null}
        </View>
      </View>

      {researchOpen && <ResearchPanel onClose={() => setResearchOpen(false)} />}
      {searchOpen && <SearchOverlay onClose={() => setSearchOpen(false)} />}
      {bookmarksOpen && <BookmarkPanel onClose={() => setBookmarksOpen(false)} />}
      {annotationsOpen && <AnnotationsPanel onClose={() => setAnnotationsOpen(false)} />}
      {settingsOpen && <SettingsScreen onClose={() => setSettingsOpen(false)} />}
      {shareOpen && <ShareModal onClose={() => setShareOpen(false)} />}
      <ExportSheet
        visible={exportOpen}
        onClose={() => setExportOpen(false)}
        onShareLive={() => setShareOpen(true)}
        onPreset={onExportPreset}
      />
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
  const authSubmitting = useAuth((s) => s.submitting);
  const userId = useAuth((s) => s.user?.id ?? null);
  const permissionsHandled = useAuth((s) => s.permissionsHandled);
  const sessionLockInit = useSessionLock((s) => s.init);
  const sessionLocked = useSessionLock((s) => s.locked);
  const onAppBackground = useSessionLock((s) => s.onAppBackground);
  const onAppActive = useSessionLock((s) => s.onAppActive);
  const unlockSession = useSessionLock((s) => s.unlock);

  const [minElapsed, setMinElapsed] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const dsn = await getSetting('sentry_dsn');
      await initErrorReporting(dsn);
      await migrateAiSecrets();
      await Promise.all([initTheme(), authInit(), sessionLockInit()]);
      if (!cancelled) setMinElapsed(true);
    })();
    return () => {
      cancelled = true;
    };
  }, [initTheme, authInit, sessionLockInit]);

  useEffect(() => {
    setSaveErrorListener((message) => {
      Alert.alert('Could not save', message);
    });
    return () => setSaveErrorListener(null);
  }, []);

  useEffect(() => {
    let prev: AppStateStatus = AppState.currentState;
    const sub = AppState.addEventListener('change', (next) => {
      if ((next === 'background' || next === 'inactive') && prev === 'active') {
        void flushWorkspaceNow();
      }
      // Never session-lock on the auth screen, or while Google/Apple SSO is in flight
      // (those sheets background the app and would otherwise lock the workspace).
      if (authStatus !== 'authenticated' || authSubmitting) {
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
  }, [authStatus, authSubmitting, onAppBackground, onAppActive, unlockSession]);

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
  else if (!AUTH_DISABLED && authStatus === 'unauthenticated') content = <AuthScreen />;
  else if (!AUTH_DISABLED && !permissionsHandled) content = <PermissionsScreen />;
  else if (!hydrated) content = <SplashScreen />;
  else content = <Workspace />;

  return (
    <GestureHandlerRootView style={styles.flex}>
      <SafeAreaProvider>
        <ErrorBoundary>
          {content}
          {!AUTH_DISABLED && authStatus === 'authenticated' && sessionLocked ? (
            <SessionLockScreen />
          ) : null}
        </ErrorBoundary>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}

function TabBtn({ label, active, onPress }: { label: string; active: boolean; onPress: () => void }) {
  const p = useTheme();
  const press = useSharedValue(0);
  const btnStyle = useAnimatedStyle(() => ({
    opacity: withTiming(press.value ? 0.7 : 1, { duration: 120 }),
  }));
  return (
    <Pressable
      onPress={onPress}
      onPressIn={() => (press.value = 1)}
      onPressOut={() => (press.value = 0)}
      style={styles.flex}>
      <Animated.View
        style={[
          styles.tabBtn,
          btnStyle,
          active && { backgroundColor: p.surface, borderWidth: StyleSheet.hairlineWidth, borderColor: p.border },
        ]}>
        <Text
          style={{
            textAlign: 'center',
            fontWeight: active ? '600' : '500',
            fontSize: 14,
            color: active ? p.text : p.textMid,
            letterSpacing: -0.2,
          }}>
          {label}
        </Text>
      </Animated.View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  phoneTabRow: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  segment: {
    flexDirection: 'row',
    borderRadius: 10,
    padding: 3,
    gap: 2,
  },
  tabBtn: {
    paddingVertical: 7,
    paddingHorizontal: 10,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    flex: 1,
  },
  workspace: { flex: 1, position: 'relative' },
  workspaceRow: { flexDirection: 'row' },
  phoneRow: { flex: 1, flexDirection: 'row' },
  pane: { flex: 1, minWidth: 0 },
  paneModeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  divider: { width: DIVIDER_W, alignItems: 'center', justifyContent: 'center', zIndex: 2 },
  dividerTrack: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    width: StyleSheet.hairlineWidth,
  },
  dividerGrip: {
    width: 5,
    height: 48,
    borderRadius: 3,
    opacity: 0.55,
  },
});
