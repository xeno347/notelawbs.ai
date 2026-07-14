import React, { useId, useState } from 'react';
import {
  View,
  Text,
  TextInput,
  Pressable,
  ActivityIndicator,
  StyleSheet,
  Platform,
  type TextInputProps,
  type ViewStyle,
} from 'react-native';
import { BlurView } from '@react-native-community/blur';
import Svg, { Defs, RadialGradient, LinearGradient, Stop, Rect, Circle } from 'react-native-svg';
import { useTheme, useScheme, RADIUS, TYPE, SANS, glow, ELEVATION, type Palette } from '../theme';

/** Liquid Glass material — iOS chromeMaterial light/dark. */
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
  const scheme = useScheme();
  const blurType = scheme === 'dark' ? 'chromeMaterialDark' : 'chromeMaterialLight';
  return (
    <View style={[styles.glassWrap, style]}>
      <BlurView
        style={StyleSheet.absoluteFill}
        blurType={blurType as any}
        blurAmount={Platform.OS === 'ios' ? 28 : 18}
        reducedTransparencyFallbackColor={fallback || p.surfaceGlass}
      />
      <View style={[StyleSheet.absoluteFill, { backgroundColor: p.glassTint }]} pointerEvents="none" />
      {children}
    </View>
  );
}

/** iOS Settings-style grouped inset section. */
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
          { backgroundColor: p.grouped },
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
      <Pressable onPress={onPress} style={({ pressed }) => [{ opacity: pressed ? 0.72 : 1 }]}>
        {inner}
      </Pressable>
    );
  }
  return inner;
}

/* Vertical (or angled) linear gradient fill for premium surfaces. */
export function SoftGradient({
  from,
  to,
  angle = 'vertical',
  radius = 0,
  style,
}: {
  from: string;
  to: string;
  angle?: 'vertical' | 'diagonal';
  radius?: number;
  style?: ViewStyle;
}) {
  const x2 = angle === 'diagonal' ? '1' : '0';
  // Unique id per instance — duplicate gradient ids spam RN SVG console errors.
  const gid = `sg-${useId().replace(/:/g, '')}`;
  return (
    <View style={[StyleSheet.absoluteFill, { borderRadius: radius, overflow: 'hidden' }, style]} pointerEvents="none">
      <Svg style={StyleSheet.absoluteFill}>
        <Defs>
          <LinearGradient id={gid} x1="0" y1="0" x2={x2} y2="1">
            <Stop offset="0" stopColor={from} />
            <Stop offset="1" stopColor={to} />
          </LinearGradient>
        </Defs>
        <Rect x="0" y="0" width="100%" height="100%" fill={`url(#${gid})`} />
      </Svg>
    </View>
  );
}

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
  const accent = tone || p.tint;
  const isPrimary = variant === 'primary';
  const isGhost = variant === 'ghost';
  const bg = isPrimary ? accent : isGhost ? 'transparent' : p.fill;
  const border = isPrimary ? accent : isGhost ? 'transparent' : 'transparent';
  const color = isPrimary ? '#fff' : isGhost ? p.tint : p.text;
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
        isPrimary && glow(tone ? tone : p.tintSoft, 0.45),
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
            backgroundColor: p.grouped,
            borderColor: focused ? p.tint : p.separator,
          },
          focused && glow(p.tintSoft, 0.35),
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
    <View style={[styles.segTrack, { backgroundColor: p.fillSecondary }, style]}>
      {options.map((o) => {
        const active = o.key === value;
        return (
          <Pressable
            key={o.key}
            onPress={() => onChange(o.key)}
            style={[
              styles.segItem,
              active && { backgroundColor: p.grouped, ...ELEVATION.card },
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

/* Soft multi-color aurora glow behind splash / auth / empty states. */
export function Aurora({ palette }: { palette?: Palette }) {
  const themePalette = useTheme();
  const p = palette ?? themePalette;
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
  glassWrap: { overflow: 'hidden' },
  groupTitle: { ...TYPE.caption2, fontWeight: '400', marginBottom: 7, marginLeft: 16, letterSpacing: -0.08 },
  groupBox: { borderRadius: RADIUS.sm, overflow: 'hidden', ...ELEVATION.card },
  groupFooter: { ...TYPE.caption2, marginTop: 7, marginHorizontal: 16, lineHeight: 16 },
  groupRow: { minHeight: 44, paddingHorizontal: 16, paddingVertical: 11, flexDirection: 'row', alignItems: 'center' },
  btn: {
    minHeight: 50,
    paddingHorizontal: 20,
    borderRadius: RADIUS.md,
    borderWidth: 0,
    alignItems: 'center',
    justifyContent: 'center',
  },
  btnInner: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  btnText: { fontSize: 17, fontWeight: '600', fontFamily: SANS },
  fieldLabel: { fontSize: 13, fontWeight: '400', fontFamily: SANS },
  fieldWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    minHeight: 44,
    borderRadius: RADIUS.sm,
    borderWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: 16,
  },
  fieldInput: { flex: 1, fontSize: 17, paddingVertical: 10, fontFamily: SANS },
  segTrack: {
    flexDirection: 'row',
    padding: 2,
    borderRadius: RADIUS.sm,
    gap: 2,
  },
  segItem: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 7,
    borderRadius: 8,
  },
});
