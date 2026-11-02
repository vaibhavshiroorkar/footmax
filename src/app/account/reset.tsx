import React, { useState } from 'react';
import { ActivityIndicator, Text, TextInput } from 'react-native';
import { useRouter } from 'expo-router';
import { MIN_PASSWORD, useAuth } from '../../state/auth';
import { Button, Card, H2, Screen, T, inputStyle } from '../../ui/kit';
import { colors, fonts } from '../../ui/theme';

// Opened from the password-reset email. The link signs the player in for
// this one purpose; they choose a new password here.
export default function ResetPassword() {
  const router = useRouter();
  const status = useAuth((s) => s.status);
  const recovering = useAuth((s) => s.recovering);
  const setPassword = useAuth((s) => s.setPassword);
  const [a, setA] = useState('');
  const [b, setB] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (status === 'loading') {
    return (
      <Screen title="New password">
        <ActivityIndicator color={colors.accent} />
      </Screen>
    );
  }

  if (status !== 'signed-in' && !recovering) {
    return (
      <Screen title="New password">
        <Card>
          <H2>Link expired</H2>
          <T muted>This reset link has expired or was already used. Ask for a new one from the sign-in screen.</T>
          <Button label="Go to sign in" icon="log-in-outline" onPress={() => router.replace('/account/sign-in')} />
        </Card>
      </Screen>
    );
  }

  const ok = a.length >= MIN_PASSWORD && a === b;

  return (
    <Screen title="New password">
      <Card>
        <T muted>Choose a new password of at least {MIN_PASSWORD} characters.</T>
        <TextInput style={inputStyle} value={a} onChangeText={setA} placeholder="New password" placeholderTextColor={colors.muted} secureTextEntry autoComplete="new-password" textContentType="newPassword" keyboardAppearance="dark" />
        <TextInput style={inputStyle} value={b} onChangeText={setB} placeholder="Type it again" placeholderTextColor={colors.muted} secureTextEntry autoComplete="new-password" textContentType="newPassword" keyboardAppearance="dark" />
        {b.length > 0 && a !== b && <Text style={{ fontFamily: fonts.medium, fontSize: 13, color: colors.red }}>The two passwords do not match.</Text>}
        {error && <Text style={{ fontFamily: fonts.medium, fontSize: 13, color: colors.red }}>{error}</Text>}
        {busy ? (
          <ActivityIndicator color={colors.accent} />
        ) : (
          <Button
            label="Save new password"
            icon="key-outline"
            disabled={!ok}
            onPress={async () => {
              setBusy(true);
              const r = await setPassword(a);
              setBusy(false);
              if (r.error) return setError(r.error);
              router.replace('/account');
            }}
          />
        )}
      </Card>
    </Screen>
  );
}
