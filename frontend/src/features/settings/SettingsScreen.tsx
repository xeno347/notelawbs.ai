import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, Switch, TouchableOpacity, ScrollView, TextInput } from 'react-native';
import { useSettings } from './useSettings';
import { colors } from '../../theme/colors';
import { useAuth } from '../auth/useAuth';
import {
  Moon,
  Sun,
  Layout,
  Trash2,
  Globe,
  Database,
  ChevronRight,
  Info,
  LogOut,
} from 'lucide-react-native';

export default function SettingsScreen() {
  const { settings, setSettings } = useSettings();
  const { user, signOut } = useAuth();
  const theme = settings.themeMode === 'dark' ? colors.dark : colors.light;
  const [backendUrlDraft, setBackendUrlDraft] = useState(settings.backendUrl);

  useEffect(() => {
    setBackendUrlDraft(settings.backendUrl);
  }, [settings.backendUrl]);

  const SettingRow = ({
    icon: Icon,
    label,
    value,
    onValueChange,
    type = 'switch'
  }: {
    icon: any,
    label: string,
    value?: any,
    onValueChange?: (v: any) => void,
    type?: 'switch' | 'link' | 'text'
  }) => (
    <View style={[styles.row, { borderBottomColor: theme.border }]}>
      <View style={styles.rowLeft}>
        <View style={[styles.iconBox, { backgroundColor: theme.background }]}>
          <Icon size={18} color={theme.accent} />
        </View>
        <Text style={[styles.label, { color: theme.textPrimary }]}>{label}</Text>
      </View>
      {type === 'switch' ? (
        <Switch
          value={value}
          onValueChange={onValueChange}
          trackColor={{ false: theme.border, true: theme.accent }}
          thumbColor={theme.surface}
        />
      ) : (
        <ChevronRight size={18} color={theme.textSecondary} />
      )}
    </View>
  );

  return (
    <ScrollView style={[styles.container, { backgroundColor: theme.background }]} contentContainerStyle={styles.scrollContent}>
      <View style={styles.content}>
        <View style={styles.heroBlock}>
          <Text style={[styles.kicker, { color: theme.accent }]}>Workspace controls</Text>
          <Text style={[styles.title, { color: theme.textPrimary }]}>Settings</Text>
          <Text style={[styles.subtitle, { color: theme.textSecondary }]}>
            Tune your workspace, sync target, and appearance in one place.
          </Text>
        </View>

        <View style={[styles.accountCard, { backgroundColor: theme.surface, borderColor: theme.border }]}>
          <View style={styles.accountText}>
            <Text style={[styles.accountLabel, { color: theme.textSecondary }]}>Signed in as</Text>
            <Text style={[styles.accountValue, { color: theme.textPrimary }]}>{user?.name || user?.email || 'Unknown user'}</Text>
            <Text style={[styles.accountMeta, { color: theme.textSecondary }]}>{user?.email || ''}</Text>
          </View>
          <TouchableOpacity onPress={signOut} style={[styles.logoutBtn, { borderColor: theme.border }]}>
            <LogOut size={16} color={theme.textPrimary} />
            <Text style={[styles.logoutText, { color: theme.textPrimary }]}>Logout</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: theme.textSecondary }]}>Appearance</Text>
          <View style={[styles.card, { backgroundColor: theme.surface, borderColor: theme.border }]}>
            <SettingRow
              icon={settings.themeMode === 'dark' ? Moon : Sun}
              label="Dark Mode"
              value={settings.themeMode === 'dark'}
              onValueChange={(val) => setSettings({ themeMode: val ? 'dark' : 'light' })}
            />
            <SettingRow
              icon={Layout}
              label="Side Rail Expanded"
              value={settings.sideRailExpanded}
              onValueChange={(val) => setSettings({ sideRailExpanded: val })}
            />
          </View>
        </View>

        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: theme.textSecondary }]}>Backend & Data</Text>
          <View style={[styles.card, { backgroundColor: theme.surface, borderColor: theme.border }]}>
            <SettingRow icon={Globe} label="Server Configuration" type="link" />
            <SettingRow icon={Database} label="Sync Status" type="link" />
          </View>
          <Text style={[styles.backendHint, { color: theme.textSecondary }]}>Backend URL: {settings.backendUrl}</Text>
          <View style={[styles.backendEditor, { backgroundColor: theme.surface, borderColor: theme.border }]}>
            <Text style={[styles.backendLabel, { color: theme.textPrimary }]}>Backend URL</Text>
            <TextInput
              value={backendUrlDraft}
              onChangeText={setBackendUrlDraft}
              autoCapitalize="none"
              autoCorrect={false}
              style={[styles.backendInput, { color: theme.textPrimary, borderColor: theme.border, backgroundColor: theme.background }]}
              placeholder="http://127.0.0.1:4000"
              placeholderTextColor={theme.textSecondary}
            />
            <TouchableOpacity
              onPress={() => setSettings({ backendUrl: backendUrlDraft.trim() || settings.backendUrl })}
              style={[styles.backendSaveBtn, { backgroundColor: theme.accent }]}
            >
              <Text style={styles.backendSaveText}>Save backend URL</Text>
            </TouchableOpacity>
          </View>
        </View>

        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: theme.textSecondary }]}>Danger Zone</Text>
          <TouchableOpacity
            style={[styles.card, styles.dangerCard, { backgroundColor: theme.surface, borderColor: '#FF3B3030' }]}
            onPress={() => { /* Reset Demo */ }}
          >
            <View style={styles.rowLeft}>
               <View style={[styles.iconBox, { backgroundColor: '#FF3B3010' }]}>
                 <Trash2 size={18} color="#FF3B30" />
               </View>
               <Text style={[styles.label, { color: '#FF3B30' }]}>Reset Demo Documents</Text>
            </View>
            <Info size={18} color="#FF3B30" />
          </TouchableOpacity>
        </View>

        <View style={styles.footer}>
           <Text style={{ color: theme.textSecondary, fontSize: 12 }}>NoteLawb.ai v1.0.0 (Bare RN)</Text>
        </View>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  content: {
    maxWidth: 800,
    alignSelf: 'center',
    width: '100%',
    padding: 40,
  },
  scrollContent: {
    paddingBottom: 40,
  },
  heroBlock: {
    marginBottom: 28,
  },
  kicker: {
    fontSize: 12,
    fontWeight: '800',
    textTransform: 'uppercase',
    letterSpacing: 1.2,
    marginBottom: 8,
  },
  title: {
    fontSize: 36,
    fontWeight: '800',
    letterSpacing: -0.8,
  },
  subtitle: {
    marginTop: 10,
    fontSize: 15,
    lineHeight: 22,
  },
  section: {
    marginBottom: 32,
  },
  sectionTitle: {
    fontSize: 13,
    fontWeight: '700',
    textTransform: 'uppercase',
    marginBottom: 12,
    marginLeft: 4,
    letterSpacing: 0.5,
  },
  card: {
    borderRadius: 16,
    borderWidth: 1,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOpacity: 0.04,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 6 },
    elevation: 1,
  },
  accountCard: {
    borderRadius: 20,
    borderWidth: 1,
    padding: 16,
    marginBottom: 32,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 16,
    shadowColor: '#000',
    shadowOpacity: 0.04,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 6 },
    elevation: 1,
  },
  accountText: {
    flex: 1,
  },
  accountLabel: {
    fontSize: 12,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 4,
  },
  accountValue: {
    fontSize: 18,
    fontWeight: '800',
  },
  accountMeta: {
    fontSize: 13,
    marginTop: 4,
  },
  logoutBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 14,
    borderWidth: 1,
  },
  logoutText: {
    fontSize: 14,
    fontWeight: '700',
  },
  backendHint: {
    marginTop: 10,
    marginLeft: 4,
    fontSize: 12,
  },
  backendEditor: {
    marginTop: 12,
    borderWidth: 1,
    borderRadius: 16,
    padding: 14,
    gap: 10,
    shadowColor: '#000',
    shadowOpacity: 0.03,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
    elevation: 1,
  },
  backendLabel: {
    fontSize: 12,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  backendInput: {
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14,
  },
  backendSaveBtn: {
    minHeight: 44,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  backendSaveText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '700',
  },
  dangerCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingRight: 16,
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
  },
  rowLeft: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  iconBox: {
    width: 36,
    height: 36,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 16,
  },
  label: {
    fontSize: 16,
    fontWeight: '600',
  },
  footer: {
    marginTop: 40,
    alignItems: 'center',
    paddingBottom: 40,
  }
});
