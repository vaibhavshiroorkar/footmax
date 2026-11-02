import React from 'react';
import { Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { Button, Card, Icon, Screen, T } from '../ui/kit';
import { alpha, colors, fonts } from '../ui/theme';

export default function NotFound() {
  const router = useRouter();
  return (
    <Screen title="Not found" back={false}>
      <Card>
        <View style={{ width: 52, height: 52, borderRadius: 16, backgroundColor: alpha(colors.blue, 0.14), alignItems: 'center', justifyContent: 'center' }}>
          <Icon name="help-buoy-outline" size={26} color={colors.blue} />
        </View>
        <Text style={{ fontFamily: fonts.display, fontSize: 24, color: colors.text, letterSpacing: 0.4 }}>Off the pitch</Text>
        <T muted>There is nothing at this address. It may be an old link.</T>
        <Button label="Go to the menu" icon="home" onPress={() => router.replace('/')} />
      </Card>
    </Screen>
  );
}
