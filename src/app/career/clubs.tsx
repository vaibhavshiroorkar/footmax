import React, { useMemo, useState } from 'react';
import { Platform, Text, TextInput, View } from 'react-native';
import { Redirect, useRouter } from 'expo-router';
import { useGame, useStore } from '../../state/store';
import { Badge, Button, Card, ConfirmButton, Icon, Pill, Row, Screen, StatBar, T, Tabs, inputStyle } from '../../ui/kit';
import { dressingRoom } from '../../ui/playHub';
import { PlayerRow } from '../../ui/playerRow';
import { careerRequest } from '../../engine/offers';
import { squadStatus } from '../../engine/career';
import { colors, fonts } from '../../ui/theme';
import { agentFee, canPitch, coachTrust, fameNeeded, interestedClubs, offerSelf, relationMod, searchClubs, teamRating, trustLabel } from '../../engine/relations';
import { formAverage, teamById } from '../../engine/lineup';
import { leagueOf, tablePosition } from '../../engine/league';
import { ordinal } from '../../engine/manager';
import { formatMoney, overall } from '../../engine/player';
import { Club, Fixture, Game, Player, Position } from '../../engine/types';

type Tab = 'club' | 'squad' | 'move';
type Market = 'keen' | 'all';

function interestColor(v: number) {
  return v >= 70 ? colors.green : v >= 45 ? colors.gold : colors.red;
}

// Three jobs, one at a time: how things are at your club, who you are up
// against for a place, and where you could go next.
export default function Clubs() {
  const game = useGame();
  const p = game?.career ? game.world.players[game.career.playerId] : null;
  const [tab, setTab] = useState<Tab>(p?.clubId ? 'club' : 'move');
  if (!game?.career || !p) return <Redirect href="/" />;
  const club = p.clubId ? game.world.clubs[p.clubId] : null;
  return (
    <Screen title="Club">
      <Tabs<Tab>
        tabs={[
          { key: 'club', label: 'My club' },
          { key: 'squad', label: 'Squad' },
          { key: 'move', label: 'Transfers' },
        ]}
        value={club ? tab : 'move'}
        onChange={setTab}
      />
      {club && tab === 'club' && <MyClub game={game} club={club} />}
      {club && tab === 'squad' && <Squad game={game} club={club} me={p} />}
      {(!club || tab === 'move') && <Transfers game={game} />}
    </Screen>
  );
}

function MyClub({ game, club }: { game: Game; club: Club }) {
  const router = useRouter();
  const mutate = useStore((s) => s.mutate);
  const [reply, setReply] = useState<string | null>(null);
  const p = game.world.players[game.career!.playerId];
  const trust = coachTrust(game);
  const form = formAverage(p);
  const pos = tablePosition(game.world, club.id);
  const inEurope = game.world.europe?.clubs.includes(club.id);
  return (
    <>
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
        <StatBar label="Dressing room" icon="people" value={dressingRoom(game)} color={interestColor(dressingRoom(game))} />
        <T muted style={{ fontSize: 12.5 }}>
          {form === null ? 'Play some games so the coach can judge you.' : `Form ${form.toFixed(1)} over your last ${p.form?.length} games. Under 6.2 risks the bench; over 7.3 and the team is built around you.`}
        </T>
        <Row gap={8}>
          <Button label="League table" icon="podium" small variant="secondary" style={{ flex: 1 }} onPress={() => router.push('/league')} />
          {inEurope && <Button label="Europe" icon="trophy" small variant="secondary" style={{ flex: 1 }} onPress={() => router.push('/europe')} />}
        </Row>
      </Card>
      <Fixtures game={game} club={club} />
      <Card>
        <Row style={{ justifyContent: 'space-between' }}>
          <Text style={{ fontFamily: fonts.display, fontSize: 20, color: colors.text }}>Talk to the club</Text>
          <T muted style={{ fontSize: 12 }}>
            One request every 6 weeks
          </T>
        </Row>
        <Row style={{ flexWrap: 'wrap' }}>
          <Button label="Ask for a raise" small variant="secondary" onPress={() => setReply(mutate((g) => careerRequest(g, 'raise')))} />
          <ConfirmButton label="Ask to leave" confirmLabel="Sure? Tap again" small variant="secondary" onPress={() => setReply(mutate((g) => careerRequest(g, 'move')))} />
          <Button label="Ask for a loan" small variant="secondary" onPress={() => setReply(mutate((g) => careerRequest(g, 'loan')))} />
        </Row>
        {/* Keeps its height, so an answer moves nothing. */}
        <T style={{ color: colors.gold, minHeight: 40, fontSize: 13 }}>{reply ?? ' '}</T>
      </Card>
    </>
  );
}

