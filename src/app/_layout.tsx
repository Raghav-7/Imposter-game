import { useFonts } from 'expo-font';
import { NavigationBar } from 'expo-navigation-bar';
import { Stack, type ErrorBoundaryProps } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import * as SystemUI from 'expo-system-ui';
import React, { useEffect, useState } from 'react';
import { AppState, StyleSheet, View } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { setAppActive } from '../audio/sound';
import { AppText } from '../components/AppText';
import { Button } from '../components/Button';
import { dismissOverlays, OverlayHost, toast } from '../components/Overlay';
import { translate, resolveLanguage } from '../localization';
import { configStore, customCategoriesStore, recentWordsStore, rosterStore } from '../state/appData';
import { dispatch } from '../state/gameStore';
import { settingsStore } from '../state/settings';
import { statsStore } from '../state/stats';
import { onStorageFailure } from '../storage/storage';
import { DARK, FONTS, usePalette } from '../theme';
import { logger } from '../utils/logger';

SplashScreen.preventAutoHideAsync().catch(() => undefined);
SplashScreen.setOptions?.({ duration: 250, fade: true });

const hydrateAll = () =>
  Promise.all(
    [settingsStore, rosterStore, configStore, customCategoriesStore, statsStore, recentWordsStore].map((s) =>
      s.hydrate().catch(() => undefined),
    ),
  );

export default function RootLayout() {
  const [ready, setReady] = useState(false);
  const [fontsLoaded, fontError] = useFonts({
    [FONTS.display]: require('../../assets/fonts/Bricolage-ExtraBold.ttf'),
    [FONTS.heading]: require('../../assets/fonts/Bricolage-SemiBold.ttf'),
  });

  useEffect(() => {
    let alive = true;
    hydrateAll().finally(() => alive && setReady(true));
    return () => {
      alive = false;
    };
  }, []);

  // App lifecycle: hide any visible secret and pause audio the moment we leave the foreground.
  useEffect(() => {
    const sub = AppState.addEventListener('change', (next) => {
      const active = next === 'active';
      setAppActive(active);
      if (!active) {
        dispatch({ type: 'APP_BACKGROUNDED' });
        dismissOverlays();
      }
    });
    return () => sub.remove();
  }, []);

  useEffect(
    () =>
      onStorageFailure((op) => {
        if (op === 'write') {
          const lang = resolveLanguage(settingsStore.get().language);
          toast(translate(lang, 'common.error.storage'));
        }
      }),
    [],
  );

  const appReady = ready && (fontsLoaded || !!fontError);
  useEffect(() => {
    if (appReady) SplashScreen.hideAsync().catch(() => undefined);
  }, [appReady]);

  if (!appReady) return <View style={{ flex: 1, backgroundColor: DARK.bg }} />;
  return (
    <SafeAreaProvider>
      <ThemedStack />
      <OverlayHost />
    </SafeAreaProvider>
  );
}

function ThemedStack() {
  const p = usePalette();
  useEffect(() => {
    SystemUI.setBackgroundColorAsync(p.bg).catch(() => undefined);
  }, [p.bg]);
  return (
    <>
      <StatusBar style={p.scheme === 'dark' ? 'light' : 'dark'} />
      <NavigationBar style={p.scheme === 'dark' ? 'light' : 'dark'} />
      <Stack
        screenOptions={{
          headerShown: false,
          contentStyle: { backgroundColor: p.bg },
          animation: 'slide_from_right',
        }}
      >
        <Stack.Screen name="index" options={{ animation: 'fade' }} />
        <Stack.Screen name="onboarding" options={{ animation: 'fade', gestureEnabled: false }} />
        <Stack.Screen name="game" options={{ animation: 'fade', gestureEnabled: false }} />
      </Stack>
    </>
  );
}

/** Friendly crash screen instead of a white screen. Never shows game details. */
export function ErrorBoundary({ error, retry }: ErrorBoundaryProps) {
  useEffect(() => {
    logger.error('render error', { message: error?.message?.slice(0, 120) });
  }, [error]);
  const lang = resolveLanguage(settingsStore.get().language);
  return (
    <View style={[styles.error, { backgroundColor: DARK.bg }]}>
      <AppText variant="display" style={{ color: DARK.text }} align="center">
        🙈
      </AppText>
      <AppText variant="title" style={{ color: DARK.text }} align="center">
        {translate(lang, 'common.error.title')}
      </AppText>
      <AppText variant="body" style={{ color: DARK.textMuted }} align="center">
        {translate(lang, 'common.error.generic')}
      </AppText>
      <Button label={translate(lang, 'common.continue')} onPress={retry} style={{ alignSelf: 'stretch' }} />
    </View>
  );
}

const styles = StyleSheet.create({
  error: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 32, gap: 16 },
});
