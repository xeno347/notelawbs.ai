import React, { useState } from 'react';
import { View, StyleSheet, Dimensions } from 'react-native';
import { PanGestureHandler, PanGestureHandlerGestureEvent } from 'react-native-gesture-handler';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  useAnimatedGestureHandler
} from 'react-native-reanimated';
import { useSettings } from '../stores/useSettings';
import { colors } from '../theme/colors';
import PdfPane from '../components/PdfPane';
import CanvasPane from '../components/CanvasPane';
import BookmarkPanel from '../components/BookmarkPanel';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const SIDE_RAIL_WIDTH = 64; // Approximated for now

export default function DocumentWorkspaceScreen() {
  const { settings } = useSettings();
  const theme = settings.themeMode === 'dark' ? colors.dark : colors.light;

  const [showIndex, setShowIndex] = useState(false);
  const splitRatio = useSharedValue(settings.defaultSplitRatio);

  const gestureHandler = useAnimatedGestureHandler<PanGestureHandlerGestureEvent, { startX: number }>({
    onStart: (_, ctx) => {
      ctx.startX = splitRatio.value * (SCREEN_WIDTH - (settings.sideRailExpanded ? 220 : 64));
    },
    onActive: (event, ctx) => {
      const availableWidth = SCREEN_WIDTH - (settings.sideRailExpanded ? 220 : 64);
      const newX = ctx.startX + event.translationX;
      splitRatio.value = Math.max(0.35, Math.min(0.7, newX / availableWidth));
    },
  });

  const pdfStyle = useAnimatedStyle(() => ({
    flex: splitRatio.value,
  }));

  const canvasStyle = useAnimatedStyle(() => ({
    flex: 1 - splitRatio.value,
  }));

  return (
    <View style={[styles.container, { backgroundColor: theme.background }]}>
      {showIndex && <BookmarkPanel />}

      <Animated.View style={[styles.pane, pdfStyle]}>
        <PdfPane />
      </Animated.View>

      <PanGestureHandler onGestureEvent={gestureHandler}>
        <Animated.View style={[styles.handle, { backgroundColor: theme.background }]}>
          <View style={[styles.handleBar, { backgroundColor: theme.textSecondary + '40' }]} />
        </Animated.View>
      </PanGestureHandler>

      {!settings.rightPaneCollapsed && (
        <Animated.View style={[styles.pane, canvasStyle]}>
          <CanvasPane />
        </Animated.View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    flexDirection: 'row',
  },
  pane: {
    height: '100%',
  },
  handle: {
    width: 8,
    height: '100%',
    justifyContent: 'center',
    alignItems: 'center',
    cursor: 'col-resize',
  },
  handleBar: {
    width: 2,
    height: 40,
    borderRadius: 1,
  },
});
