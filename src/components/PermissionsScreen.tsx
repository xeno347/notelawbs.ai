import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, useWindowDimensions, Alert } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Bell, Images, ShieldCheck, Check, Camera, Mic } from 'lucide-react-native';
import { useTheme, RADIUS, ELEVATION, TYPE } from '../theme';
import { useAuth } from '../auth/authStore';
import {
  PERMISSION_ITEMS,
  requestPermission,
  requestAllPermissions,
  requestCapturePermissions,
  openAppPermissionSettings,
  checkPermission,
  type PermissionKey,
  type PermissionState,
} from '../services/permissionsService';
import { AppButton, Aurora } from './ui';

const ICONS: Record<PermissionKey, React.ComponentType<any>> = {
  notifications: Bell,
  media: Images,
  camera: Camera,
  microphone: Mic,
};

export default function PermissionsScreen() {
  const p = useTheme();
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const isTablet = width >= 768;
  const setPermissionsHandled = useAuth((s) => s.setPermissionsHandled);
  const user = useAuth((s) => s.user);

  const [statuses, setStatuses] = useState<Partial<Record<PermissionKey, PermissionState>>>({});
  const [busy, setBusy] = useState<PermissionKey | 'all' | 'capture' | null>(null);

  useEffect(() => {
    let alive = true;
    (async () => {
      const camera = await checkPermission('camera');
      const microphone = await checkPermission('microphone');
      if (!alive) return;
      setStatuses((s) => ({ ...s, camera, microphone }));
    })();
    return () => {
      alive = false;
    };
  }, []);

  const allow = async (key: PermissionKey) => {
    setBusy(key);
    const state = await requestPermission(key);
    setStatuses((s) => ({ ...s, [key]: state === 'blocked' ? 'denied' : state }));
    if (state === 'blocked') {
      Alert.alert(
        'Enable in Settings',
        'This permission was previously denied. Turn it on in Settings → LitNotes Canvas.',
        [
          { text: 'Cancel', style: 'cancel' },
          { text: 'Open Settings', onPress: () => openAppPermissionSettings() },
        ],
      );
    }
    setBusy(null);
  };

  const enableCapture = async () => {
    setBusy('capture');
    const res = await requestCapturePermissions();
    setStatuses((s) => ({
      ...s,
      camera: res.camera === 'blocked' ? 'denied' : res.camera,
      microphone: res.microphone === 'blocked' ? 'denied' : res.microphone,
    }));
    setBusy(null);
  };

  const enableAll = async () => {
    setBusy('all');
    const res = await requestAllPermissions();
    setStatuses(res);
    setBusy(null);
    setPermissionsHandled(true);
  };

  const card = (
    <View style={[styles.card, { backgroundColor: p.surface, borderColor: p.border }, ELEVATION.panel]}>
      <View style={[styles.badge, { backgroundColor: p.tintSoft }]}>
        <ShieldCheck size={26} color={p.tint} />
      </View>
      <Text style={[styles.title, { color: p.text }]}>
        {user?.displayName ? `You're in, ${user.displayName.split(' ')[0]}.` : "You're all set."}
      </Text>
      <Text style={[styles.sub, { color: p.textMid }]}>
        Allow Camera and Microphone so LitNotes can capture documents and voice notes. You can change
        these anytime in Settings.
      </Text>

      <View style={{ height: 16 }} />
      <AppButton
        label="Allow Camera & Microphone"
        onPress={enableCapture}
        loading={busy === 'capture'}
        full
      />

      <View style={{ height: 20 }} />
      <View style={{ gap: 12 }}>
        {PERMISSION_ITEMS.map((item) => {
          const Icon = ICONS[item.key];
          const state = statuses[item.key];
          const granted = state === 'granted';
          const denied = state === 'denied' || state === 'blocked';
          return (
            <View
              key={item.key}
              style={[styles.row, { backgroundColor: p.surface2, borderColor: p.border }]}>
              <View style={[styles.rowIcon, { backgroundColor: p.surface, borderColor: p.border }]}>
                <Icon size={19} color={p.text} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={[styles.rowLabel, { color: p.text }]}>{item.label}</Text>
                <Text style={[styles.rowDesc, { color: p.textMuted }]}>{item.description}</Text>
              </View>
              {granted ? (
                <View style={[styles.granted, { backgroundColor: p.successSoft }]}>
                  <Check size={14} color={p.success} />
                  <Text style={[styles.grantedText, { color: p.success }]}>Allowed</Text>
                </View>
              ) : (
                <AppButton
                  label={denied ? 'Retry' : 'Allow'}
                  variant="secondary"
                  onPress={() => allow(item.key)}
                  loading={busy === item.key}
                />
              )}
            </View>
          );
        })}
      </View>

      <View style={{ height: 22 }} />
      <AppButton label="Enable all & continue" onPress={enableAll} loading={busy === 'all'} full />
      <View style={{ height: 10 }} />
      <AppButton label="Not now" variant="ghost" onPress={() => setPermissionsHandled(true)} full />
    </View>
  );

  return (
    <View
      style={[
        styles.root,
        { backgroundColor: p.bg, paddingTop: insets.top, paddingBottom: insets.bottom },
      ]}>
      <Aurora />
      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        <View style={{ width: '100%', maxWidth: isTablet ? 520 : 440 }}>{card}</View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  scroll: { flexGrow: 1, alignItems: 'center', justifyContent: 'center', padding: 24 },
  card: {
    borderRadius: RADIUS.lg,
    borderWidth: StyleSheet.hairlineWidth,
    padding: 28,
  },
  badge: {
    width: 52,
    height: 52,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  title: { ...TYPE.title2, marginBottom: 8 },
  sub: { ...TYPE.subhead, lineHeight: 22 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 14,
    borderRadius: RADIUS.md,
    borderWidth: StyleSheet.hairlineWidth,
  },
  rowIcon: {
    width: 40,
    height: 40,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: StyleSheet.hairlineWidth,
  },
  rowLabel: { ...TYPE.headline, fontSize: 15 },
  rowDesc: { ...TYPE.caption1, marginTop: 2 },
  granted: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: RADIUS.pill,
  },
  grantedText: { fontSize: 12, fontWeight: '700' },
});
