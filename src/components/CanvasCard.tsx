import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { CanvasCard as CanvasCardType } from '../models/types';
import { useSettings } from '../stores/useSettings';
import { colors } from '../theme/colors';

export default function CanvasCard({ card }: { card: CanvasCardType }) {
  const { settings } = useSettings();
  const theme = settings.themeMode === 'dark' ? colors.dark : colors.light;

  return (
    <View style={[
      styles.card,
      {
        left: card.position.x,
        top: card.position.y,
        width: card.size.width,
        height: card.size.height,
        backgroundColor: theme.surface,
        borderColor: theme.background,
      }
    ]}>
      {card.type === 'excerpt' && (
        <View style={[styles.accentBar, { backgroundColor: theme.accentSecondary }]} />
      )}
      <Text style={[styles.content, { color: theme.textPrimary }]}>{card.content}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    position: 'absolute',
    padding: 16,
    borderRadius: 16,
    borderWidth: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 4,
    flexDirection: 'row',
  },
  accentBar: {
    width: 4,
    height: '100%',
    borderRadius: 2,
    marginRight: 12,
  },
  content: {
    flex: 1,
    fontSize: 14,
  },
});
