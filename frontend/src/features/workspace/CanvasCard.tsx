import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, {
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
} from 'react-native-reanimated';
import { CanvasCard as CanvasCardType } from '../../models/types';
import { useSettings } from '../settings/useSettings';
import { colors } from '../../theme/colors';

type Props = {
  card: CanvasCardType;
  selected?: boolean;
  editMode?: boolean;
  connectMode?: boolean;
  onPress?: () => void;
  onDragEnd?: (next: { x: number; y: number }) => void;
  onResizeEnd?: (next: { width: number; height: number }) => void;
};

export default function CanvasCard({
  card,
  selected,
  editMode,
  connectMode,
  onPress,
  onDragEnd,
  onResizeEnd,
}: Props) {
  const { settings } = useSettings();
  const theme = settings.themeMode === 'dark' ? colors.dark : colors.light;

  const dragX = useSharedValue(0);
  const dragY = useSharedValue(0);
  const resizeW = useSharedValue(0);
  const resizeH = useSharedValue(0);

  const panGesture = Gesture.Pan()
    .enabled(Boolean(editMode))
    .onUpdate((event) => {
      dragX.value = event.translationX;
      dragY.value = event.translationY;
    })
    .onEnd((event) => {
      runOnJS(onDragEnd || (() => undefined))({
        x: card.position.x + event.translationX,
        y: card.position.y + event.translationY,
      });
      dragX.value = 0;
      dragY.value = 0;
    });

  const resizeGesture = Gesture.Pan()
    .enabled(Boolean(editMode))
    .onUpdate((event) => {
      resizeW.value = event.translationX;
      resizeH.value = event.translationY;
    })
    .onEnd((event) => {
      runOnJS(onResizeEnd || (() => undefined))({
        width: Math.max(160, card.size.width + event.translationX),
        height: Math.max(96, card.size.height + event.translationY),
      });
      resizeW.value = 0;
      resizeH.value = 0;
    });

  const tapGesture = Gesture.Tap().onEnd(() => {
    runOnJS(onPress || (() => undefined))();
  });

  const gesture = Gesture.Race(tapGesture, panGesture);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: dragX.value }, { translateY: dragY.value }],
  }));

  const resizeStyle = useAnimatedStyle(() => ({
    width: card.size.width + resizeW.value,
    height: card.size.height + resizeH.value,
  }));

  return (
    <GestureDetector gesture={gesture}>
      <Animated.View
        style={[
          styles.card,
          selected ? styles.cardShadowSelected : styles.cardShadow,
          animatedStyle,
          resizeStyle,
          {
            left: card.position.x,
            top: card.position.y,
            backgroundColor: card.type === 'excerpt' ? theme.excerptCard : theme.surface,
            borderColor: selected ? theme.accent : theme.background + '60',
          },
        ]}
      >
        {card.type === 'excerpt' && (
          <View style={[styles.accentBar, { backgroundColor: theme.accentSecondary }]} />
        )}

        <View style={styles.contentContainer}>
          <Text style={[styles.content, { color: theme.textPrimary }]} numberOfLines={8}>
            {card.content}
          </Text>
          {card.sourcePageIndex ? (
            <Text style={[styles.sourceLink, { color: theme.accentSecondary }]}>
              Page {card.sourcePageIndex}
            </Text>
          ) : null}
        </View>

        {editMode && (
          <View style={[styles.resizeHandleWrap, { borderColor: theme.border }]}>
            <GestureDetector gesture={resizeGesture}>
              <View style={[styles.resizeHandle, { backgroundColor: theme.accent }]} />
            </GestureDetector>
          </View>
        )}

        {connectMode && <View style={[styles.connectionDot, { backgroundColor: theme.accent }]} />}
      </Animated.View>
    </GestureDetector>
  );
}

const styles = StyleSheet.create({
  card: {
    position: 'absolute',
    padding: 12,
    borderRadius: 16,
    borderWidth: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowRadius: 4,
    elevation: 2,
    flexDirection: 'row',
    minWidth: 160,
    minHeight: 96,
  },
  cardShadow: {
    shadowOpacity: 0.08,
  },
  cardShadowSelected: {
    shadowOpacity: 0.14,
  },
  accentBar: {
    width: 3,
    height: '100%',
    borderRadius: 1.5,
    marginRight: 10,
  },
  contentContainer: {
    flex: 1,
  },
  content: {
    fontSize: 13,
    lineHeight: 18,
    fontWeight: '500',
  },
  sourceLink: {
    fontSize: 10,
    fontWeight: '800',
    marginTop: 8,
    textTransform: 'uppercase',
  },
  resizeHandleWrap: {
    position: 'absolute',
    right: -6,
    bottom: -6,
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#fff',
  },
  resizeHandle: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  connectionDot: {
    position: 'absolute',
    right: 8,
    top: 8,
    width: 8,
    height: 8,
    borderRadius: 4,
  },
});
