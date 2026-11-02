import React from 'react';
import { Text, View } from 'react-native';
import { ErrorBoundaryProps, useRouter } from 'expo-router';
import { Button, Card, Icon, Screen, T } from './kit';
import { alpha, colors, fonts } from './theme';
import { useStore } from '../state/store';

// Shown instead of a screen that crashed while rendering. The game itself is
// still saved, so the player can retry or go back to the menu.
export function ScreenError({ error, retry }: ErrorBoundaryProps) {
  const router = useRouter();
  return (
    <Screen title="Something broke" back={false}>
      <Card glow={colors.red}>
        <View style={{ width: 52, height: 52, borderRadius: 16, backgroundColor: alpha(colors.red, 0.14), alignItems: 'center', justifyContent: 'center' }}>
          <Icon name="bug-outline" size={26} color={colors.red} />
        </View>
        <Text style={{ fontFamily: fonts.display, fontSize: 24, color: colors.text, letterSpacing: 0.4 }}>This screen hit a problem</Text>
        <T muted>Your game is saved. Try again, or go back to the menu and reopen your save.</T>
        <Text style={{ fontFamily: fonts.body, fontSize: 12, color: colors.muted, backgroundColor: colors.bgElev, borderRadius: 10, padding: 10 }} selectable>
          {error.message}
        </Text>
        <Button label="Try again" icon="refresh" onPress={retry} />
        <Button
          label="Back to menu"
          icon="home"
          variant="secondary"
          onPress={() => {
            // A broken live match would crash again on return.
            useStore.getState().setLive(null);
            router.replace('/');
          }}
        />
      </Card>
    </Screen>
  );
}
