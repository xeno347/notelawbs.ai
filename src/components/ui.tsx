import React, { useId, useState } from 'react';
import {
  View,
  Text,
  TextInput,
  Pressable,
  ActivityIndicator,
  StyleSheet,
  Image,
  type TextInputProps,
  type ViewStyle,
  type ImageStyle,
} from 'react-native';
import Svg, { Defs, LinearGradient, Stop, Rect } from 'react-native-svg';
import { useTheme, RADIUS, TYPE, SANS, type Palette } from '../theme';

const LOGO = require('../assets/notelawbs-logo.png');

/** Flat surface — Notion chrome has no blur/glass. Kept for call-site compat. */
export function GlassView({
  children,
  style,
  fallback,
}: {
  children?: React.ReactNode;
  style?: ViewStyle;
  fallback?: string;
}) {
  const p = useTheme();
  return (
    <View style={[{ backgroundColor: fallback || p.surface, overflow: 'hidden' }, style]}>
      {children}
    </View>
  );
}

/** Settings-style grouped section — flat, hairline borders. */
export function GroupedSection({
  title,
  footer,
  children,
  style,
}: {
  title?: string;
  footer?: string;
  children: React.ReactNode;
  style?: ViewStyle;
}) {
  const p = useTheme();
  return (
    <View style={[{ marginBottom: 22 }, style]}>
      {!!title && (
        <Text style={[styles.groupTitle, { color: p.textMid }]}>{title.toUpperCase()}</Text>
      )}
      <View
        style={[
          styles.groupBox,
          { backgroundColor: p.grouped, borderColor: p.border },
        ]}>
        {children}
      </View>
      {!!footer && <Text style={[styles.groupFooter, { color: p.textMid }]}>{footer}</Text>}
    </View>
  );
}

export function GroupedRow({
  children,
  onPress,
  last,
}: {
  children: React.ReactNode;
  onPress?: () => void;
  last?: boolean;
}) {
  const p = useTheme();
  const inner = (
    <View style={[styles.groupRow, !last && { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: p.separator }]}>
      {children}
    </View>
  );
  if (onPress) {
    return (
      <Pressable
        onPress={onPress}
        style={({ pressed }) => [{ backgroundColor: pressed ? p.hover : 'transparent' }]}>
        {inner}
      </Pressable>
    );
  }
  return inner;
}

/* Kept for call sites that still pass gradient fills (now a flat fill of `from`). */
export function SoftGradient({
  from,
  to: _to,
  angle: _angle = 'vertical',
  radius = 0,
  style,
}: {
  from: string;
  to: string;
  angle?: 'vertical' | 'diagonal';
  radius?: number;
  style?: ViewStyle;
}) {
  const gid = `sg-${useId().replace(/:/g, '')}`;
  return (
    <View style={[StyleSheet.absoluteFill, { borderRadius: radius, overflow: 'hidden' }, style]} pointerEvents="none">
      <Svg style={StyleSheet.absoluteFill}>
        <Defs>
          <LinearGradient id={gid} x1="0" y1="0" x2="0" y2="1">
            <Stop offset="0" stopColor={from} />
            <Stop offset="1" stopColor={from} />
          </LinearGradient>
        </Defs>
        <Rect x="0" y="0" width="100%" height="100%" fill={`url(#${gid})`} />
      </Svg>
    </View>
  );
}

/* Primary = solid dark; secondary/ghost = transparent until hover. */
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
  const isPrimary = variant === 'primary';
  const isGhost = variant === 'ghost';
  const bg = isPrimary ? tone || p.text : 'transparent';
  const color = isPrimary ? '#FFFFFF' : isGhost ? p.textMid : p.text;
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
          backgroundColor: isPrimary
            ? bg
            : pressed
              ? p.hover
              : 'transparent',
          borderColor: isPrimary ? 'transparent' : pressed && !isGhost ? p.border : 'transparent',
          borderWidth: StyleSheet.hairlineWidth,
          opacity: blocked ? 0.5 : 1,
        },
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

/* Flat input — focus = accent border, no glow ring. */
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
            borderColor: focused ? p.tint : p.border,
          },
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

/* Flat segmented control. */
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
    <View style={[styles.segTrack, { backgroundColor: p.fillSecondary }, style]}>
      {options.map((o) => {
        const active = o.key === value;
        return (
          <Pressable
            key={o.key}
            onPress={() => onChange(o.key)}
            style={[
              styles.segItem,
              active && { backgroundColor: p.surface, borderWidth: StyleSheet.hairlineWidth, borderColor: p.border },
            ]}>
            <Text
              style={{
                fontSize: 13,
                fontWeight: active ? '600' : '400',
                color: active ? p.text : p.textMid,
                fontFamily: SANS,
              }}>
              {o.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

/** Soft wash — barely-there fill for empty states (no multi-color aurora). */
export function Aurora({ palette }: { palette?: Palette }) {
  const themePalette = useTheme();
  const p = palette ?? themePalette;
  return (
    <View style={[StyleSheet.absoluteFill, { backgroundColor: p.bg2 }]} pointerEvents="none" />
  );
}

/** NoteLawbs.Ai logo mark from brand asset. */
export function BrandMark({
  size = 40,
  color: _color,
  style,
}: {
  size?: number;
  color?: string;
  style?: ImageStyle;
}) {
  return (
    <Image
      source={LOGO}
      style={[{ width: size, height: size }, style]}
      resizeMode="contain"
      accessibilityLabel="NoteLawbs.Ai"
    />
  );
}

const styles = StyleSheet.create({
  groupTitle: { ...TYPE.caption2, fontWeight: '500', marginBottom: 7, marginLeft: 12, letterSpacing: 0.4 },
  groupBox: {
    borderRadius: RADIUS.lg,
    overflow: 'hidden',
    borderWidth: StyleSheet.hairlineWidth,
  },
  groupFooter: { ...TYPE.caption2, marginTop: 7, marginHorizontal: 12, lineHeight: 16 },
  groupRow: { minHeight: 44, paddingHorizontal: 14, paddingVertical: 10, flexDirection: 'row', alignItems: 'center' },
  btn: {
    minHeight: 36,
    paddingHorizontal: 14,
    borderRadius: RADIUS.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  btnInner: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  btnText: { fontSize: 14, fontWeight: '500', fontFamily: SANS },
  fieldLabel: { fontSize: 12, fontWeight: '500', fontFamily: SANS },
  fieldWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    minHeight: 36,
    borderRadius: RADIUS.md,
    borderWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: 12,
  },
  fieldInput: { flex: 1, fontSize: 16, paddingVertical: 8, fontFamily: SANS },
  segTrack: {
    flexDirection: 'row',
    padding: 2,
    borderRadius: RADIUS.md,
    gap: 2,
  },
  segItem: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 6,
    borderRadius: RADIUS.sm,
  },
});
