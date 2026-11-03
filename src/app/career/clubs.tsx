import React, { useMemo, useState } from 'react';
import { Platform, Text, TextInput, View } from 'react-native';
import { Redirect } from 'expo-router';
import { useGame, useStore } from '../../state/store';
import { Badge, Button, Card, Icon, Pill, Row, Screen, StatBar, T, Tabs, inputStyle } from '../../ui/kit';
import { colors, fonts } from '../../ui/theme';
import { agentFee, canPitch, coachTrust, fameNeeded, interestedClubs, offerSelf, relationMod, searchClubs, teamRating, trustLabel } from '../../engine/relations';
import { formAverage } from '../../engine/lineup';
import { leagueOf, tablePosition } from '../../engine/league';
import { ordinal } from '../../engine/manager';
import { formatMoney } from '../../engine/player';
import { Game } from '../../engine/types';

type Tab = 'keen' | 'all';

function interestColor(v: number) {
  return v >= 70 ? colors.green : v >= 45 ? colors.gold : colors.red;
}

// Your club first, then every club you could move to: keen ones, or a
// search over all of them. Fame decides who will listen; the agent charges
// to pitch you to the big ones.
export default function Clubs() {
  const game = useGame();
  const mutate = useStore((s) => s.mutate);
  const showToast = useStore((s) => s.showToast);
  const rev = useStore((s) => s.rev);
  const [tab, setTab] = useState<Tab>('keen');
  const [q, setQ] = useState('');
  const list = useMemo(
    () => (game?.career ? (tab === 'keen' ? interestedClubs(game, 25) : searchClubs(game, q, 40)) : []),
    // rev: the game changes in place, so its identity alone does not.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [game, tab, q, rev],
  );
  if (!game?.career) return <Redirect href="/" />;
  const c = game.career;
  const p = game.world.players[c.playerId];
  const club = p.clubId ? game.world.clubs[p.clubId] : null;
  const trust = coachTrust(game);
  const form = formAverage(p);
  const blocked = canPitch(game);
  const pos = club ? tablePosition(game.world, club.id) : 0;

  return (
    <Screen title="Clubs">
      {club && (
        <Card tint={club.colors[0] === '#ffffff' ? club.colors[1] : club.colors[0]}>
          <Row gap={12}>
            <Badge club={club} size={46} />
            <View style={{ flex: 1, minWidth: 0 }}>
              <Text style={{ fontFamily: fonts.displayBold, fontSize: 20, color: colors.text }} numberOfLines={1}>
                {club.name}
              </Text>
              <T muted style={{ fontSize: 12.5 }}>
                {[leagueOf(game.world, club.id)?.name, pos ? `${ordinal(pos)} in the table` : ''].filter(Boolean).join('  |  ')}
              </T>
            </View>
            <View style={{ alignItems: 'center' }}>
              <Text style={{ fontFamily: fonts.display, fontSize: 24, color: colors.text }}>{teamRating(game.world, club)}</Text>
              <Text style={{ fontFamily: fonts.semibold, fontSize: 10.5, color: colors.muted }}>TEAM</Text>
            </View>
          </Row>
          <StatBar label={`Coach's trust: ${trustLabel(trust)}`} icon="person" value={trust} color={interestColor(trust)} />
          <T muted style={{ fontSize: 12.5 }}>
            {form === null ? 'Play some games so the coach can judge you.' : `Form ${form.toFixed(1)} over your last ${p.form?.length} games. Under 6.2 risks the bench; over 7.3 and the team is built around you.`}
          </T>
        </Card>
      )}

      <Card>
        <Row style={{ justifyContent: 'space-between' }}>
          <Row gap={8}>
            <Icon name="flame" size={16} color={colors.orange} />
            <Text style={{ fontFamily: fonts.display, fontSize: 20, color: colors.text }}>{Math.floor(c.fame)} fame</Text>
          </Row>
          <Row gap={8}>
            <Icon name="wallet" size={16} color={colors.gold} />
            <Text style={{ fontFamily: fonts.display, fontSize: 20, color: colors.text }}>{formatMoney(c.money)}</Text>
          </Row>
        </Row>
        <T muted style={{ fontSize: 12.5 }}>
          Your agent can pitch you to one club every 3 weeks, in a transfer window or as a free agent. Each club needs a level of fame before it listens, and the big ones cost an agent fee.
        </T>
        {blocked && <Pill label={blocked} icon="time" color={colors.gold} />}
      </Card>

      <Tabs<Tab>
        tabs={[
          { key: 'keen', label: 'Keen on you' },
          { key: 'all', label: 'All clubs' },
        ]}
        value={tab}
        onChange={setTab}
      />
      {tab === 'all' && (
        <View style={[inputStyle, { flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 0 }]}>
          <Icon name="search" size={16} color={colors.faint} />
          <TextInput
            keyboardAppearance="dark"
            selectionColor={colors.accent}
            style={{ flex: 1, minWidth: 0, paddingVertical: 12, color: colors.text, fontFamily: fonts.medium, fontSize: 15, ...(Platform.OS === 'web' ? ({ outlineStyle: 'none', outlineWidth: 0 } as object) : {}) }}
            placeholder="Search clubs"
            placeholderTextColor={colors.faint}
            value={q}
            onChangeText={setQ}
          />
        </View>
      )}
      {list.map(({ clubId, interest }) => (
        <ClubRow key={clubId} game={game} clubId={clubId} interest={interest} blocked={blocked} onOffer={() => showToast(mutate((g) => offerSelf(g, clubId)))} />
      ))}
      {list.length === 0 && <T muted>{tab === 'keen' ? 'No clubs at your level right now.' : 'No clubs match.'}</T>}
      <T muted style={{ fontSize: 11.5, textAlign: 'center' }}>
        Interest runs 0 to 100. 70 or more means they are keen.
      </T>
    </Screen>
  );
}

