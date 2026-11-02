import React, { useState } from 'react';
import { ActivityIndicator, Text, TextInput, View } from 'react-native';
import { Redirect, useRouter } from 'expo-router';
import { useAuth } from '../../state/auth';
import { useStore } from '../../state/store';
import { Button, Card, Choice, H2, Icon, Row, Screen, T, inputStyle } from '../../ui/kit';
import { alpha, colors, fonts } from '../../ui/theme';
import { Avatar } from '../../ui/avatar';
import { CloudSavesCard } from '../../ui/cloudSaves';

const DEFAULT_LOOK = { skin: 2, hair: 1, hairColor: 0, boots: 0 };

export default function Account() {
  const router = useRouter();
  const status = useAuth((s) => s.status);
  const session = useAuth((s) => s.session);
  const profile = useAuth((s) => s.profile);
  const { updateProfile, signOut, deleteAccount } = useAuth.getState();
  const showToast = useStore((s) => s.showToast);
  const [name, setName] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [confirm, setConfirm] = useState('');
  const [deleting, setDeleting] = useState(false);

  if (status === 'off') return <Redirect href="/account/sign-in" />;
  if (status === 'guest') return <Redirect href="/account/sign-in" />;
  if (status === 'loading' || !session) {
    return (
      <Screen title="Account">
        <ActivityIndicator color={colors.accent} />
      </Screen>
    );
  }

  const username = name ?? profile?.username ?? '';
  const changed = profile && name !== null && name.trim().toLowerCase() !== profile.username;

  return (
    <Screen title="Account">
      <Card>
        <Row gap={14}>
          <Avatar look={profile?.look ?? DEFAULT_LOOK} kit={['#5b8cff', '#ffffff']} size={58} />
          <View style={{ flex: 1 }}>
            <Text style={{ fontFamily: fonts.display, fontSize: 26, color: colors.text, letterSpacing: 0.3 }} numberOfLines={1}>
              {profile ? `@${profile.username}` : 'Loading...'}
            </Text>
            <Text style={{ fontFamily: fonts.body, fontSize: 12.5, color: colors.muted }} numberOfLines={1}>
              {session.user.email}
            </Text>
          </View>
        </Row>
      </Card>

      <CloudSavesCard />

      <Card>
        <H2>Profile</H2>
        <T muted style={{ fontSize: 13 }}>
          Your username shows on leaderboards and your public profile. 3 to 20 characters: lowercase letters, numbers and _.
        </T>
        <TextInput keyboardAppearance="dark" selectionColor={colors.accent} style={inputStyle} value={username} onChangeText={(t) => setName(t.toLowerCase().replace(/[^a-z0-9_]/g, ''))} maxLength={20} autoCapitalize="none" placeholder="username" placeholderTextColor={colors.muted} />
        {error && <Text style={{ fontFamily: fonts.medium, fontSize: 13, color: colors.red }}>{error}</Text>}
        {changed && (
          <Button
            label="Save username"
            small
            disabled={busy || username.length < 3}
            onPress={async () => {
              setBusy(true);
              const r = await updateProfile({ username });
              setBusy(false);
              setError(r.error);
              if (!r.error) {
                setName(null);
                showToast('Username saved.');
              }
            }}
          />
        )}
        {profile && (
          <Choice
            active={profile.is_public}
            label="Public profile"
            sub={profile.is_public ? 'Your careers appear on leaderboards and anyone with the link can see your profile.' : 'Hidden from leaderboards and your profile link shows nothing.'}
            onPress={async () => {
              const r = await updateProfile({ is_public: !profile.is_public });
              if (r.error) showToast(r.error);
            }}
          />
        )}
        {profile?.is_public && <Button label="View my public profile" icon="person-circle-outline" small variant="secondary" onPress={() => router.push(`/u/${profile.username}`)} />}
      </Card>

      <Button
        label="Sign out"
        icon="log-out-outline"
        variant="secondary"
        onPress={async () => {
          await signOut();
          showToast('Signed out. Your saves on this device stay here.');
          router.replace('/');
        }}
      />

      <Card>
        <Row gap={8}>
          <Icon name="warning-outline" size={18} color={colors.red} />
          <H2>Delete account</H2>
        </Row>
        {!deleting ? (
          <>
            <T muted style={{ fontSize: 13 }}>
              Deletes your account, cloud saves, profile and leaderboard entries for good. Saves on this device stay.
            </T>
            <Button label="Delete my account" small variant="secondary" onPress={() => setDeleting(true)} />
          </>
        ) : (
          <>
            <T muted style={{ fontSize: 13 }}>
              Type DELETE to confirm. This cannot be undone.
            </T>
            <TextInput style={[inputStyle, { borderColor: alpha(colors.red, 0.5) }]} value={confirm} onChangeText={setConfirm} autoCapitalize="characters" placeholder="DELETE" placeholderTextColor={colors.muted} keyboardAppearance="dark" />
            <Row>
              <Button label="Cancel" small variant="secondary" style={{ flex: 1 }} onPress={() => setDeleting(false)} />
              <Button
                label="Delete forever"
                small
                variant="danger"
                style={{ flex: 1 }}
                disabled={confirm !== 'DELETE' || busy}
                onPress={async () => {
                  setBusy(true);
                  const r = await deleteAccount();
                  setBusy(false);
                  showToast(r.error ?? r.notice ?? 'Account deleted.');
                  if (!r.error) router.replace('/');
                }}
              />
            </Row>
          </>
        )}
      </Card>

      <Row gap={18} style={{ justifyContent: 'center' }}>
        <Text style={{ fontFamily: fonts.medium, fontSize: 12, color: colors.muted, paddingVertical: 8 }} onPress={() => router.push('/legal/privacy')}>
          Privacy
        </Text>
        <Text style={{ fontFamily: fonts.medium, fontSize: 12, color: colors.muted, paddingVertical: 8 }} onPress={() => router.push('/legal/terms')}>
          Terms
        </Text>
      </Row>
    </Screen>
  );
}
