import React, { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, useWindowDimensions } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Bell, Images, ShieldCheck, Check } from 'lucide-react-native';
import { useTheme, RADIUS, ELEVATION } from '../theme';
import { useAuth } from '../auth/authStore';
import {
  PERMISSION_ITEMS,
  requestPermission,
  requestAllPermissions,
  type PermissionKey,
  type PermissionState,
} from '../services/permissionsService';
import { AppButton, Aurora } from './ui';

const ICONS: Record<PermissionKey, React.ComponentType<any>> = {
  notifications: Bell,
  media: Images,
};

export default function PermissionsScreen() {
  const p = useTheme();
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const isTablet = width >= 768;
  const setPermissionsHandled = useAuth((s) => s.setPermissionsHandled);
  const user = useAuth((s) => s.user);

  const [statuses, setStatuses] = useState<Partial<Record<PermissionKey, PermissionState>>>({});
  const [busy, setBusy] = useState<PermissionKey | 'all' | null>(null);

  const allow = async (key: PermissionKey) => {
    setBusy(key);
    const state = await requestPermission(key);
    setStatuses((s) => ({ ...s, [key]: state }));
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
      <View style={[styles.badge, { backgroundColor: p.accentSoft }]}>
        <ShieldCheck size={26} color={p.accent} />
      </View>
      <Text style={[styles.title, { color: p.text }]}>
        {user?.displayName ? `You're in, ${user.displayName.split(' ')[0]}.` : "You're all set."}
      </Text>
      <Text style={[styles.sub, { color: p.textMid }]}>
        Grant a couple of permissions so everything works smoothly. You can change these later in
        Settings.
      </Text>

      <View style={{ height: 20 }} />
      <View style={{ gap: 12 }}>
        {PERMISSION_ITEMS.map((item) => {
          const Icon = ICONS[item.key];
          const state = statuses[item.key];
          const granted = state === 'granted';
          const denied = state === 'denied';
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
  card: { borderRadius: RADIUS.xl, borderWidth: 1, padding: 28, width: '100%' },
  badge: {
    width: 52,
    height: 52,
    borderRadius: RADIUS.lg,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  title: { fontSize: 22, fontWeight: '800', letterSpacing: 0.1 },
  sub: { fontSize: 14, marginTop: 8, lineHeight: 20 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 14,
    borderRadius: RADIUS.lg,
    borderWidth: 1,
  },
  rowIcon: {
    width: 40,
    height: 40,
    borderRadius: RADIUS.md,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  rowLabel: { fontSize: 15, fontWeight: '700' },
  rowDesc: { fontSize: 12.5, marginTop: 2, lineHeight: 17 },
  granted: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: RADIUS.pill,
  },
  grantedText: { fontSize: 12.5, fontWeight: '700' },
});
