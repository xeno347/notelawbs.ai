import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  useWindowDimensions,
  ActivityIndicator,
  PanResponder,
  Alert,
} from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { useStore } from './store';
import { getPalette } from './theme';
import TopBar from './components/TopBar';
import PdfReader from './components/PdfReader';
import CanvasBoard from './components/CanvasBoard';
import ThreadLayer from './components/ThreadLayer';
import ResearchPanel from './components/ResearchPanel';

export default function App() {
  const { width } = useWindowDimensions();
  const isTablet = width >= 768;
  const p = getPalette();

  const hydrated = useStore((s) => s.hydrated);
  const hydrate = useStore((s) => s.hydrate);
  const resetWorkspace = useStore((s) => s.resetWorkspace);
  const linking = useStore((s) => s.linking);

  const [researchOpen, setResearchOpen] = useState(false);
  const [tab, setTab] = useState<'reader' | 'canvas'>('reader');
  const [splitRatio, setSplitRatio] = useState(0.52);
  const [wsWidth, setWsWidth] = useState(0);
  const ratioStart = useRef(0.52);

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
    hydrate();
  }, [hydrate]);

  useEffect(() => {
    if (linking.active && linking.step === 'pdf' && !isTablet) {
      setTab('reader');
    }
  }, [linking, isTablet]);

  if (!hydrated) {
    return (
      <View style={[styles.boot, { backgroundColor: p.bg }]}>
        <ActivityIndicator color={p.accent} />
        <Text style={{ color: p.textMuted, marginTop: 12 }}>Loading workspace…</Text>
      </View>
    );
  }

  const onReset = () => {
    Alert.alert(
      'Reset workspace',
      'Clear all highlights, canvas cards, and handwriting? This cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Reset', style: 'destructive', onPress: () => resetWorkspace() },
      ],
    );
  };

  return (
    <GestureHandlerRootView style={styles.flex}>
      <SafeAreaProvider>
        <View style={[styles.flex, { backgroundColor: p.bg }]}>
          <TopBar
            onResearch={() => setResearchOpen(true)}
            onReset={onReset}
            researchOpen={researchOpen}
          />

          {!isTablet && (
            <View style={[styles.tabs, { borderBottomColor: p.border, backgroundColor: p.surface }]}>
              <TabBtn
                label="Reader"
                active={tab === 'reader'}
                onPress={() => setTab('reader')}
                p={p}
              />
              <TabBtn
                label="Canvas"
                active={tab === 'canvas'}
                onPress={() => setTab('canvas')}
                p={p}
              />
            </View>
          )}

          <View
            style={[styles.workspace, isTablet && styles.workspaceRow]}
            onLayout={(e) => setWsWidth(e.nativeEvent.layout.width)}>
            {isTablet ? (
              <>
                <View style={{ width: wsWidth ? wsWidth * splitRatio : undefined, flex: wsWidth ? undefined : 1 }}>
                  <PdfReader />
                </View>
                <View
                  style={[styles.divider, { backgroundColor: p.bg2 }]}
                  {...dividerPan.panHandlers}>
                  <View style={[styles.grab, { backgroundColor: p.border }]} />
                </View>
                <View style={styles.pane}>
                  <CanvasBoard />
                </View>
              </>
            ) : (
              <>
                {tab === 'reader' ? <PdfReader /> : <CanvasBoard />}
              </>
            )}
            <ThreadLayer />
          </View>

          {researchOpen && (
            <ResearchPanel onClose={() => setResearchOpen(false)} />
          )}
        </View>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}

function TabBtn({
  label,
  active,
  onPress,
  p,
}: {
  label: string;
  active: boolean;
  onPress: () => void;
  p: ReturnType<typeof getPalette>;
}) {
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
  boot: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  tabs: { flexDirection: 'row', borderBottomWidth: 1 },
  workspace: { flex: 1, position: 'relative' },
  workspaceRow: { flexDirection: 'row' },
  pane: { flex: 1, minWidth: 0 },
  divider: { width: 16, alignItems: 'center', justifyContent: 'center' },
  grab: { width: 4, height: 44, borderRadius: 2 },
});