function ClubRow({ game, clubId, interest, blocked, onOffer }: { game: Game; clubId: string; interest: number; blocked: string | null; onOffer: () => void }) {
  const c = game.world.clubs[clubId];
  const career = game.career!;
  const rel = relationMod(game, clubId);
  const need = fameNeeded(c);
  const fee = agentFee(c);
  const short = career.fame < need;
  const broke = career.money < fee;
  const reason = blocked ? 'Not now' : short ? `Needs ${need} fame` : broke ? `Fee ${formatMoney(fee)}` : null;
  return (
    <Card>
      <Row gap={12}>
        <Badge club={c} size={38} />
        <View style={{ flex: 1, minWidth: 0 }}>
          <Text style={{ fontFamily: fonts.semibold, fontSize: 15, color: colors.text }} numberOfLines={1}>
            {c.name}
          </Text>
          <T muted style={{ fontSize: 12 }}>
            {[leagueOf(game.world, clubId)?.name, rel ? `history ${rel > 0 ? '+' : ''}${rel}` : ''].filter(Boolean).join('  |  ')}
          </T>
        </View>
        <View style={{ alignItems: 'center', width: 44 }}>
          <Text style={{ fontFamily: fonts.display, fontSize: 22, color: colors.text }}>{teamRating(game.world, c)}</Text>
          <Text style={{ fontFamily: fonts.semibold, fontSize: 10, color: colors.muted }}>TEAM</Text>
        </View>
        <View style={{ alignItems: 'center', width: 54 }}>
          <Text style={{ fontFamily: fonts.display, fontSize: 22, color: interestColor(interest) }}>{interest}</Text>
          <Text style={{ fontFamily: fonts.semibold, fontSize: 10, color: colors.muted }}>INTEREST</Text>
        </View>
      </Row>
      <Row gap={8} style={{ flexWrap: 'wrap' }}>
        <Pill label={need ? `${need} fame needed` : 'Any fame'} icon="flame" color={short ? colors.red : colors.green} />
        <Pill label={fee ? `Agent fee ${formatMoney(fee)}` : 'No fee'} icon="wallet" color={broke ? colors.red : colors.muted} />
      </Row>
      <Button label={reason ?? 'Offer yourself'} icon={reason ? 'lock-closed' : 'paper-plane'} small variant="secondary" disabled={!!reason} onPress={onOffer} />
    </Card>
  );
}
