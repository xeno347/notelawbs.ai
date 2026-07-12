import React, { useEffect, useMemo, useState } from 'react';
import { View, StyleSheet, Text, TouchableOpacity } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, {
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
} from 'react-native-reanimated';
import Svg, { Line, Circle } from 'react-native-svg';
import { useSettings } from '../settings/useSettings';
import { colors } from '../../theme/colors';
import { useCanvas } from './useCanvas';
import { useActiveDocument } from './useActiveDocument';
import { useDragDrop } from './useDragDrop';
import CanvasCard from './CanvasCard';
import { Link2, MousePointer2, Pencil, RotateCcw, Maximize } from 'lucide-react-native';
import { createId } from '../../utils/id';

const CANVAS_SIZE = 4000;

type Tool = 'hand' | 'edit' | 'connect';

export default function CanvasPane() {
  const { settings } = useSettings();
  const { activeDocument } = useActiveDocument();
  const { cards, connectors, fetchCanvasData, addCard, addConnector, updateCard } = useCanvas();
  const { draggedText, draggedSource, setDragged } = useDragDrop();
  const theme = settings.themeMode === 'dark' ? colors.dark : colors.light;

  const offset = useSharedValue({ x: 0, y: 0 });
  const start = useSharedValue({ x: 0, y: 0 });
  const scale = useSharedValue(1);
  const savedScale = useSharedValue(1);

  const [tool, setTool] = useState<Tool>('hand');
  const [selectedCardId, setSelectedCardId] = useState<string | null>(null);
  const [connectorFromId, setConnectorFromId] = useState<string | null>(null);

  useEffect(() => {
    if (activeDocument) {
      fetchCanvasData(activeDocument.id);
    }
  }, [activeDocument, fetchCanvasData]);

  const resetCanvas = () => {
    offset.value = withSpring({ x: 0, y: 0 });
    scale.value = withSpring(1);
    savedScale.value = 1;
  };

  const dropAt = (x: number, y: number) => {
    if (!draggedText || !activeDocument) {
      return;
    }

    addCard({
      id: createId('card'),
      workspaceId: activeDocument.id,
      type: 'excerpt' as any,
      position: { x: (x - offset.value.x) / scale.value, y: (y - offset.value.y) / scale.value },
      size: { width: 280, height: 150 },
      content: draggedText,
      sourceDocumentId: draggedSource?.documentId,
      sourcePageIndex: draggedSource?.pageIndex,
      accentColor: 0xFF6B8E23,
      isPinned: false,
      isBold: false,
      isUnderline: false,
      createdAt: new Date().toISOString(),
    });

    setDragged(null);
  };

  const handleCardPress = (cardId: string) => {
    if (tool === 'connect') {
      if (!connectorFromId) {
        setConnectorFromId(cardId);
        setSelectedCardId(cardId);
        return;
      }
      if (connectorFromId !== cardId) {
        const fromCard = cards.find((card) => card.id === connectorFromId);
        const toCard = cards.find((card) => card.id === cardId);
        if (fromCard && toCard && activeDocument) {
          addConnector({
            documentId: activeDocument.id,
            fromCardId: fromCard.id,
            toCardId: toCard.id,
            type: 'related' as any,
            label: 'Related',
          });
        }
      }
      setConnectorFromId(null);
      setSelectedCardId(cardId);
      return;
    }

    setSelectedCardId(cardId);
  };

  const tapGesture = Gesture.Tap().onEnd((event) => {
    if (draggedText && tool !== 'connect') {
      runOnJS(dropAt)(event.x, event.y);
    }
  });

  const panGesture = Gesture.Pan()
    .enabled(tool === 'hand')
    .onStart(() => {
      start.value = { x: offset.value.x, y: offset.value.y };
    })
    .onUpdate((event) => {
      offset.value = {
        x: start.value.x + event.translationX,
        y: start.value.y + event.translationY,
      };
    });

  const pinchGesture = Gesture.Pinch()
    .enabled(tool === 'hand')
    .onUpdate((event) => {
      scale.value = savedScale.value * event.scale;
    })
    .onEnd(() => {
      savedScale.value = scale.value;
    });

  const combinedGesture = Gesture.Simultaneous(panGesture, pinchGesture);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [
      { translateX: offset.value.x },
      { translateY: offset.value.y },
      { scale: scale.value },
    ],
  }));

  const connectionLines = useMemo(() => {
    return connectors
      .map((connector) => {
        const from = cards.find((card) => card.id === connector.fromCardId);
        const to = cards.find((card) => card.id === connector.toCardId);
        if (!from || !to) {
          return null;
        }
        return {
          id: connector.id,
          x1: from.position.x + from.size.width / 2,
          y1: from.position.y + from.size.height / 2,
          x2: to.position.x + to.size.width / 2,
          y2: to.position.y + to.size.height / 2,
        };
      })
      .filter(Boolean) as Array<{ id: string; x1: number; y1: number; x2: number; y2: number }>;
  }, [cards, connectors]);
  const dropIndicatorTextStyle = useMemo(() => [styles.dropIndicatorText, { color: theme.accent }], [theme.accent]);
  const modeBadgeTextStyle = useMemo(() => [styles.modeBadgeText, { color: theme.textPrimary }], [theme.textPrimary]);

  return (
    <View style={[styles.container, { backgroundColor: theme.canvasBg }]}>
      <GestureDetector gesture={Gesture.Exclusive(tapGesture, combinedGesture)}>
        <Animated.View style={[styles.canvas, animatedStyle, { width: CANVAS_SIZE, height: CANVAS_SIZE }]}>
          <View style={styles.gridLayer}>
            <Svg width={CANVAS_SIZE} height={CANVAS_SIZE} style={StyleSheet.absoluteFill}>
              {connectionLines.map((line) => (
                <React.Fragment key={line.id}>
                  <Line
                    x1={line.x1}
                    y1={line.y1}
                    x2={line.x2}
                    y2={line.y2}
                    stroke={theme.accent}
                    strokeWidth={3}
                    strokeOpacity={0.45}
                  />
                  <Circle cx={line.x2} cy={line.y2} r={4} fill={theme.accent} />
                </React.Fragment>
              ))}
            </Svg>

            {cards.map((card) => (
              <CanvasCard
                key={card.id}
                card={card}
                selected={selectedCardId === card.id || connectorFromId === card.id}
                editMode={tool === 'edit'}
                connectMode={tool === 'connect'}
                onPress={() => handleCardPress(card.id)}
                onDragEnd={(next) => updateCard(card.id, { position: next })}
                onResizeEnd={(next) => updateCard(card.id, { size: next })}
              />
            ))}
          </View>
        </Animated.View>
      </GestureDetector>

      {draggedText && (
        <View style={[styles.dropIndicator, { backgroundColor: theme.accent + '20', borderColor: theme.accent }]}>
          <Text style={dropIndicatorTextStyle}>
            TAP CANVAS TO DROP EXCERPT
          </Text>
        </View>
      )}

      <View style={[styles.toolbar, { backgroundColor: theme.surface, borderColor: theme.border }]}>
        <TouchableOpacity
          style={[styles.toolBtn, tool === 'hand' && { backgroundColor: theme.background }]}
          onPress={() => setTool('hand')}
        >
          <MousePointer2 size={18} color={tool === 'hand' ? theme.accent : theme.textPrimary} />
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.toolBtn, tool === 'edit' && { backgroundColor: theme.background }]}
          onPress={() => setTool('edit')}
        >
          <Pencil size={18} color={tool === 'edit' ? theme.accent : theme.textPrimary} />
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.toolBtn, tool === 'connect' && { backgroundColor: theme.background }]}
          onPress={() => setTool('connect')}
        >
          <Link2 size={18} color={tool === 'connect' ? theme.accent : theme.textPrimary} />
        </TouchableOpacity>

        <View style={[styles.divider, { backgroundColor: theme.border }]} />

        <TouchableOpacity style={styles.toolBtn} onPress={() => setConnectorFromId(null)}>
          <RotateCcw size={18} color={theme.textPrimary} />
        </TouchableOpacity>
        <TouchableOpacity style={styles.toolBtn} onPress={resetCanvas}>
          <Maximize size={18} color={theme.textPrimary} />
        </TouchableOpacity>
      </View>

      {tool === 'connect' && (
        <View style={[styles.modeBadge, { backgroundColor: theme.surface, borderColor: theme.border }]}>
          <Text style={modeBadgeTextStyle}>
            Tap two cards to connect
          </Text>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    overflow: 'hidden',
  },
  canvas: {
    backgroundColor: 'transparent',
  },
  gridLayer: {
    flex: 1,
  },
  toolbar: {
    position: 'absolute',
    top: 20,
    right: 20,
    flexDirection: 'row',
    padding: 6,
    borderRadius: 14,
    borderWidth: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 10,
    elevation: 5,
    gap: 4,
    alignItems: 'center',
  },
  toolBtn: {
    width: 36,
    height: 36,
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: 10,
  },
  divider: {
    width: 1,
    height: 24,
    alignSelf: 'center',
    marginHorizontal: 4,
  },
  dropIndicator: {
    position: 'absolute',
    bottom: 40,
    alignSelf: 'center',
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderStyle: 'dashed',
  },
  dropIndicatorText: {
    fontWeight: '700',
  },
  modeBadge: {
    position: 'absolute',
    top: 76,
    right: 20,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 12,
    borderWidth: 1,
  },
  modeBadgeText: {
    fontSize: 12,
    fontWeight: '700',
  },
});
