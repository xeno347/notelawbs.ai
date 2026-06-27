import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useSettings } from '../stores/useSettings';
import { colors } from '../theme/colors';

export default function BookmarkPanel() {
  const { settings } = useSettings();
  const theme = settings.themeMode === 'dark' ? colors.dark : colors.light;

  return (
    <View style={[styles.container, { backgroundColor: theme.surface, borderRightWidth: 1, borderRightColor: theme.background }]}>
      <Text style={[styles.title, { color: theme.textPrimary }]}>Index</Text>
      <Text style={{ color: theme.textSecondary }}>Bookmarks will appear here</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    width: 280,
    height: '100%',
    padding: 16,
  },
  title: {
    fontSize: 20,
    fontWeight: 'bold',
    marginBottom: 16,
  },
});
