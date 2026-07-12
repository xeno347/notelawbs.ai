import React, { useState } from 'react';
import { ActivityIndicator, KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { ShieldCheck, Sparkles, ArrowRight } from 'lucide-react-native';
import { useSettings } from '../settings/useSettings';
import { colors } from '../../theme/colors';
import { useAuth } from './useAuth';

export default function LoginScreen() {
  const { settings } = useSettings();
  const { signIn, error, status } = useAuth();
  const [email, setEmail] = useState('admin@notelawbs.ai');
  const [password, setPassword] = useState('ChangeMe123!');
  const theme = settings.themeMode === 'dark' ? colors.dark : colors.light;
  const [localError, setLocalError] = useState<string | null>(null);

  const handleLogin = async () => {
    setLocalError(null);
    try {
      await signIn(settings.backendUrl, email.trim(), password);
    } catch (loginError: any) {
      setLocalError(loginError?.message || 'Login failed.');
    }
  };

  return (
    <KeyboardAvoidingView style={[styles.container, { backgroundColor: theme.background }]} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <View style={[styles.shellGlow, { backgroundColor: theme.accent, opacity: settings.themeMode === 'dark' ? 0.14 : 0.1 }]} />
        <View style={[styles.card, { backgroundColor: theme.surface, borderColor: theme.border }]}>
          <View style={[styles.brandPill, { backgroundColor: theme.background, borderColor: theme.border }]}>
            <ShieldCheck size={16} color={theme.accent} />
            <Text style={[styles.brandText, { color: theme.textPrimary }]}>Secure workspace</Text>
          </View>
          <Text style={[styles.kicker, { color: theme.accent }]}>Notelawbs.ai</Text>
          <Text style={[styles.title, { color: theme.textPrimary }]}>Sign in to your case workspace</Text>
          <Text style={[styles.subtitle, { color: theme.textSecondary }]}>
            Access the backend-connected document library, workspace, and review pipeline from one clean interface.
          </Text>

          <View style={styles.fieldBlock}>
            <Text style={[styles.label, { color: theme.textSecondary }]}>Email</Text>
            <TextInput
              value={email}
              onChangeText={setEmail}
              placeholder="name@company.com"
              autoCapitalize="none"
              keyboardType="email-address"
              style={[styles.input, { borderColor: theme.border, color: theme.textPrimary, backgroundColor: theme.background }]}
              placeholderTextColor={theme.textSecondary}
            />
          </View>

          <View style={styles.fieldBlock}>
            <Text style={[styles.label, { color: theme.textSecondary }]}>Password</Text>
            <TextInput
              value={password}
              onChangeText={setPassword}
              placeholder="Password"
              secureTextEntry
              style={[styles.input, { borderColor: theme.border, color: theme.textPrimary, backgroundColor: theme.background }]}
              placeholderTextColor={theme.textSecondary}
            />
          </View>

          {(localError || error) && (
            <View style={styles.errorBox}>
              <Text style={styles.errorText}>{localError || error}</Text>
            </View>
          )}

          <TouchableOpacity onPress={handleLogin} disabled={status === 'loading'} style={[styles.button, { backgroundColor: theme.accent, opacity: status === 'loading' ? 0.72 : 1 }]}>
            <View style={styles.buttonRow}>
              {status === 'loading' ? <ActivityIndicator color="#fff" /> : <Sparkles size={18} color="#fff" />}
              <Text style={styles.buttonText}>Sign In</Text>
              <ArrowRight size={18} color="#fff" />
            </View>
          </TouchableOpacity>

          <View style={[styles.note, { borderTopColor: theme.border }]}>
            <Text style={[styles.noteTitle, { color: theme.textPrimary }]}>Demo access</Text>
            <Text style={[styles.noteBody, { color: theme.textSecondary }]}>
              admin@notelawbs.ai
              {'\n'}
              ChangeMe123!
            </Text>
          </View>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  content: {
    flexGrow: 1,
    justifyContent: 'center',
    padding: 24,
  },
  shellGlow: {
    position: 'absolute',
    top: '14%',
    alignSelf: 'center',
    width: 360,
    height: 360,
    borderRadius: 180,
  },
  card: {
    borderWidth: 1,
    borderRadius: 30,
    padding: 24,
    gap: 16,
    maxWidth: 560,
    width: '100%',
    alignSelf: 'center',
    shadowColor: '#000',
    shadowOpacity: 0.08,
    shadowRadius: 24,
    shadowOffset: { width: 0, height: 16 },
    elevation: 8,
  },
  brandPill: {
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    borderWidth: 1,
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  brandText: {
    fontSize: 13,
    fontWeight: '700',
  },
  kicker: {
    fontSize: 14,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 1.5,
  },
  title: {
    fontSize: 34,
    fontWeight: '800',
    lineHeight: 38,
    letterSpacing: -0.8,
  },
  subtitle: {
    fontSize: 15,
    lineHeight: 22,
  },
  fieldBlock: {
    gap: 8,
  },
  label: {
    fontSize: 13,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  input: {
    borderWidth: 1,
    borderRadius: 16,
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: 16,
  },
  errorBox: {
    backgroundColor: '#B4231814',
    borderRadius: 14,
    padding: 12,
  },
  errorText: {
    color: '#B42318',
    fontWeight: '600',
  },
  button: {
    minHeight: 52,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  buttonRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  buttonText: {
    color: '#fff',
    fontWeight: '800',
    fontSize: 16,
  },
  note: {
    borderTopWidth: 1,
    paddingTop: 16,
    gap: 6,
  },
  noteTitle: {
    fontSize: 14,
    fontWeight: '700',
  },
  noteBody: {
    fontSize: 14,
    lineHeight: 20,
  },
});
