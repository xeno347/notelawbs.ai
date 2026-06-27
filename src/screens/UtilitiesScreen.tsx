import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useSettings } from '../stores/useSettings';
import { colors } from '../theme/colors';

export default function UtilitiesScreen() {
  const { settings } = useSettings();
  const theme = settings.themeMode === 'dark' ? colors.dark : colors.light;

  return (
    <View style={[styles.container, { backgroundColor: theme.background }]}>
      <Text style={[styles.title, { color: theme.textPrimary, fontFamily: 'Lora' }]}>Utilities</Text>
      <View style={styles.grid}>
        <Text style={{ color: theme.textSecondary }}>PDF tools will appear here</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 24,
  },
  title: {
    fontSize: 32,
    fontWeight: 'bold',
    marginBottom: 32,
  },
  grid: {
    flex: 1,
  },
});
