import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useSettings } from '../stores/useSettings';
import { colors } from '../theme/colors';
import { useActiveDocument } from '../stores/useActiveDocument';

export default function PdfPane() {
  const { settings } = useSettings();
  const { activeDocument } = useActiveDocument();
  const theme = settings.themeMode === 'dark' ? colors.dark : colors.light;

  return (
    <View style={[styles.container, { backgroundColor: theme.surface }]}>
      {activeDocument ? (
        <View style={styles.viewer}>
          <Text style={{ color: theme.textPrimary }}>PDF Viewer for: {activeDocument.title}</Text>
          <Text style={{ color: theme.textSecondary }}>[ react-native-pdf placeholder ]</Text>
        </View>
      ) : (
        <Text style={{ color: theme.textSecondary }}>No document selected</Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 16,
    borderRightWidth: 1,
    borderRightColor: '#00000010',
  },
  viewer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
});
