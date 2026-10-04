import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import React from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  View,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useT } from '../localization';
import { SPACE, TOUCH, usePalette } from '../theme';
import { useGuardedCallback } from '../utils/useGuardedCallback';
import { AppText } from './AppText';

interface ScreenProps {
  children: React.ReactNode;
  title?: string;
  onBack?: () => void;
  /** Icon for the header's leading button (default: back arrow). */
  backIcon?: keyof typeof Ionicons.glyphMap;
  backLabel?: string;
  right?: React.ReactNode;
  scroll?: boolean;
  /** Pinned at the bottom, above the safe area (primary actions). */
  footer?: React.ReactNode;
  contentStyle?: StyleProp<ViewStyle>;
  /** Override the background gradient (e.g. red for imposter reveals). */
  gradient?: readonly [string, string, ...string[]];
  testID?: string;
}

export const MAX_CONTENT_WIDTH = 560;

export function Screen({
  children,
  title,
  onBack,
  backIcon = 'arrow-back',
  backLabel,
  right,
  scroll = true,
  footer,
  contentStyle,
  gradient,
  testID,
}: ScreenProps) {
  const p = usePalette();
  const t = useT();
  const insets = useSafeAreaInsets();
  const back = useGuardedCallback(onBack);
  const hasHeader = !!(title || onBack || right);

  // Without an outer ScrollView the content must stay within the viewport so inner lists can scroll.
  const body = <View style={[styles.content, !scroll && styles.contentFixed, contentStyle]}>{children}</View>;

  return (
    <View style={[styles.root, { backgroundColor: p.bg }]} testID={testID}>
      <LinearGradient colors={gradient ?? p.bgGradient} style={StyleSheet.absoluteFill} />
      <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <View style={[styles.flex, { paddingTop: insets.top }]}>
          {hasHeader ? (
            <View style={styles.header}>
              {onBack ? (
                <Pressable
                  onPress={back}
                  hitSlop={8}
                  accessibilityRole="button"
                  accessibilityLabel={backLabel ?? t('common.back')}
                  style={({ pressed }) => [
                    styles.iconBtn,
                    { backgroundColor: pressed ? p.surfaceHigh : 'transparent' },
                  ]}
                >
                  <Ionicons name={backIcon} size={24} color={p.text} />
                </Pressable>
              ) : (
                <View style={styles.iconSpacer} />
              )}
              <AppText
                variant="heading"
                numberOfLines={1}
                style={styles.headerTitle}
                align="center"
                accessibilityRole="header"
              >
                {title ?? ''}
              </AppText>
              <View style={styles.right}>{right ?? <View style={styles.iconSpacer} />}</View>
            </View>
          ) : null}
          {scroll ? (
            <ScrollView
              style={styles.flex}
              contentContainerStyle={[
                styles.scrollContent,
                { paddingBottom: footer ? SPACE.lg : insets.bottom + SPACE.xl },
              ]}
              keyboardShouldPersistTaps="handled"
              showsVerticalScrollIndicator={false}
            >
              {body}
            </ScrollView>
          ) : (
            <View style={[styles.flex, { paddingBottom: footer ? 0 : insets.bottom + SPACE.md }]}>{body}</View>
          )}
          {footer ? (
            <View style={[styles.footer, { paddingBottom: insets.bottom + SPACE.md }]}>
              <View style={styles.footerInner}>{footer}</View>
            </View>
          ) : null}
        </View>
      </KeyboardAvoidingView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  flex: { flex: 1 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: SPACE.sm,
    minHeight: 56,
  },
  headerTitle: { flex: 1, marginHorizontal: SPACE.sm },
  iconBtn: { width: TOUCH, height: TOUCH, borderRadius: TOUCH / 2, alignItems: 'center', justifyContent: 'center' },
  iconSpacer: { width: TOUCH, height: TOUCH },
  right: { minWidth: TOUCH, alignItems: 'flex-end' },
  scrollContent: { flexGrow: 1 },
  content: {
    flexGrow: 1,
    width: '100%',
    maxWidth: MAX_CONTENT_WIDTH,
    alignSelf: 'center',
    paddingHorizontal: SPACE.lg + 2,
  },
  contentFixed: { flex: 1, minHeight: 0 },
  footer: { paddingHorizontal: SPACE.lg + 2, paddingTop: SPACE.md },
  footerInner: { width: '100%', maxWidth: MAX_CONTENT_WIDTH, alignSelf: 'center', gap: SPACE.sm },
});
