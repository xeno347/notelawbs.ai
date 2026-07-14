import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable, Alert, Switch, useWindowDimensions } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  X,
  Monitor,
  Sun,
  Moon,
  LogOut,
  Trash2,
  Bell,
  Images,
  Check,
} from 'lucide-react-native';
import { useTheme, useThemeStore, useThemeMode, RADIUS, type ThemeMode } from '../theme';
import { useStore } from '../store';
import { useAuth } from '../auth/authStore';
import { getStoredKey, saveKey, clearKey } from '../research/service';
import {
  getSupabaseOverrides,
  saveSupabaseOverrides,
  isSupabaseConfigured,
} from '../services/supabase';
import {
  PERMISSION_ITEMS,
  requestPermission,
  loadPermissionState,
  type PermissionKey,
  type PermissionState,
} from '../services/permissionsService';
import { AppButton, Field, Segmented } from './ui';

const PERM_ICONS: Record<PermissionKey, React.ComponentType<any>> = {
  notifications: Bell,
  media: Images,
};

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  const p = useTheme();
  return (
    <View style={{ marginBottom: 26 }}>
      <Text style={[styles.sectionTitle, { color: p.textMuted }]}>{title.toUpperCase()}</Text>
      <View style={[styles.sectionBody, { backgroundColor: p.surface, borderColor: p.border }]}>
        {children}
      </View>
    </View>
  );
}

function RowDivider() {
  const p = useTheme();
  return <View style={{ height: 1, backgroundColor: p.border, marginLeft: 16 }} />;
}

