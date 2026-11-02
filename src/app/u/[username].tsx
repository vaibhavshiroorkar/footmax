import React, { useEffect, useState } from 'react';
import { ActivityIndicator, Text, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useAuth } from '../../state/auth';
import { useStore } from '../../state/store';
import { BoardRow, PublicProfile, fetchProfile, shareProfile } from '../../state/social';
import { Button, Card, H2, Icon, Pill, Row, Screen, StatTile, T } from '../../ui/kit';
import { Avatar } from '../../ui/avatar';
import { colors, fonts } from '../../ui/theme';

const DEFAULT_LOOK = { skin: 2, hair: 1, hairColor: 0, boots: 0 };

function SaveCard({ r }: { r: BoardRow }) {
  const career = r.mode === 'career';
  return (
    <Card>
      <Row gap={12}>
        {career ? <Avatar look={r.look ?? DEFAULT_LOOK} kit={['#5b8cff', '#ffffff']} size={46} /> : <Icon name="clipboard" size={30} color={colors.blue} />}
        <View style={{ flex: 1 }}>
          <Text style={{ fontFamily: fonts.display, fontSize: 21, color: colors.text, letterSpacing: 0.3 }} numberOfLines={1}>
            {r.name}
          </Text>
          <Text style={{ fontFamily: fonts.body, fontSize: 12.5, color: colors.muted }} numberOfLines={1}>
            {career ? 'Player career' : 'Manager'}
            {r.club ? `  |  ${r.club}` : ''}
            {`  |  ${r.seasons} season${r.seasons === 1 ? '' : 's'}`}
          </Text>
        </View>
        {r.retired && <Pill label="Retired" color={colors.muted} />}
      </Row>
      <Row gap={8} style={{ flexWrap: 'wrap' }}>
        {career && r.peak_ovr !== null && <StatTile label="Peak rating" value={String(r.peak_ovr)} icon="trending-up" color={colors.accent} />}
        {career && <StatTile label="Goals" value={String(r.goals)} icon="football" color={colors.blue} />}
        {career && <StatTile label="Games" value={String(r.apps)} icon="shirt" color={colors.purple} />}
        <StatTile label="Trophies" value={String(r.trophies)} icon="trophy" color={colors.gold} />
        {career && r.ballon_dors > 0 && <StatTile label="Ballon d'Or" value={String(r.ballon_dors)} icon="medal" color={colors.gold} />}
        {!career && <StatTile label="League titles" value={String(r.league_titles)} icon="podium" color={colors.accent} />}
      </Row>
    </Card>
  );
}

export default function PublicProfilePage() {
  const { username } = useLocalSearchParams<{ username: string }>();
  const router = useRouter();
  const me = useAuth((s) => s.profile?.username);
  const showToast = useStore((s) => s.showToast);
  const [state, setState] = useState<{ profile: PublicProfile | null; rows: BoardRow[]; error: string | null } | null>(null);

  useEffect(() => {
    let live = true;
    if (username) fetchProfile(username).then((r) => live && setState(r));
    return () => {
      live = false;
    };
  }, [username]);

  if (!state) {
    return (
      <Screen title="Profile">
        <ActivityIndicator color={colors.accent} style={{ paddingVertical: 40 }} />
      </Screen>
    );
  }

  if (!state.profile) {
    return (
      <Screen title="Profile">
        <Card>
          <H2>No profile here</H2>
          <T muted>{state.error ?? `There is no public profile called @${username}. It may be private or the name may have changed.`}</T>
          <Button label="See the leaderboards" icon="trophy-outline" variant="secondary" onPress={() => router.replace('/leaderboards')} />
        </Card>
      </Screen>
    );
  }

  const p = state.profile;
  const since = new Date(p.created_at).toLocaleDateString(undefined, { month: 'long', year: 'numeric' });
  return (
    <Screen title={`@${p.username}`}>
      <Card glow={colors.accent}>
        <Row gap={14}>
          <Avatar look={p.look ?? state.rows.find((r) => r.look)?.look ?? DEFAULT_LOOK} kit={['#5b8cff', '#ffffff']} size={64} />
          <View style={{ flex: 1 }}>
            <Text style={{ fontFamily: fonts.display, fontSize: 30, color: colors.text, letterSpacing: 0.3 }} numberOfLines={1}>
              @{p.username}
            </Text>
            <Text style={{ fontFamily: fonts.body, fontSize: 12.5, color: colors.muted }}>Playing since {since}</Text>
          </View>
        </Row>
        <Button
          label={p.username === me ? 'Share my profile' : 'Share profile'}
          icon="share-social-outline"
          small
          variant="secondary"
          onPress={async () => {
            const msg = await shareProfile(p.username);
            if (msg) showToast(msg);
          }}
        />
      </Card>
      {state.rows.length === 0 && <T muted>No synced careers yet.</T>}
      {state.rows.map((r) => (
        <SaveCard key={r.slot_id} r={r} />
      ))}
      <Button label="Play FootMax" icon="football" variant="ghost" onPress={() => router.replace('/')} />
    </Screen>
  );
}
