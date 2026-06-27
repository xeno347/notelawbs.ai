import React from 'react';
import { View, Text, StyleSheet, Switch, TouchableOpacity } from 'react-native';
import { useSettings } from '../stores/useSettings';
import { colors } from '../theme/colors';

export default function SettingsScreen() {
  const { settings, setSettings } = useSettings();
  const theme = settings.themeMode === 'dark' ? colors.dark : colors.light;

  return (
    <View style={[styles.container, { backgroundColor: theme.background }]}>
      <Text style={[styles.title, { color: theme.textPrimary, fontFamily: 'Lora' }]}>Settings</Text>

      <View style={styles.section}>
        <View style={styles.row}>
          <Text style={[styles.label, { color: theme.textPrimary }]}>Dark Mode</Text>
          <Switch
            value={settings.themeMode === 'dark'}
            onValueChange={(val) => setSettings({ themeMode: val ? 'dark' : 'light' })}
          />
        </View>

        <View style={styles.row}>
          <Text style={[styles.label, { color: theme.textPrimary }]}>Side Rail Expanded</Text>
          <Switch
            value={settings.sideRailExpanded}
            onValueChange={(val) => setSettings({ sideRailExpanded: val })}
          />
        </View>

        <TouchableOpacity
          style={[styles.dangerButton, { borderColor: '#FF3B30' }]}
          onPress={() => { /* Reset Demo */ }}
        >
          <Text style={{ color: '#FF3B30', fontWeight: 'bold' }}>Reset Demo Documents</Text>
        </TouchableOpacity>
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
  section: {
    maxWidth: 600,
    gap: 16,
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
  },
  label: {
    fontSize: 18,
  },
  dangerButton: {
    marginTop: 32,
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    alignItems: 'center',
  },
});