export default function SettingsScreen({ onClose }: { onClose: () => void }) {
  const p = useTheme();
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const isTablet = width >= 768;

  const mode = useThemeMode();
  const setMode = useThemeStore((s) => s.setMode);

  const user = useAuth((s) => s.user);
  const logout = useAuth((s) => s.logout);
  const resetWorkspace = useStore((s) => s.resetWorkspace);
  const docName = useStore((s) => s.docName);
  const highlights = useStore((s) => s.highlights);
  const nodes = useStore((s) => s.nodes);
  const autoOcr = useStore((s) => s.autoOcr);
  const setAutoOcr = useStore((s) => s.setAutoOcr);

  const [apiKey, setApiKey] = useState('');
  const [keyLoaded, setKeyLoaded] = useState(false);
  const [keySaved, setKeySaved] = useState(false);
  const [permStatus, setPermStatus] = useState<Partial<Record<PermissionKey, PermissionState>>>({});
  const [sbUrl, setSbUrl] = useState('');
  const [sbKey, setSbKey] = useState('');
  const [sbSaved, setSbSaved] = useState(false);
  const [sbConfigured, setSbConfigured] = useState(isSupabaseConfigured());

  useEffect(() => {
    getStoredKey().then((k) => {
      if (k) setApiKey(k);
      setKeyLoaded(true);
    });
    (async () => {
      const entries = await Promise.all(
        PERMISSION_ITEMS.map(async (it) => [it.key, await loadPermissionState(it.key)] as const),
      );
      setPermStatus((s) => {
        const next = { ...s };
        for (const [key, state] of entries) if (state) next[key] = state;
        return next;
      });
    })();
    const ov = getSupabaseOverrides();
    setSbUrl(ov.url);
    setSbKey(ov.anonKey);
  }, []);

  const onSaveSupabase = async () => {
    await saveSupabaseOverrides(sbUrl, sbKey);
    setSbConfigured(isSupabaseConfigured());
    setSbSaved(true);
    setTimeout(() => setSbSaved(false), 1800);
  };

  const onSaveKey = async () => {
    if (apiKey.trim()) await saveKey(apiKey);
    else await clearKey();
    setKeySaved(true);
    setTimeout(() => setKeySaved(false), 1800);
  };

  const onLogout = () => {
    Alert.alert('Sign out', 'Your notes stay saved on this device. Sign out now?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Sign out',
        style: 'destructive',
        onPress: async () => {
          await logout();
          onClose();
        },
      },
    ]);
  };

  const onReset = () => {
    Alert.alert(
      'Reset workspace',
      'Clear the open document, all highlights, canvas cards, handwriting and index? This cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Reset', style: 'destructive', onPress: () => resetWorkspace() },
      ],
    );
  };

  const allowPerm = async (key: PermissionKey) => {
    const state = await requestPermission(key);
    setPermStatus((s) => ({ ...s, [key]: state }));
  };

  const modeOptions: { key: ThemeMode; label: string; icon: React.ComponentType<any> }[] = [
    { key: 'system', label: 'System', icon: Monitor },
    { key: 'light', label: 'Light', icon: Sun },
    { key: 'dark', label: 'Dark', icon: Moon },
  ];

  return (
    <View style={[StyleSheet.absoluteFill, { backgroundColor: p.bg, zIndex: 200 }]}>
      <View style={[styles.header, { paddingTop: insets.top + 10, borderBottomColor: p.border, backgroundColor: p.surface }]}>
        <Text style={[styles.headerTitle, { color: p.text }]}>Settings</Text>
        <Pressable accessibilityLabel="Close settings" onPress={onClose} style={[styles.closeBtn, { borderColor: p.border }]}>
          <X size={20} color={p.text} />
        </Pressable>
      </View>

      <ScrollView
        contentContainerStyle={[styles.scroll, { paddingBottom: insets.bottom + 40 }]}
        showsVerticalScrollIndicator={false}>
        <View style={{ width: '100%', maxWidth: isTablet ? 640 : 560, alignSelf: 'center' }}>
          <Section title="Appearance">
            <View style={{ padding: 16, gap: 12 }}>
              <Text style={[styles.rowLabel, { color: p.text }]}>Theme</Text>
              <Segmented
                options={modeOptions.map((m) => ({ key: m.key, label: m.label }))}
                value={mode}
                onChange={(k) => setMode(k as ThemeMode)}
              />
              <Text style={[styles.hint, { color: p.textMuted }]}>
                System follows your device. Light is the default when no preference is set.
              </Text>
            </View>
          </Section>

          <Section title="Reading">
            <View style={styles.row}>
              <View style={{ flex: 1 }}>
                <Text style={[styles.rowLabel, { color: p.text }]}>Auto text recognition</Text>
                <Text style={[styles.rowSub, { color: p.textMuted }]}>
                  Run OCR automatically as you turn pages so excerpts and search stay ready. Turn off
                  to save battery on long sessions.
                </Text>
              </View>
              <Switch
                value={autoOcr}
                onValueChange={setAutoOcr}
                trackColor={{ true: p.accent, false: p.border }}
                thumbColor="#fff"
              />
            </View>
          </Section>

          <Section title="Account">
            <View style={styles.row}>
              <View style={{ flex: 1 }}>
                <Text style={[styles.rowLabel, { color: p.text }]}>{user?.displayName || 'Guest'}</Text>
                <Text style={[styles.rowSub, { color: p.textMuted }]}>{user?.email || 'Not signed in'}</Text>
              </View>
            </View>
            <RowDivider />
            <Pressable style={styles.row} onPress={onLogout}>
              <LogOut size={18} color={p.danger} />
              <Text style={[styles.rowAction, { color: p.danger }]}>Sign out</Text>
            </Pressable>
          </Section>

          <Section title="AI & research">
            <View style={{ padding: 16, gap: 10 }}>
              <Field
                label="Anthropic API key"
                value={apiKey}
                onChangeText={setApiKey}
                placeholder={keyLoaded ? 'sk-ant-…' : 'Loading…'}
                secureTextEntry
                autoCapitalize="none"
                editable={keyLoaded}
              />
              <Text style={[styles.hint, { color: p.textMuted }]}>
                Stored only on this device and sent directly to Anthropic. Without a key, research
                runs in offline mode.
              </Text>
              <View style={{ flexDirection: 'row', gap: 10, alignItems: 'center' }}>
                <AppButton label={keySaved ? 'Saved' : 'Save key'} variant="secondary" onPress={onSaveKey} />
                {apiKey ? (
                  <AppButton
                    label="Clear"
                    variant="ghost"
                    onPress={() => {
                      setApiKey('');
                      clearKey();
                    }}
                  />
                ) : null}
              </View>
            </View>
          </Section>

          <Section title="Collaboration">
            <View style={{ padding: 16, gap: 10 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                <View
                  style={{
                    width: 8,
                    height: 8,
                    borderRadius: 4,
                    backgroundColor: sbConfigured ? p.success : p.textMuted,
                  }}
                />
                <Text style={[styles.rowLabel, { color: p.text }]}>
                  {sbConfigured ? 'Live sharing connected' : 'Live sharing not connected'}
                </Text>
              </View>
              <Text style={[styles.hint, { color: p.textMuted }]}>
                Paste your Supabase project URL and anon key to enable real-time sharing and cloud
                sign-in. Find them in your Supabase dashboard → Project Settings → API.
              </Text>
              <Field
                label="Supabase URL"
                value={sbUrl}
                onChangeText={setSbUrl}
                placeholder="https://xxxx.supabase.co"
                autoCapitalize="none"
              />
              <Field
                label="Anon key"
                value={sbKey}
                onChangeText={setSbKey}
                placeholder="eyJhbGciOi…"
                autoCapitalize="none"
                secureTextEntry
              />
              <View style={{ flexDirection: 'row', gap: 10, alignItems: 'center' }}>
                <AppButton label={sbSaved ? 'Saved' : 'Save & connect'} variant="secondary" onPress={onSaveSupabase} />
                {sbUrl || sbKey ? (
                  <AppButton
                    label="Clear"
                    variant="ghost"
                    onPress={async () => {
                      setSbUrl('');
                      setSbKey('');
                      await saveSupabaseOverrides('', '');
                      setSbConfigured(isSupabaseConfigured());
                    }}
                  />
                ) : null}
              </View>
            </View>
          </Section>

          <Section title="Permissions">
            {PERMISSION_ITEMS.map((item, i) => {
              const Icon = PERM_ICONS[item.key];
              const granted = permStatus[item.key] === 'granted';
              return (
                <View key={item.key}>
                  {i > 0 && <RowDivider />}
                  <View style={styles.row}>
                    <Icon size={18} color={p.textMid} />
                    <View style={{ flex: 1 }}>
                      <Text style={[styles.rowLabel, { color: p.text }]}>{item.label}</Text>
                      <Text style={[styles.rowSub, { color: p.textMuted }]}>{item.description}</Text>
                    </View>
                    {granted ? (
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5 }}>
                        <Check size={15} color={p.success} />
                        <Text style={{ color: p.success, fontWeight: '700', fontSize: 12.5 }}>On</Text>
                      </View>
                    ) : (
                      <AppButton label="Allow" variant="secondary" onPress={() => allowPerm(item.key)} />
                    )}
                  </View>
                </View>
              );
            })}
          </Section>

          <Section title="Data & backup">
            <View style={styles.row}>
              <View style={{ flex: 1 }}>
                <Text style={[styles.rowLabel, { color: p.text }]}>Current workspace</Text>
                <Text style={[styles.rowSub, { color: p.textMuted }]}>
                  {docName ? `${docName} · ${highlights.length} highlights · ${nodes.length} cards` : 'No document open'}
                </Text>
              </View>
            </View>
            <RowDivider />
            <Pressable style={styles.row} onPress={onReset}>
              <Trash2 size={18} color={p.danger} />
              <Text style={[styles.rowAction, { color: p.danger }]}>Reset workspace</Text>
            </Pressable>
          </Section>

          <Section title="About">
            <View style={styles.row}>
              <Text style={[styles.rowLabel, { color: p.text }]}>Version</Text>
              <Text style={[styles.rowSub, { color: p.textMuted }]}>1.0.0</Text>
            </View>
            <RowDivider />
            <View style={styles.row}>
              <Text style={[styles.rowSub, { color: p.textMuted, flex: 1 }]}>
                LitNotes Canvas keeps your judgments, notes and research on-device. No data leaves
                this machine except AI research you explicitly run.
              </Text>
            </View>
          </Section>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingBottom: 12,
    borderBottomWidth: 1,
  },
  headerTitle: { fontSize: 20, fontWeight: '800' },
  closeBtn: {
    width: 38,
    height: 38,
    borderRadius: RADIUS.pill,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  scroll: { padding: 20, paddingTop: 24 },
  sectionTitle: { fontSize: 11.5, fontWeight: '800', letterSpacing: 0.8, marginBottom: 8, marginLeft: 4 },
  sectionBody: { borderRadius: RADIUS.lg, borderWidth: 1, overflow: 'hidden' },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 16 },
  rowLabel: { fontSize: 15, fontWeight: '600' },
  rowSub: { fontSize: 12.5, marginTop: 2, lineHeight: 17 },
  rowAction: { fontSize: 15, fontWeight: '700' },
  hint: { fontSize: 12, lineHeight: 17 },
});