// What is coming up, league and Europe together.
function Fixtures({ game, club }: { game: Game; club: Club }) {
  const world = game.world;
  const mine = (f: Fixture) => !f.played && (f.homeId === club.id || f.awayId === club.id);
  const list = [...(leagueOf(world, club.id)?.fixtures.filter(mine) ?? []), ...(world.europe?.season === world.season ? world.europe.fixtures.filter(mine) : [])]
    .filter((f) => f.week >= world.week)
    .sort((a, b) => a.week - b.week || Number(!!b.europe) - Number(!!a.europe))
    .slice(0, 4);
  if (!list.length) return null;
  return (
    <Card>
      <Text style={{ fontFamily: fonts.display, fontSize: 20, color: colors.text }}>Coming up</Text>
      {list.map((f) => {
        const home = f.homeId === club.id;
        const rival = teamById(world, home ? f.awayId : f.homeId);
        return (
          <Row key={f.id} gap={10} style={{ paddingVertical: 3 }}>
            <Text style={{ width: 44, fontFamily: fonts.semibold, fontSize: 12, color: colors.muted }}>Wk {f.week}</Text>
            <Badge club={rival} size={22} />
            <Text style={{ flex: 1, fontFamily: fonts.medium, fontSize: 13.5, color: colors.text }} numberOfLines={1}>
              {rival.name}
            </Text>
            <Text style={{ fontFamily: fonts.semibold, fontSize: 11.5, color: f.europe ? colors.gold : colors.muted }}>{f.europe ? 'Europe' : home ? 'Home' : 'Away'}</Text>
          </Row>
        );
      })}
    </Card>
  );
}

const LINES: { key: Position; label: string }[] = [
  { key: 'GK', label: 'Keepers' },
  { key: 'DEF', label: 'Defenders' },
  { key: 'MID', label: 'Midfielders' },
  { key: 'FWD', label: 'Forwards' },
];

// The squad by line, best first, so you can see who you have to beat.
function Squad({ game, club, me }: { game: Game; club: Club; me: Player }) {
  const router = useRouter();
  const all = club.playerIds.map((id) => game.world.players[id]).filter(Boolean);
  const rivals = all.filter((x) => x.position === me.position).sort((a, b) => overall(b) - overall(a));
  const place = rivals.findIndex((x) => x.id === me.id) + 1;
  return (
    <>
      <Card>
        <Row style={{ justifyContent: 'space-between' }}>
          <Text style={{ fontFamily: fonts.display, fontSize: 20, color: colors.text }}>{squadStatus(game)}</Text>
          <Pill label={`${ordinal(place)} of ${rivals.length} in your line`} icon="people" color={place <= 2 ? colors.green : colors.gold} />
        </Row>
      </Card>
      {LINES.map(({ key, label }) => {
        const line = all.filter((x) => x.position === key).sort((a, b) => overall(b) - overall(a));
        if (!line.length) return null;
        return (
          <Card key={key}>
            <Text style={{ fontFamily: fonts.display, fontSize: 18, color: colors.text }}>{label}</Text>
            {line.map((x) => (
              <PlayerRow key={x.id} p={x} selected={x.id === me.id} onPress={() => router.push(`/player/${x.id}`)} />
            ))}
          </Card>
        );
      })}
    </>
  );
}

// Where you could go: keen clubs, or a search over all of them. Fame decides
// who will listen, and the agent charges to pitch you to the big ones.
function Transfers({ game }: { game: Game }) {
  const mutate = useStore((s) => s.mutate);
  const showToast = useStore((s) => s.showToast);
  const rev = useStore((s) => s.rev);
  const [market, setMarket] = useState<Market>('keen');
  const [q, setQ] = useState('');
  const list = useMemo(
    () => (market === 'keen' ? interestedClubs(game, 25) : searchClubs(game, q, 40)),
    // rev: the game changes in place, so its identity alone does not.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [game, market, q, rev],
  );
  const c = game.career!;
  const blocked = canPitch(game);
  return (
    <>
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
      <Tabs<Market>
        tabs={[
          { key: 'keen', label: 'Keen on you' },
          { key: 'all', label: 'All clubs' },
        ]}
        value={market}
        onChange={setMarket}
      />
      {market === 'all' && (
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
      {list.length === 0 && <T muted>{market === 'keen' ? 'No clubs at your level right now.' : 'No clubs match.'}</T>}
      <T muted style={{ fontSize: 11.5, textAlign: 'center' }}>
        Interest runs 0 to 100. 70 or more means they are keen.
      </T>
    </>
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
