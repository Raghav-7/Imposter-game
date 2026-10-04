import { Ionicons } from '@expo/vector-icons';
import React from 'react';
import { Platform, Pressable, StyleSheet, Switch, View, type StyleProp, type ViewStyle } from 'react-native';

import { haptic } from '../haptics';
import { RADIUS, SPACE, TOUCH, usePalette } from '../theme';
import { useGuardedCallback } from '../utils/useGuardedCallback';
import { AppText } from './AppText';

// react-native-web uses its own prop for the active thumb colour.
const WEB_SWITCH_PROPS = Platform.OS === 'web' ? ({ activeThumbColor: '#FFFFFF' } as object) : {};

/* --------------------------------- Card --------------------------------- */

export function Card({
  children,
  style,
  tone = 'default',
}: {
  children: React.ReactNode;
  style?: StyleProp<ViewStyle>;
  tone?: 'default' | 'primary' | 'danger' | 'success' | 'warning';
}) {
  const p = usePalette();
  const tint = {
    default: { bg: p.surface, border: p.border },
    primary: { bg: p.primarySoft, border: p.primary + '66' },
    danger: { bg: p.dangerSoft, border: p.danger + '66' },
    success: { bg: p.successSoft, border: p.success + '66' },
    warning: { bg: p.warningSoft, border: p.warning + '66' },
  }[tone];
  return <View style={[styles.card, { backgroundColor: tint.bg, borderColor: tint.border }, style]}>{children}</View>;
}

/* ------------------------------ SectionTitle ----------------------------- */

export function SectionTitle({ children, hint }: { children: string; hint?: string }) {
  return (
    <View style={styles.section}>
      <AppText variant="label" tone="muted" accessibilityRole="header">
        {children}
      </AppText>
      {hint ? (
        <AppText variant="caption" tone="faint">
          {hint}
        </AppText>
      ) : null}
    </View>
  );
}

/* ------------------------------- Segmented ------------------------------- */

export interface SegmentOption<T> {
  value: T;
  label: string;
  accessibilityLabel?: string;
}

export function Segmented<T extends string | number>({
  options,
  value,
  onChange,
  label,
}: {
  options: readonly SegmentOption<T>[];
  value: T;
  onChange: (v: T) => void;
  label: string;
}) {
  const p = usePalette();
  return (
    <View
      style={[styles.segmented, { backgroundColor: p.surfaceHigh, borderColor: p.border }]}
      accessibilityRole="radiogroup"
      accessibilityLabel={label}
    >
      {options.map((o) => {
        const selected = o.value === value;
        return (
          <Pressable
            key={String(o.value)}
            onPress={() => {
              if (!selected) {
                haptic('select');
                onChange(o.value);
              }
            }}
            accessibilityRole="radio"
            accessibilityState={{ selected }}
            accessibilityLabel={o.accessibilityLabel ?? o.label}
            style={[styles.segment, selected && { backgroundColor: p.primary }]}
          >
            <AppText
              variant="bodyStrong"
              numberOfLines={1}
              adjustsFontSizeToFit
              minimumFontScale={0.75}
              style={{ color: selected ? '#FFFFFF' : p.textMuted, fontSize: 14 }}
            >
              {o.label}
            </AppText>
          </Pressable>
        );
      })}
    </View>
  );
}

/* -------------------------------- Stepper -------------------------------- */

export function Stepper({
  value,
  min,
  max,
  onChange,
  label,
  format,
}: {
  value: number;
  min: number;
  max: number;
  onChange: (v: number) => void;
  label: string;
  format?: (v: number) => string;
}) {
  const p = usePalette();
  const dec = useGuardedCallback(() => value > min && (haptic('select'), onChange(value - 1)), 120);
  const inc = useGuardedCallback(() => value < max && (haptic('select'), onChange(value + 1)), 120);
  const btn = (icon: 'remove' | 'add', onPress: () => void, disabled: boolean, a11y: string) => (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityLabel={a11y}
      accessibilityState={{ disabled }}
      style={[styles.stepBtn, { backgroundColor: p.surfaceHigh, opacity: disabled ? 0.35 : 1 }]}
    >
      <Ionicons name={icon} size={22} color={p.text} />
    </Pressable>
  );
  return (
    <View
      style={styles.stepper}
      accessible
      accessibilityRole="adjustable"
      accessibilityLabel={label}
      accessibilityValue={{ min, max, now: value, text: format ? format(value) : String(value) }}
      accessibilityActions={[{ name: 'increment' }, { name: 'decrement' }]}
      onAccessibilityAction={(e) => (e.nativeEvent.actionName === 'increment' ? inc() : dec())}
    >
      {btn('remove', dec, value <= min, `${label} −`)}
      <AppText variant="title" style={styles.stepValue} align="center">
        {format ? format(value) : value}
      </AppText>
      {btn('add', inc, value >= max, `${label} +`)}
    </View>
  );
}

