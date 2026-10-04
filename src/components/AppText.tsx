import React from 'react';
import { StyleSheet, Text, type TextProps, type TextStyle } from 'react-native';

import { FONTS, usePalette } from '../theme';

export type TextVariant = 'hero' | 'display' | 'title' | 'heading' | 'body' | 'bodyStrong' | 'caption' | 'label';
export type TextTone = 'default' | 'muted' | 'faint' | 'primary' | 'danger' | 'success' | 'warning' | 'onPrimary';

interface Props extends TextProps {
  variant?: TextVariant;
  tone?: TextTone;
  align?: TextStyle['textAlign'];
  children?: React.ReactNode;
}

/**
 * Text with the app's type scale. Large display text caps font scaling so it
 * never overflows; body text scales freely with the system setting.
 */
export function AppText({ variant = 'body', tone = 'default', align, style, ...rest }: Props) {
  const p = usePalette();
  const color = {
    default: p.text,
    muted: p.textMuted,
    faint: p.textFaint,
    primary: p.scheme === 'dark' ? '#A894FF' : p.primary,
    danger: p.scheme === 'dark' ? '#FF6B7F' : p.danger,
    success: p.success,
    warning: p.warning,
    onPrimary: p.onPrimary,
  }[tone];
  return (
    <Text
      maxFontSizeMultiplier={MAX_SCALE[variant]}
      {...rest}
      style={[styles[variant], { color }, align ? { textAlign: align } : null, style]}
    />
  );
}

const MAX_SCALE: Record<TextVariant, number> = {
  hero: 1.15,
  display: 1.25,
  title: 1.35,
  heading: 1.5,
  body: 1.8,
  bodyStrong: 1.8,
  caption: 1.8,
  label: 1.6,
};

const styles = StyleSheet.create({
  hero: { fontFamily: FONTS.display, fontSize: 52, lineHeight: 56, letterSpacing: -1 },
  display: { fontFamily: FONTS.display, fontSize: 36, lineHeight: 42, letterSpacing: -0.5 },
  title: { fontFamily: FONTS.display, fontSize: 26, lineHeight: 32, letterSpacing: -0.3 },
  heading: { fontFamily: FONTS.heading, fontSize: 19, lineHeight: 25 },
  body: { fontSize: 16, lineHeight: 23 },
  bodyStrong: { fontSize: 16, lineHeight: 23, fontWeight: '700' },
  caption: { fontSize: 13, lineHeight: 18 },
  label: { fontSize: 12, lineHeight: 16, fontWeight: '800', letterSpacing: 1.2, textTransform: 'uppercase' },
});
