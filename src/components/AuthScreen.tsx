import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  useWindowDimensions,
  Pressable,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Apple, Chrome } from 'lucide-react-native';
import { useTheme, SERIF, RADIUS, ELEVATION } from '../theme';
import { useAuth } from '../auth/authStore';
import { isSupabaseConfigured } from '../services/supabase';
import { AppButton, Field, Segmented, Aurora, BrandMark } from './ui';

const VALUE_PROPS = [
  'Highlight judgments and send excerpts straight to an infinite canvas.',
  'Connect facts, ratios and authorities with visual threads.',
  'Draft research memos and export a court-ready bundle — all on-device.',
];

export default function AuthScreen() {
  const p = useTheme();
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const isTablet = width >= 768;

  const submitting = useAuth((s) => s.submitting);
  const error = useAuth((s) => s.error);
  const login = useAuth((s) => s.login);
  const register = useAuth((s) => s.register);
  const loginWithGoogle = useAuth((s) => s.loginWithGoogle);
  const clearError = useAuth((s) => s.clearError);

  const cloud = isSupabaseConfigured();

  const [mode, setMode] = useState<'signin' | 'signup'>('signin');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [localError, setLocalError] = useState<string | null>(null);

  const shownError = localError || error;

  const switchMode = (m: 'signin' | 'signup') => {
    setMode(m);
    setLocalError(null);
    clearError();
  };

  const onSubmit = async () => {
    setLocalError(null);
    clearError();
    const emailOk = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());
    if (!emailOk) {
      setLocalError('Enter a valid email address.');
      return;
    }
    if (password.length < 6) {
      setLocalError('Password must be at least 6 characters.');
      return;
    }
    if (mode === 'signup') await register(email, password, name);
    else await login(email, password);
  };

  const brandPanel = (
    <View style={[styles.brandPanel, { backgroundColor: p.bg2 }]}>
      <Aurora />
      <View style={styles.brandInner}>
        <View style={styles.brandRow}>
          <BrandMark size={44} />
          <Text style={[styles.brandName, { color: p.text }]}>
            LitNotes<Text style={{ color: p.textMuted }}> Canvas</Text>
          </Text>
        </View>
        <Text style={[styles.brandTag, { color: p.textMid }]}>
          The research desk for court judgments.
        </Text>
        <View style={{ height: 22 }} />
        {VALUE_PROPS.map((v, i) => (
          <View key={i} style={styles.propRow}>
            <View style={[styles.propDot, { backgroundColor: i === 2 ? p.ai : p.accent }]} />
            <Text style={[styles.propText, { color: p.textMid }]}>{v}</Text>
          </View>
        ))}
      </View>
    </View>
  );

  const formCard = (
    <View style={[styles.card, { backgroundColor: p.surface, borderColor: p.border }, ELEVATION.panel]}>
      <Text style={[styles.cardTitle, { color: p.text }]}>
        {mode === 'signin' ? 'Welcome back' : 'Create your account'}
      </Text>
      <Text style={[styles.cardSub, { color: p.textMuted }]}>
        {mode === 'signin'
          ? 'Sign in to open your workspace.'
          : cloud
          ? 'Set up your account to sync and share.'
          : 'Set up a local account to get started.'}
      </Text>

      <View style={{ height: 18 }} />
      <Segmented
        options={[
          { key: 'signin', label: 'Sign in' },
          { key: 'signup', label: 'Sign up' },
        ]}
        value={mode}
        onChange={(k) => switchMode(k as 'signin' | 'signup')}
      />

      <View style={{ height: 18 }} />
      <View style={{ gap: 14 }}>
        {mode === 'signup' && (
          <Field
            label="Full name"
            value={name}
            onChangeText={setName}
            placeholder="Adv. Priya Sharma"
            autoCapitalize="words"
            autoComplete="name"
          />
        )}
        <Field
          label="Email"
          value={email}
          onChangeText={setEmail}
          placeholder="you@chambers.in"
          keyboardType="email-address"
          autoCapitalize="none"
          autoComplete="email"
        />
        <Field
          label="Password"
          value={password}
          onChangeText={setPassword}
          placeholder="At least 6 characters"
          secureTextEntry
          autoCapitalize="none"
        />
      </View>

      {shownError ? (
        <View style={[styles.errorBox, { backgroundColor: p.accentSoft, borderColor: p.danger }]}>
          <Text style={[styles.errorText, { color: p.danger }]}>{shownError}</Text>
        </View>
      ) : null}

      <View style={{ height: 18 }} />
      <AppButton
        label={mode === 'signin' ? 'Sign in' : 'Create account'}
        onPress={onSubmit}
        loading={submitting}
        full
      />

      <View style={styles.dividerRow}>
        <View style={[styles.hr, { backgroundColor: p.border }]} />
        <Text style={[styles.dividerText, { color: p.textMuted }]}>or continue with</Text>
        <View style={[styles.hr, { backgroundColor: p.border }]} />
      </View>

      <View style={styles.ssoRow}>
        <View style={{ flex: 1 }}>
          <AppButton
            label="Apple"
            variant="secondary"
            onPress={() => setLocalError('Social sign-in is not enabled in this build yet.')}
            leading={<Apple size={17} color={p.text} />}
            full
          />
        </View>
        <View style={{ flex: 1 }}>
          <AppButton
            label="Google"
            variant="secondary"
            onPress={() => {
              setLocalError(null);
              clearError();
              if (cloud) loginWithGoogle();
              else setLocalError('Connect Supabase in Settings to enable Google sign-in.');
            }}
            leading={<Chrome size={17} color={p.text} />}
            full
          />
        </View>
      </View>

      <Pressable onPress={() => switchMode(mode === 'signin' ? 'signup' : 'signin')} style={styles.switchRow}>
        <Text style={[styles.switchText, { color: p.textMuted }]}>
          {mode === 'signin' ? 'New to LitNotes Canvas? ' : 'Already have an account? '}
          <Text style={{ color: p.accent, fontWeight: '700' }}>
            {mode === 'signin' ? 'Create one' : 'Sign in'}
          </Text>
        </Text>
      </Pressable>

      <Text style={[styles.privacy, { color: p.textMuted }]}>
        {cloud
          ? 'Secured by Supabase. Your workspace syncs to your account.'
          : 'Accounts and notes are stored only on this device.'}
      </Text>
    </View>
  );

  return (
    <View style={[styles.root, { backgroundColor: p.bg }]}>
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        {isTablet ? (
          <View style={styles.split}>
            <View style={styles.splitLeft}>{brandPanel}</View>
            <View style={[styles.splitRight, { paddingTop: insets.top + 24, paddingBottom: insets.bottom + 24 }]}>
              <ScrollView contentContainerStyle={styles.rightScroll} showsVerticalScrollIndicator={false}>
                <View style={{ width: '100%', maxWidth: 420 }}>{formCard}</View>
              </ScrollView>
            </View>
          </View>
        ) : (
          <ScrollView
            contentContainerStyle={[
              styles.phoneScroll,
              { paddingTop: insets.top + 28, paddingBottom: insets.bottom + 28 },
            ]}
            showsVerticalScrollIndicator={false}>
            <Aurora />
            <View style={styles.phoneBrand}>
              <BrandMark size={40} />
              <Text style={[styles.brandName, { color: p.text }]}>
                LitNotes<Text style={{ color: p.textMuted }}> Canvas</Text>
              </Text>
            </View>
            <View style={{ width: '100%', maxWidth: 440, alignSelf: 'center' }}>{formCard}</View>
          </ScrollView>
        )}
      </KeyboardAvoidingView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  flex: { flex: 1 },
  split: { flex: 1, flexDirection: 'row' },
  splitLeft: { width: '45%' },
  splitRight: { flex: 1, paddingHorizontal: 32 },
  rightScroll: { flexGrow: 1, alignItems: 'center', justifyContent: 'center' },
  phoneScroll: { flexGrow: 1, justifyContent: 'center', paddingHorizontal: 20 },
  phoneBrand: { flexDirection: 'row', alignItems: 'center', gap: 10, justifyContent: 'center', marginBottom: 20 },

  brandPanel: { flex: 1, overflow: 'hidden' },
  brandInner: { flex: 1, padding: 40, justifyContent: 'center' },
  brandRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  brandName: { fontSize: 24, fontWeight: '800', letterSpacing: 0.2 },
  brandTag: { fontSize: 17, marginTop: 16, fontFamily: SERIF, lineHeight: 25 },
  propRow: { flexDirection: 'row', gap: 12, marginBottom: 14, alignItems: 'flex-start' },
  propDot: { width: 8, height: 8, borderRadius: 4, marginTop: 6 },
  propText: { flex: 1, fontSize: 14.5, lineHeight: 21 },

  card: { borderRadius: RADIUS.xl, borderWidth: 1, padding: 28 },
  cardTitle: { fontSize: 23, fontWeight: '800', letterSpacing: 0.1 },
  cardSub: { fontSize: 14, marginTop: 6 },

  errorBox: { marginTop: 16, borderRadius: RADIUS.md, borderWidth: 1, padding: 12 },
  errorText: { fontSize: 13, fontWeight: '600' },

  dividerRow: { flexDirection: 'row', alignItems: 'center', gap: 12, marginVertical: 18 },
  hr: { flex: 1, height: 1 },
  dividerText: { fontSize: 12 },
  ssoRow: { flexDirection: 'row', gap: 12 },

  switchRow: { marginTop: 20, alignItems: 'center' },
  switchText: { fontSize: 13.5 },
  privacy: { fontSize: 11.5, textAlign: 'center', marginTop: 16 },
});
