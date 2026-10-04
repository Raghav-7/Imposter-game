import { useMemo } from 'react';
import { useColorScheme } from 'react-native';

import { useSettings } from '../state/settings';

export interface Palette {
  scheme: 'dark' | 'light';
  bg: string;
  bgGradient: [string, string, string];
  surface: string;
  surfaceHigh: string;
  border: string;
  text: string;
  textMuted: string;
  textFaint: string;
  primary: string;
  primarySoft: string;
  onPrimary: string;
  danger: string;
  dangerSoft: string;
  success: string;
  successSoft: string;
  warning: string;
  warningSoft: string;
  info: string;
  overlay: string;
  secretBg: [string, string];
  imposterBg: [string, string];
}

/**
 * "Midnight masquerade": near-black ink with a violet signature, hot coral for
 * danger/imposter, mint for success. Text colours meet WCAG AA on their surfaces.
 */
export const DARK: Palette = {
  scheme: 'dark',
  bg: '#0C0A14',
  bgGradient: ['#17112B', '#0C0A14', '#0C0A14'],
  surface: '#171324',
  surfaceHigh: '#221D33',
  border: '#2E2742',
  text: '#F6F3FF',
  textMuted: '#B4ADCB',
  textFaint: '#7F7899',
  primary: '#7350F5',
  primarySoft: '#7350F526',
  onPrimary: '#FFFFFF',
  danger: '#E8384F',
  dangerSoft: '#E8384F24',
  success: '#22C38E',
  successSoft: '#22C38E22',
  warning: '#FFC247',
  warningSoft: '#FFC24722',
  info: '#4FB3FF',
  overlay: '#06050BE6',
  secretBg: ['#2A1F57', '#140F2B'],
  imposterBg: ['#5A1426', '#1E0910'],
};

export const LIGHT: Palette = {
  scheme: 'light',
  bg: '#F5F2FC',
  bgGradient: ['#E9E2FF', '#F5F2FC', '#F5F2FC'],
  surface: '#FFFFFF',
  surfaceHigh: '#ECE7F8',
  border: '#D9D1EC',
  text: '#16111F',
  textMuted: '#544D68',
  textFaint: '#7A7390',
  primary: '#6440EC',
  primarySoft: '#6440EC1F',
  onPrimary: '#FFFFFF',
  danger: '#D42443',
  dangerSoft: '#D424431A',
  success: '#0E8A61',
  successSoft: '#0E8A611A',
  warning: '#9A6A00',
  warningSoft: '#C9900022',
  info: '#1E6FB8',
  overlay: '#16111FCC',
  secretBg: ['#E4DBFF', '#F6F2FF'],
  imposterBg: ['#FFD9E0', '#FFF1F3'],
};

export const FONTS = {
  display: 'Bricolage-ExtraBold',
  heading: 'Bricolage-SemiBold',
} as const;

export const SPACE = { xs: 4, sm: 8, md: 12, lg: 16, xl: 24, xxl: 32 } as const;
export const RADIUS = { sm: 10, md: 16, lg: 22, xl: 30, pill: 999 } as const;
/** Minimum touch target (Android guideline is 48dp). */
export const TOUCH = 48;

export function useResolvedScheme(): 'dark' | 'light' {
  const { theme } = useSettings();
  const system = useColorScheme();
  if (theme === 'system') return system === 'light' ? 'light' : 'dark';
  return theme;
}

export function usePalette(): Palette {
  const scheme = useResolvedScheme();
  return useMemo(() => (scheme === 'light' ? LIGHT : DARK), [scheme]);
}
