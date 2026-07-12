import React, { useEffect, useState } from 'react';
import { View, StyleSheet, Dimensions, TouchableOpacity, Text, LayoutAnimation } from 'react-native';
import { PanGestureHandler, PanGestureHandlerGestureEvent } from 'react-native-gesture-handler';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  useAnimatedGestureHandler,
} from 'react-native-reanimated';
import { useRoute, RouteProp } from '@react-navigation/native';
import { useSettings } from '../settings/useSettings';
import { colors } from '../../theme/colors';
import PdfPane from './PdfPane';
import CanvasPane from './CanvasPane';
import BookmarkPanel from './BookmarkPanel';
import { useActiveDocument } from './useActiveDocument';
import { RootStackParamList } from '../../app/navigation';
import { PanelLeft, PanelRight, Share2 } from 'lucide-react-native';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

export default function DocumentWorkspaceScreen() {
  const { settings, setSettings } = useSettings();
  const { activeDocument } = useActiveDocument();
  const route = useRoute<RouteProp<RootStackParamList, 'DocumentWorkspace'>>();
  const theme = settings.themeMode === 'dark' ? colors.dark : colors.light;

  const [showIndex, setShowIndex] = useState(true);
  const [currentPage, setCurrentPage] = useState(route.params?.page ?? 1);
  const splitRatio = useSharedValue(settings.defaultSplitRatio);

  const availableWidth = SCREEN_WIDTH;

  const gestureHandler = useAnimatedGestureHandler<PanGestureHandlerGestureEvent, { startX: number }>({
    onStart: (_, ctx) => {
      ctx.startX = splitRatio.value * (availableWidth - (showIndex ? 280 : 0));
    },
    onActive: (event, ctx) => {
      const workspaceWidth = availableWidth - (showIndex ? 280 : 0);
      const newX = ctx.startX + event.translationX;
      splitRatio.value = Math.max(0.2, Math.min(0.8, newX / workspaceWidth));
    },
  });

  const pdfStyle = useAnimatedStyle(() => {
    const workspaceWidth = availableWidth - (showIndex ? 280 : 0);
    return {
      width: splitRatio.value * workspaceWidth,
    };
  });

  useEffect(() => {
    setCurrentPage(route.params?.page ?? 1);
  }, [route.params?.page, activeDocument?.id]);

  if (!activeDocument) {
    return null;
  }

  const toggleIndex = () => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setShowIndex(!showIndex);
  };

  const toggleCanvas = () => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setSettings({ rightPaneCollapsed: !settings.rightPaneCollapsed });
  };

  return (
    <View style={[styles.container, { backgroundColor: theme.background }]}>
      <View style={[styles.header, { backgroundColor: theme.surface, borderBottomColor: theme.border }]}>
        <View style={styles.headerLeft}>
          <TouchableOpacity onPress={toggleIndex} style={[styles.headerBtn, { backgroundColor: theme.background }]}>
            <PanelLeft size={20} color={showIndex ? theme.accent : theme.textPrimary} />
          </TouchableOpacity>
          <View style={styles.titleGroup}>
            <View style={styles.titleMeta}>
              <Text style={[styles.kicker, { color: theme.textSecondary }]}>Document workspace</Text>
              <Text style={[styles.docTitle, { color: theme.textPrimary }]} numberOfLines={1}>
                {activeDocument.title}
              </Text>
            </View>
            <View style={[styles.badge, { backgroundColor: theme.accent + '20' }]}>
              <Text style={[styles.badgeText, { color: theme.accent }]}>PDF</Text>
            </View>
          </View>
        </View>

        <View style={styles.headerRight}>
          <TouchableOpacity style={[styles.headerBtn, { backgroundColor: theme.background }]}>
            <Share2 size={20} color={theme.textPrimary} />
          </TouchableOpacity>
          <TouchableOpacity onPress={toggleCanvas} style={[styles.headerBtn, { backgroundColor: theme.background }]}>
            <PanelRight size={20} color={!settings.rightPaneCollapsed ? theme.accent : theme.textPrimary} />
          </TouchableOpacity>
        </View>
      </View>

      <View style={styles.workspace}>
        {showIndex && <BookmarkPanel currentPage={currentPage} />}

        <Animated.View style={[styles.pane, pdfStyle]}>
          <PdfPane page={currentPage} onPageChanged={setCurrentPage} />
        </Animated.View>

        {!settings.rightPaneCollapsed && (
          <>
            <PanGestureHandler onGestureEvent={gestureHandler}>
              <Animated.View style={[styles.handle, { backgroundColor: theme.background }]}>
                <View style={[styles.handleBar, { backgroundColor: theme.border }]} />
              </Animated.View>
            </PanGestureHandler>

            <View style={styles.canvasPane}>
              <CanvasPane />
            </View>
          </>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    minHeight: 72,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 18,
    paddingVertical: 10,
    borderBottomWidth: 1,
    zIndex: 10,
    shadowColor: '#000',
    shadowOpacity: 0.04,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 6 },
    elevation: 1,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  headerRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  headerBtn: {
    padding: 12,
    borderRadius: 14,
  },
  titleGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    marginLeft: 12,
    gap: 12,
  },
  titleMeta: {
    flex: 1,
  },
  kicker: {
    fontSize: 11,
    fontWeight: '800',
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginBottom: 4,
  },
  docTitle: {
    fontSize: 16,
    fontWeight: '800',
    maxWidth: 320,
  },
  badge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 999,
  },
  badgeText: {
    fontSize: 10,
    fontWeight: '900',
  },
  workspace: {
    flex: 1,
    flexDirection: 'row',
  },
  pane: {
    height: '100%',
  },
  canvasPane: {
    flex: 1,
  },
  handle: {
    width: 16,
    height: '100%',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 5,
  },
  handleBar: {
    width: 2,
    height: 48,
    borderRadius: 1,
  },
});
