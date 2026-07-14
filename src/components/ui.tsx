import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  Pressable,
  ActivityIndicator,
  StyleSheet,
  type TextInputProps,
  type ViewStyle,
} from 'react-native';
import Svg, { Defs, RadialGradient, Stop, Rect, Circle } from 'react-native-svg';
import { useTheme, RADIUS, glow, type Palette } from '../theme';

/* Primary / secondary / ghost action button with press feedback. */
export function AppButton({
  label,
  onPress,
  variant = 'primary',
  loading,
  disabled,
  full,
  leading,
  tone,
}: {
  label: string;
  onPress: () => void;
  variant?: 'primary' | 'secondary' | 'ghost';
  loading?: boolean;
  disabled?: boolean;
  full?: boolean;
  leading?: React.ReactNode;
  tone?: string;
}) {
  const p = useTheme();
  const accent = tone || p.accent;
  const isPrimary = variant === 'primary';
  const isGhost = variant === 'ghost';
  const bg = isPrimary ? accent : isGhost ? 'transparent' : p.surface;
  const border = isPrimary ? accent : isGhost ? 'transparent' : p.border;
  const color = isPrimary ? '#fff' : isGhost ? p.textMid : p.text;
  const blocked = disabled || loading;

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      onPress={blocked ? undefined : onPress}
      style={({ pressed }) => [
        styles.btn,
        full && { alignSelf: 'stretch' },
        {
          backgroundColor: bg,
          borderColor: border,
          opacity: blocked ? 0.55 : 1,
          transform: [{ scale: pressed && !blocked ? 0.98 : 1 }],
        },
        isPrimary && glow(tone ? tone : p.accentGlow, 0.5),
      ]}>
      {loading ? (
        <ActivityIndicator color={color} size="small" />
      ) : (
        <View style={styles.btnInner}>
          {leading}
          <Text style={[styles.btnText, { color }]}>{label}</Text>
        </View>
      )}
    </Pressable>
  );
}

/* Labeled text field with focus glow. */
export function Field({
  label,
  value,
  onChangeText,
  placeholder,
  secureTextEntry,
  keyboardType,
  autoCapitalize,
  autoComplete,
  editable = true,
  trailing,
}: {
  label?: string;
  value: string;
  onChangeText: (t: string) => void;
  placeholder?: string;
  secureTextEntry?: boolean;
  keyboardType?: TextInputProps['keyboardType'];
  autoCapitalize?: TextInputProps['autoCapitalize'];
  autoComplete?: TextInputProps['autoComplete'];
  editable?: boolean;
  trailing?: React.ReactNode;
}) {
  const p = useTheme();
  const [focused, setFocused] = useState(false);
  return (
    <View style={{ gap: 6 }}>
      {label ? <Text style={[styles.fieldLabel, { color: p.textMid }]}>{label}</Text> : null}
      <View
        style={[
          styles.fieldWrap,
          {
            backgroundColor: p.surface,
            borderColor: focused ? p.accent : p.border,
          },
          focused && glow(p.accentGlow, 0.35),
        ]}>
        <TextInput
          value={value}
          onChangeText={onChangeText}
          placeholder={placeholder}
          placeholderTextColor={p.textMuted}
          secureTextEntry={secureTextEntry}
          keyboardType={keyboardType}
          autoCapitalize={autoCapitalize}
          autoComplete={autoComplete}
          editable={editable}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          style={[styles.fieldInput, { color: p.text }]}
        />
        {trailing}
      </View>
    </View>
  );
}

/* Pill-track segmented control. */
export function Segmented<T extends string>({
  options,
  value,
  onChange,
  style,
}: {
  options: { key: T; label: string }[];
  value: T;
  onChange: (key: T) => void;
  style?: ViewStyle;
}) {
  const p = useTheme();
  return (
    <View style={[styles.segTrack, { backgroundColor: p.surface2, borderColor: p.border }, style]}>
      {options.map((o) => {
        const active = o.key === value;
        return (
          <Pressable
            key={o.key}
            onPress={() => onChange(o.key)}
            style={[
              styles.segItem,
              active && { backgroundColor: p.surface, borderColor: p.border },
              active && glow(p.accentGlow, 0.18),
            ]}>
            <Text
              style={{
                fontSize: 13,
                fontWeight: active ? '700' : '500',
                color: active ? p.accent : p.textMuted,
              }}>
              {o.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

/* Soft multi-color aurora glow behind splash / auth / empty states. */
export function Aurora({ palette }: { palette?: Palette }) {
  const p = palette || useTheme();
  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="none">
      <Svg style={StyleSheet.absoluteFill}>
        <Defs>
          <RadialGradient id="a1" cx="20%" cy="18%" r="55%">
            <Stop offset="0" stopColor={p.accent} stopOpacity={0.16} />
            <Stop offset="1" stopColor={p.accent} stopOpacity={0} />
          </RadialGradient>
          <RadialGradient id="a2" cx="85%" cy="30%" r="55%">
            <Stop offset="0" stopColor={p.ai} stopOpacity={0.14} />
            <Stop offset="1" stopColor={p.ai} stopOpacity={0} />
          </RadialGradient>
          <RadialGradient id="a3" cx="60%" cy="95%" r="60%">
            <Stop offset="0" stopColor={p.iris} stopOpacity={0.12} />
            <Stop offset="1" stopColor={p.iris} stopOpacity={0} />
          </RadialGradient>
        </Defs>
        <Rect x="0" y="0" width="100%" height="100%" fill="url(#a1)" />
        <Rect x="0" y="0" width="100%" height="100%" fill="url(#a2)" />
        <Rect x="0" y="0" width="100%" height="100%" fill="url(#a3)" />
      </Svg>
    </View>
  );
}

/* Small brand mark — a stacked "spine" + dot, echoing the canvas identity. */
export function BrandMark({ size = 40, color }: { size?: number; color?: string }) {
  const p = useTheme();
  const c = color || p.accent;
  return (
    <Svg width={size} height={size} viewBox="0 0 40 40">
      <Circle cx="20" cy="20" r="18" fill="none" stroke={c} strokeWidth={1.4} opacity={0.35} />
      <Rect x="15" y="9" width="4" height="22" rx="2" fill={c} />
      <Rect x="22" y="14" width="4" height="17" rx="2" fill={p.ai} />
      <Circle cx="17" cy="31" r="2.4" fill={c} />
    </Svg>
  );
}

const styles = StyleSheet.create({
  btn: {
    minHeight: 50,
    paddingHorizontal: 20,
    borderRadius: RADIUS.md,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  btnInner: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  btnText: { fontSize: 15, fontWeight: '700' },
  fieldLabel: { fontSize: 12.5, fontWeight: '600' },
  fieldWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    minHeight: 48,
    borderRadius: RADIUS.md,
    borderWidth: 1,
    paddingHorizontal: 14,
  },
  fieldInput: { flex: 1, fontSize: 15, paddingVertical: 12 },
  segTrack: {
    flexDirection: 'row',
    padding: 3,
    borderRadius: RADIUS.pill,
    borderWidth: 1,
    gap: 3,
  },
  segItem: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 8,
    borderRadius: RADIUS.pill,
    borderWidth: 1,
    borderColor: 'transparent',
  },
});