/* ------------------------------- ToggleRow ------------------------------- */

export function ToggleRow({
  label,
  hint,
  value,
  onChange,
  disabled,
  icon,
  testID,
}: {
  label: string;
  hint?: string;
  value: boolean;
  onChange: (v: boolean) => void;
  disabled?: boolean;
  icon?: string;
  testID?: string;
}) {
  const p = usePalette();
  return (
    <Pressable
      onPress={() => !disabled && (haptic('select'), onChange(!value))}
      accessibilityRole="switch"
      accessibilityState={{ checked: value, disabled: !!disabled }}
      accessibilityLabel={hint ? `${label}. ${hint}` : label}
      style={[styles.row, { opacity: disabled ? 0.5 : 1 }]}
      testID={testID}
    >
      {icon ? <AppText style={styles.rowIcon}>{icon}</AppText> : null}
      <View style={styles.rowText}>
        <AppText variant="bodyStrong">{label}</AppText>
        {hint ? (
          <AppText variant="caption" tone="muted">
            {hint}
          </AppText>
        ) : null}
      </View>
      <Switch
        value={value}
        onValueChange={(v) => (haptic('select'), onChange(v))}
        disabled={disabled}
        trackColor={{ true: p.primary, false: p.border }}
        thumbColor="#FFFFFF"
        {...WEB_SWITCH_PROPS}
        importantForAccessibility="no-hide-descendants"
        accessibilityElementsHidden
      />
    </Pressable>
  );
}

/* -------------------------------- ListRow -------------------------------- */

export function ListRow({
  label,
  hint,
  icon,
  onPress,
  right,
  danger,
}: {
  label: string;
  hint?: string;
  icon?: keyof typeof Ionicons.glyphMap;
  onPress?: () => void;
  right?: React.ReactNode;
  danger?: boolean;
}) {
  const p = usePalette();
  const press = useGuardedCallback(onPress);
  return (
    <Pressable
      onPress={onPress ? press : undefined}
      accessibilityRole={onPress ? 'button' : undefined}
      accessibilityLabel={hint ? `${label}. ${hint}` : label}
      style={({ pressed }) => [styles.row, pressed && onPress ? { backgroundColor: p.surfaceHigh } : null]}
    >
      {icon ? <Ionicons name={icon} size={22} color={danger ? p.danger : p.textMuted} style={styles.rowIcon} /> : null}
      <View style={styles.rowText}>
        <AppText variant="bodyStrong" tone={danger ? 'danger' : 'default'}>
          {label}
        </AppText>
        {hint ? (
          <AppText variant="caption" tone="muted">
            {hint}
          </AppText>
        ) : null}
      </View>
      {right ?? (onPress ? <Ionicons name="chevron-forward" size={20} color={p.textFaint} /> : null)}
    </Pressable>
  );
}

/* ---------------------------------- Pill --------------------------------- */

export function Pill({
  label,
  tone = 'default',
}: {
  label: string;
  tone?: 'default' | 'primary' | 'danger' | 'success';
}) {
  const p = usePalette();
  const bg = { default: p.surfaceHigh, primary: p.primarySoft, danger: p.dangerSoft, success: p.successSoft }[tone];
  return (
    <View style={[styles.pill, { backgroundColor: bg }]}>
      <AppText variant="caption" style={{ fontWeight: '700' }} tone={tone === 'default' ? 'muted' : tone}>
        {label}
      </AppText>
    </View>
  );
}

export function Divider() {
  const p = usePalette();
  return <View style={{ height: StyleSheet.hairlineWidth, backgroundColor: p.border, marginVertical: SPACE.xs }} />;
}

const styles = StyleSheet.create({
  card: { borderRadius: RADIUS.lg, borderWidth: 1, padding: SPACE.lg },
  section: { marginTop: SPACE.xl, marginBottom: SPACE.sm, gap: 2 },
  segmented: { flexDirection: 'row', borderRadius: RADIUS.md, padding: 4, borderWidth: 1, gap: 4 },
  segment: {
    flex: 1,
    minHeight: TOUCH - 4,
    borderRadius: RADIUS.sm + 2,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 4,
  },
  stepper: { flexDirection: 'row', alignItems: 'center', gap: SPACE.md },
  stepBtn: { width: TOUCH, height: TOUCH, borderRadius: TOUCH / 2, alignItems: 'center', justifyContent: 'center' },
  stepValue: { minWidth: 40 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    minHeight: TOUCH + 8,
    paddingVertical: SPACE.sm,
    paddingHorizontal: SPACE.sm,
    borderRadius: RADIUS.md,
    gap: SPACE.md,
  },
  rowIcon: { width: 28, textAlign: 'center', fontSize: 20 },
  rowText: { flex: 1, gap: 2 },
  pill: { borderRadius: RADIUS.pill, paddingHorizontal: 12, paddingVertical: 5, alignSelf: 'flex-start' },
});
