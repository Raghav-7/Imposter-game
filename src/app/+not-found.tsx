import React from 'react';
import { StyleSheet, View } from 'react-native';

import { AppText } from '../components/AppText';
import { Button } from '../components/Button';
import { Screen } from '../components/Screen';
import { useT } from '../localization';
import { goHome } from '../screens/game/ResultPhases';
import { SPACE } from '../theme';

export default function NotFound() {
  const t = useT();
  return (
    <Screen scroll={false}>
      <View style={styles.root}>
        <AppText style={styles.emoji}>🕵️</AppText>
        <AppText variant="title" align="center">
          {t('common.error.title')}
        </AppText>
        <Button label={t('game.goHome')} icon="home" onPress={goHome} />
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, justifyContent: 'center', gap: SPACE.xl },
  emoji: { fontSize: 64, lineHeight: 76, textAlign: 'center' },
});
