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
  Lock,
  Camera,
  Mic,
} from 'lucide-react-native';
import { useTheme, useThemeStore, useThemeMode, RADIUS, type ThemeMode } from '../theme';
import { useStore } from '../store';
import { useAuth } from '../auth/authStore';
import { useSessionLock } from '../auth/sessionLockStore';
import { saveKey, clearKey } from '../research/service';
import { getGroqKey, saveGroqKey, clearGroqKey } from '../services/aiClient';
import {
  getCloudOcrKey,
  saveCloudOcrKey,
  clearCloudOcrKey,
} from '../services/cloudOcrService';
import { getSetting } from '../storage';
import {
  getSupabaseOverrides,
  saveSupabaseOverrides,
  isSupabaseConfigured,
  getGoogleClientOverrides,
  saveGoogleClientOverrides,
  googleClientIds,
} from '../services/supabase';
import {
  PERMISSION_ITEMS,
  requestPermission,
  requestCapturePermissions,
  openAppPermissionSettings,
  checkPermission,
  type PermissionKey,
  type PermissionState,
} from '../services/permissionsService';
import { AppButton, Field, Segmented } from './ui';

const PERM_ICONS: Record<PermissionKey, React.ComponentType<any>> = {
  notifications: Bell,
  media: Images,
  camera: Camera,
  microphone: Mic,
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
  const lockEnabled = useSessionLock((s) => s.enabled);
  const setLockEnabled = useSessionLock((s) => s.setEnabled);
  const resetWorkspace = useStore((s) => s.resetWorkspace);
  const docName = useStore((s) => s.docName);
  const highlights = useStore((s) => s.highlights);
  const nodes = useStore((s) => s.nodes);
  const autoOcr = useStore((s) => s.autoOcr);
  const setAutoOcr = useStore((s) => s.setAutoOcr);
  const preferCloudOcr = useStore((s) => s.preferCloudOcr);
  const setPreferCloudOcr = useStore((s) => s.setPreferCloudOcr);

  const [apiKey, setApiKey] = useState('');
  const [groqKey, setGroqKey] = useState('');
  const [cloudOcrKey, setCloudOcrKey] = useState('');
  const [keyLoaded, setKeyLoaded] = useState(false);
  const [keySaved, setKeySaved] = useState(false);
  const [groqSaved, setGroqSaved] = useState(false);
  const [cloudOcrSaved, setCloudOcrSaved] = useState(false);
  const [permStatus, setPermStatus] = useState<Partial<Record<PermissionKey, PermissionState>>>({});
  const [sbUrl, setSbUrl] = useState('');
  const [sbKey, setSbKey] = useState('');
  const [sbSaved, setSbSaved] = useState(false);
  const [googleWeb, setGoogleWeb] = useState('');
  const [googleIos, setGoogleIos] = useState('');
  const [googleSaved, setGoogleSaved] = useState(false);
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [sbConfigured, setSbConfigured] = useState(isSupabaseConfigured());

  useEffect(() => {
    getGroqKey().then((k) => {
      if (k) setGroqKey(k);
    });
    getCloudOcrKey().then((k) => {
      if (k) setCloudOcrKey(k);
    });
    getSetting('anthropic_key').then((k) => {
      if (k) setApiKey(k);
      setKeyLoaded(true);
    });
    (async () => {
      const entries = await Promise.all(
        PERMISSION_ITEMS.map(async (it) => [it.key, await checkPermission(it.key)] as const),
      );
      setPermStatus((s) => {
        const next = { ...s };
        for (const [key, state] of entries) next[key] = state;
        return next;
      });
    })();
    const ov = getSupabaseOverrides();
    setSbUrl(ov.url);
    setSbKey(ov.anonKey);
    const gOv = getGoogleClientOverrides();
    const ids = googleClientIds();
    setGoogleWeb(gOv.web || ids.web);
    setGoogleIos(gOv.ios || ids.ios);
  }, []);

  const onSaveSupabase = async () => {
    await saveSupabaseOverrides(sbUrl, sbKey);
    setSbConfigured(isSupabaseConfigured());
    setSbSaved(true);
    setTimeout(() => setSbSaved(false), 1800);
  };

  const onSaveGoogle = async () => {
    await saveGoogleClientOverrides(googleWeb, googleIos);
    setGoogleSaved(true);
    setTimeout(() => setGoogleSaved(false), 1800);
  };

  const onSaveGroqKey = async () => {
    if (groqKey.trim()) await saveGroqKey(groqKey);
    else await clearGroqKey();
    setGroqSaved(true);
    setTimeout(() => setGroqSaved(false), 1800);
  };

  const onSaveCloudOcrKey = async () => {
    if (cloudOcrKey.trim()) {
      await saveCloudOcrKey(cloudOcrKey);
      setPreferCloudOcr(true);
    } else {
      await clearCloudOcrKey();
    }
    setCloudOcrSaved(true);
    setTimeout(() => setCloudOcrSaved(false), 1800);
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
    setPermStatus((s) => ({ ...s, [key]: state === 'blocked' ? 'denied' : state }));
    if (state === 'blocked') {
      Alert.alert(
        'Enable in Settings',
        'This permission was previously denied. Turn it on for LitNotes Canvas in system Settings.',
        [
          { text: 'Cancel', style: 'cancel' },
          { text: 'Open Settings', onPress: () => openAppPermissionSettings() },
        ],
      );
    }
  };

  const allowCameraAndMic = async () => {
    const res = await requestCapturePermissions();
    setPermStatus((s) => ({
      ...s,
      camera: res.camera === 'blocked' ? 'denied' : res.camera,
      microphone: res.microphone === 'blocked' ? 'denied' : res.microphone,
    }));
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
              <Text style={[styles.rowLabel, { color: p.text, marginTop: 8 }]}>Annotation colour legend</Text>
              <Text style={[styles.hint, { color: p.textMuted }]}>
                Key fact · Favourable · Adverse · To verify · Procedure — pick a category when you
                highlight. Default mark style follows Text / Under / Strike on the toolbar.
              </Text>
              <Text style={[styles.hint, { color: p.textMuted }]}>
                Shortcuts: Text / Box select → Highlight to canvas · Pen draws with Finger on · Fit
                frames all canvas cards · Index tap jumps to page.
              </Text>
            </View>
          </Section>

          <Section title="Reading">
            <View style={styles.row}>
              <View style={{ flex: 1 }}>
                <Text style={[styles.rowLabel, { color: p.text }]}>Auto text recognition</Text>
                <Text style={[styles.rowSub, { color: p.textMuted }]}>
                  When on, newly opened documents are scanned automatically (or import an existing
                  text layer if the PDF is already searchable). Turn off here or with Disable auto
                  OCR in the reader — nothing is pushed to the canvas.
                </Text>
              </View>
              <Switch
                value={autoOcr}
                onValueChange={setAutoOcr}
                trackColor={{ true: p.tint, false: p.separator }}
                thumbColor="#fff"
              />
            </View>
            <RowDivider />
            <View style={styles.row}>
              <View style={{ flex: 1 }}>
                <Text style={[styles.rowLabel, { color: p.text }]}>Cloud OCR for full documents</Text>
                <Text style={[styles.rowSub, { color: p.textMuted }]}>
                  When enabled, newly opened documents are OCR’d via OCR.space (up to three pages at
                  once). Falls back to on-device recognition if a cloud request fails or no key is set.
                </Text>
              </View>
              <Switch
                value={preferCloudOcr}
                onValueChange={setPreferCloudOcr}
                trackColor={{ true: p.ai, false: p.separator }}
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
            <View style={styles.row}>
              <Lock size={18} color={p.textMid} />
              <View style={{ flex: 1 }}>
                <Text style={[styles.rowLabel, { color: p.text }]}>Lock when backgrounded</Text>
                <Text style={[styles.rowSub, { color: p.textMuted }]}>
                  Cover the workspace when you leave the app so notes stay private in the app switcher.
                </Text>
              </View>
              <Switch
                value={lockEnabled}
                onValueChange={setLockEnabled}
                trackColor={{ true: p.tint, false: p.separator }}
                thumbColor="#fff"
              />
            </View>
            <RowDivider />
            <Pressable style={styles.row} onPress={onLogout}>
              <LogOut size={18} color={p.danger} />
              <Text style={[styles.rowAction, { color: p.danger }]}>Sign out</Text>
            </Pressable>
          </Section>

          <Section title="Research">
            <View style={styles.row}>
              <View style={{ flex: 1 }}>
                <Text style={[styles.rowLabel, { color: p.text }]}>AI research</Text>
                <Text style={[styles.rowSub, { color: p.textMuted }]}>
                  {groqKey || apiKey
                    ? 'Live answers enabled on this device.'
                    : 'Turn on Advanced below to add an API key for live legal answers.'}
                </Text>
              </View>
              <Text style={{ color: groqKey || apiKey ? p.success : p.textMuted, fontWeight: '600', fontSize: 13 }}>
                {groqKey || apiKey ? 'On' : 'Offline'}
              </Text>
            </View>
          </Section>

          <Section title="Sharing">
            <View style={styles.row}>
              <View style={{ flex: 1 }}>
                <Text style={[styles.rowLabel, { color: p.text }]}>Live collaboration</Text>
                <Text style={[styles.rowSub, { color: p.textMuted }]}>
                  {sbConfigured
                    ? 'Cloud sharing is connected for invite links.'
                    : 'Optional. Configure under Advanced if you need to share a live workspace.'}
                </Text>
              </View>
              <Text style={{ color: sbConfigured ? p.success : p.textMuted, fontWeight: '600', fontSize: 13 }}>
                {sbConfigured ? 'Connected' : 'Off'}
              </Text>
            </View>
          </Section>

          <Pressable
            onPress={() => setShowAdvanced((v) => !v)}
            style={{ paddingHorizontal: 4, paddingVertical: 8, marginBottom: 8 }}>
            <Text style={{ color: p.tint, fontSize: 15, fontWeight: '600' }}>
              {showAdvanced ? 'Hide Advanced' : 'Advanced…'}
            </Text>
          </Pressable>

          {showAdvanced && (
            <>
              <Section title="Cloud OCR">
                <View style={{ padding: 16, gap: 10 }}>
                  <Field
                    label="OCR.space API key"
                    value={cloudOcrKey}
                    onChangeText={setCloudOcrKey}
                    placeholder="K8…"
                    secureTextEntry
                    autoCapitalize="none"
                  />
                  <Text style={[styles.hint, { color: p.textMuted }]}>
                    Get a key at ocr.space/ocrapi. Page images leave this device while scanning;
                    extracted text and word positions are saved back into your workspace.
                  </Text>
                  <View style={{ flexDirection: 'row', gap: 10, alignItems: 'center' }}>
                    <AppButton
                      label={cloudOcrSaved ? 'Saved' : 'Save cloud OCR key'}
                      variant="secondary"
                      onPress={onSaveCloudOcrKey}
                    />
                    {cloudOcrKey ? (
                      <AppButton
                        label="Clear"
                        variant="ghost"
                        onPress={async () => {
                          setCloudOcrKey('');
                          await clearCloudOcrKey();
                        }}
                      />
                    ) : null}
                  </View>
                </View>
              </Section>

              <Section title="AI keys">
                <View style={{ padding: 16, gap: 10 }}>
                  <Field
                    label="Groq API key (preferred)"
                    value={groqKey}
                    onChangeText={setGroqKey}
                    placeholder="gsk_…"
                    secureTextEntry
                    autoCapitalize="none"
                    editable={keyLoaded}
                  />
                  <View style={{ flexDirection: 'row', gap: 10, alignItems: 'center' }}>
                    <AppButton label={groqSaved ? 'Saved' : 'Save Groq key'} variant="secondary" onPress={onSaveGroqKey} />
                    {groqKey ? (
                      <AppButton label="Clear" variant="ghost" onPress={() => { setGroqKey(''); clearGroqKey(); }} />
                    ) : null}
                  </View>
                  <Field
                    label="Anthropic API key (fallback)"
                    value={apiKey}
                    onChangeText={setApiKey}
                    placeholder={keyLoaded ? 'sk-ant-…' : 'Loading…'}
                    secureTextEntry
                    autoCapitalize="none"
                    editable={keyLoaded}
                  />
                  <View style={{ flexDirection: 'row', gap: 10, alignItems: 'center' }}>
                    <AppButton label={keySaved ? 'Saved' : 'Save Anthropic key'} variant="secondary" onPress={onSaveKey} />
                    {apiKey ? (
                      <AppButton label="Clear" variant="ghost" onPress={() => { setApiKey(''); clearKey(); }} />
                    ) : null}
                  </View>
                </View>
              </Section>

              <Section title="Backend">
                <View style={{ padding: 16, gap: 10 }}>
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
                  <Text style={{ color: p.textMuted, fontSize: 12, lineHeight: 17 }}>
                    Required for Google / Apple sign-in and live sharing. After saving, return to the
                    sign-in screen (sign out if needed).
                  </Text>
                </View>
              </Section>

              <Section title="Google sign-in">
                <View style={{ padding: 16, gap: 10 }}>
                  <Field
                    label="Web Client ID"
                    value={googleWeb}
                    onChangeText={setGoogleWeb}
                    placeholder="….apps.googleusercontent.com"
                    autoCapitalize="none"
                  />
                  <Field
                    label="iOS Client ID"
                    value={googleIos}
                    onChangeText={setGoogleIos}
                    placeholder="….apps.googleusercontent.com"
                    autoCapitalize="none"
                  />
                  <AppButton
                    label={googleSaved ? 'Saved' : 'Save Google IDs'}
                    variant="secondary"
                    onPress={onSaveGoogle}
                  />
                  <Text style={{ color: p.textMuted, fontSize: 12, lineHeight: 17 }}>
                    Use the Web client ID from Google Cloud (same one enabled in Supabase → Auth →
                    Google). iOS client must match the URL scheme in the app.
                  </Text>
                </View>
              </Section>
            </>
          )}

          <Section title="Permissions">
            <View style={{ paddingHorizontal: 16, paddingTop: 12, paddingBottom: 4 }}>
              <AppButton label="Allow Camera & Microphone" onPress={allowCameraAndMic} full />
            </View>
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
