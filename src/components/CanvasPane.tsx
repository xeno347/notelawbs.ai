import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useSettings } from '../stores/useSettings';
import { colors } from '../theme/colors';

export default function CanvasPane() {
  const { settings } = useSettings();
  const theme = settings.themeMode === 'dark' ? colors.dark : colors.light;

  return (
    <View style={[styles.container, { backgroundColor: theme.canvasBg }]}>
      <View style={styles.grid}>
        <Text style={{ color: theme.textSecondary }}>Infinite Canvas [4000x4000]</Text>
        <Text style={{ color: theme.textSecondary }}>[ react-native-gesture-handler placeholder ]</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  grid: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    // In a real implementation, we'd use a repeating background image for the dot grid
  },
});
