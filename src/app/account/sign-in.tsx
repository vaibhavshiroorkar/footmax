import React, { useState } from 'react';
import { ActivityIndicator, Text, TextInput, View } from 'react-native';
import { Redirect, useRouter } from 'expo-router';
import { useAuth, MIN_PASSWORD } from '../../state/auth';
import { Button, Card, Icon, Row, Screen, T, Tabs, inputStyle } from '../../ui/kit';
import { alpha, colors, fonts } from '../../ui/theme';

type Mode = 'in' | 'up';

export default function SignIn() {
  const router = useRouter();
  const status = useAuth((s) => s.status);
  const { signIn, signUp, signInWithGoogle, sendReset } = useAuth.getState();
  const [mode, setMode] = useState<Mode>('in');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  if (status === 'signed-in') return <Redirect href="/account" />;

  const run = async (fn: () => Promise<{ error: string | null; notice?: string }>) => {
    setBusy(true);
    setError(null);
    setNotice(null);
    const r = await fn();
    setBusy(false);
    setError(r.error);
    if (r.notice) setNotice(r.notice);
  };

  if (status === 'off') {
    return (
      <Screen title="Account">
        <Card>
          <T>Accounts are not available on this version of the game. You can still play as a guest; saves stay on this device, and you can export them as files.</T>
          <Button label="Back to the menu" icon="home" variant="secondary" onPress={() => router.replace('/')} />
        </Card>
      </Screen>
    );
  }

  const valid = /\S+@\S+\.\S+/.test(email.trim()) && password.length >= (mode === 'up' ? MIN_PASSWORD : 1);

  return (
    <Screen title={mode === 'in' ? 'Sign in' : 'Create account'}>
      <Card>
        <Row gap={10}>
          <View style={{ width: 40, height: 40, borderRadius: 12, backgroundColor: alpha(colors.accent, 0.14), alignItems: 'center', justifyContent: 'center' }}>
            <Icon name="cloud-upload-outline" size={20} color={colors.accent} />
          </View>
          <T muted style={{ flex: 1, fontSize: 13 }}>
            An account keeps your saves in the cloud, so you can carry on from any device. It also puts your careers on the leaderboards.
          </T>
        </Row>
      </Card>
      <Tabs<Mode>
        tabs={[
          { key: 'in', label: 'Sign in' },
          { key: 'up', label: 'Create account' },
        ]}
        value={mode}
        onChange={(m) => {
          setMode(m);
          setError(null);
          setNotice(null);
        }}
      />
      <Card>
        <TextInput
          style={inputStyle}
          value={email}
          onChangeText={setEmail}
          placeholder="Email"
          placeholderTextColor={colors.muted}
          keyboardType="email-address"
          autoCapitalize="none"
          autoComplete="email"
          textContentType="emailAddress"
          keyboardAppearance="dark"
        />
        <TextInput
          style={inputStyle}
          value={password}
          onChangeText={setPassword}
          placeholder={mode === 'up' ? `Password (at least ${MIN_PASSWORD} characters)` : 'Password'}
          placeholderTextColor={colors.muted}
          secureTextEntry
          autoCapitalize="none"
          autoComplete={mode === 'up' ? 'new-password' : 'current-password'}
          textContentType={mode === 'up' ? 'newPassword' : 'password'}
          keyboardAppearance="dark"
          onSubmitEditing={() => valid && run(() => (mode === 'in' ? signIn(email, password) : signUp(email, password)))}
        />
        {error && <Text style={{ fontFamily: fonts.medium, fontSize: 13, color: colors.red }}>{error}</Text>}
        {notice && <Text style={{ fontFamily: fonts.medium, fontSize: 13, color: colors.accent }}>{notice}</Text>}
        {busy ? (
          <ActivityIndicator color={colors.accent} style={{ paddingVertical: 12 }} />
        ) : (
          <Button label={mode === 'in' ? 'Sign in' : 'Create account'} icon={mode === 'in' ? 'log-in-outline' : 'person-add-outline'} disabled={!valid} onPress={() => run(() => (mode === 'in' ? signIn(email, password) : signUp(email, password)))} />
        )}
        {mode === 'in' && (
          <Text style={{ fontFamily: fonts.medium, fontSize: 13, color: colors.muted, textAlign: 'center', paddingVertical: 8 }} onPress={() => run(() => sendReset(email))}>
            Forgot your password? Send a reset link
          </Text>
        )}
      </Card>
      <Row gap={10}>
        <View style={{ flex: 1, height: 1, backgroundColor: colors.border }} />
        <Text style={{ fontFamily: fonts.medium, fontSize: 12, color: colors.muted }}>or</Text>
        <View style={{ flex: 1, height: 1, backgroundColor: colors.border }} />
      </Row>
      <Button label="Continue with Google" icon="logo-google" variant="secondary" disabled={busy} onPress={() => run(signInWithGoogle)} />
      <Button label="Play as guest" variant="ghost" onPress={() => (router.canGoBack() ? router.back() : router.replace('/'))} />
      <Text style={{ fontFamily: fonts.body, fontSize: 12, color: colors.muted, textAlign: 'center', lineHeight: 18 }}>
        By creating an account you agree to the{' '}
        <Text style={{ color: colors.text }} onPress={() => router.push('/legal/terms')}>
          Terms
        </Text>{' '}
        and{' '}
        <Text style={{ color: colors.text }} onPress={() => router.push('/legal/privacy')}>
          Privacy policy
        </Text>
        .
      </Text>
    </Screen>
  );
}
