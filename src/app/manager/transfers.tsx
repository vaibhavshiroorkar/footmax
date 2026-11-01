import React, { useMemo, useState } from 'react';
import { Pressable, TextInput, View } from 'react-native';
import { Redirect, useRouter } from 'expo-router';
import { useGame, useStore } from '../../state/store';
import { Button, Card, Pill, Row, Screen, T, Tabs, inputStyle } from '../../ui/kit';
import { PlayerRow } from '../../ui/playerRow';
import { colors } from '../../ui/theme';
import { managerClub } from '../../engine/manager';
import { MarketFilter, inTransferWindow, interestIn, searchMarket } from '../../engine/transfers';
import { formatMoney } from '../../engine/player';
import { Position } from '../../engine/types';
import { NationPicker } from '../../ui/shared';

type PosFilter = 'ALL' | Position;
type Sort = NonNullable<MarketFilter['sort']>;

const PRICES = [
  { label: 'Any', value: undefined },
  { label: 'Budget', value: -1 },
  { label: '< $5M', value: 5_000_000 },
  { label: '< $20M', value: 20_000_000 },
  { label: '< $60M', value: 60_000_000 },
];
const AGES = [
  { label: 'Any age', min: undefined, max: undefined },
  { label: 'U21', min: undefined, max: 21 },
  { label: '22-28', min: 22, max: 28 },
  { label: '29+', min: 29, max: undefined },
];
const RATINGS = [undefined, 70, 75, 80, 85];

function Chip({ label, active, onPress }: { label: string; active: boolean; onPress: () => void }) {
  return (
    <Pressable onPress={onPress} style={{ paddingHorizontal: 10, paddingVertical: 6, borderRadius: 999, borderWidth: 1, borderColor: active ? colors.accent : colors.border, backgroundColor: active ? '#1b2614' : 'transparent' }}>
      <T style={{ fontSize: 12, color: active ? colors.accent : colors.text }}>{label}</T>
    </Pressable>
  );
}

export default function Transfers() {
  const game = useGame();
  const router = useRouter();
  const rev = useStore((s) => s.rev);
  const [text, setText] = useState('');
  const [pos, setPos] = useState<PosFilter>('ALL');
  const [price, setPrice] = useState(1);
  const [age, setAge] = useState(0);
  const [minOvr, setMinOvr] = useState<number | undefined>(undefined);
  const [leagueId, setLeagueId] = useState<string | undefined>(undefined);
  const [nationId, setNationId] = useState<string | undefined>(undefined);
  const [listedOnly, setListedOnly] = useState(false);
  const [sort, setSort] = useState<Sort>('ovr');
  const [page, setPage] = useState(0);
  const [showFilters, setShowFilters] = useState(false);

  const club = game ? managerClub(game) : null;

  const result = useMemo(() => {
    if (!game || !club) return { rows: [], total: 0 };
    const cap = PRICES[price].value;
    return searchMarket(
      game.world,
      club.id,
      {
        text,
        position: pos === 'ALL' ? undefined : pos,
        maxPrice: cap === -1 ? club.budget : cap,
        minAge: AGES[age].min,
        maxAge: AGES[age].max,
        minOvr,
        leagueId: leagueId === 'free' ? undefined : leagueId,
        freeOnly: leagueId === 'free',
        nationId,
        listedOnly,
        sort,
      },
      page,
    );
    // rev re-runs the search after any transfer: the game is changed in
    // place, so the game object alone does not change identity.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [game, club, rev, text, pos, price, age, minOvr, leagueId, nationId, listedOnly, sort, page]);

  if (!game || !club) return <Redirect href="/manager" />;
  const reset = () => setPage(0);
  const pages = Math.max(1, Math.ceil(result.total / 30));

  return (
    <Screen title="Transfer market" nav="manager">
      <Card>
        <Row style={{ justifyContent: 'space-between' }}>
          <T muted>Budget</T>
          <T bold>{formatMoney(club.budget)}</T>
        </Row>
        <Row style={{ justifyContent: 'space-between' }}>
          <T muted>Window</T>
          {inTransferWindow(game.world.week) ? <Pill label="Open" color={colors.accent} /> : <Pill label="Closed: free agents only" color={colors.red} />}
        </Row>
        <T muted style={{ fontSize: 12 }}>
          Windows: weeks 1 to 5 and 19 to 22. Every player in the world is listed; stars ask for big wages to join smaller clubs.
        </T>
      </Card>
      <TextInput style={inputStyle} placeholder="Search by name" placeholderTextColor={colors.faint} value={text} onChangeText={(t) => { setText(t); reset(); }} />
      <Tabs<PosFilter> tabs={(['ALL', 'GK', 'DEF', 'MID', 'FWD'] as const).map((k) => ({ key: k, label: k === 'ALL' ? 'All' : k }))} value={pos} onChange={(v) => { setPos(v); reset(); }} />
      <Button label={showFilters ? 'Hide filters' : 'Filters: price, age, rating, league, nation, sort'} icon={showFilters ? 'chevron-up' : 'options'} small variant="secondary" onPress={() => setShowFilters(!showFilters)} />
      {showFilters && (
      <Card style={{ gap: 8 }}>
        <T muted style={{ fontSize: 11, fontWeight: '700' }}>PRICE</T>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
          {PRICES.map((p, i) => (
            <Chip key={p.label} label={p.label} active={price === i} onPress={() => { setPrice(i); reset(); }} />
          ))}
        </View>
        <T muted style={{ fontSize: 11, fontWeight: '700' }}>AGE AND RATING</T>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
          {AGES.map((a, i) => (
            <Chip key={a.label} label={a.label} active={age === i} onPress={() => { setAge(i); reset(); }} />
          ))}
          {RATINGS.map((r) => (
            <Chip key={String(r)} label={r ? `${r}+` : 'Any rating'} active={minOvr === r} onPress={() => { setMinOvr(r); reset(); }} />
          ))}
        </View>
        <T muted style={{ fontSize: 11, fontWeight: '700' }}>LEAGUE</T>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
          <Chip label="All" active={!leagueId} onPress={() => { setLeagueId(undefined); reset(); }} />
          {game.world.leagues.map((l) => (
            <Chip key={l.id} label={l.name} active={leagueId === l.id} onPress={() => { setLeagueId(l.id); reset(); }} />
          ))}
          <Chip label="Rest of world" active={leagueId === 'other'} onPress={() => { setLeagueId('other'); reset(); }} />
          <Chip label="Free agents" active={leagueId === 'free'} onPress={() => { setLeagueId('free'); reset(); }} />
        </View>
        <T muted style={{ fontSize: 11, fontWeight: '700' }}>NATION</T>
        <NationPicker world={game.world} value={nationId ?? ''} allowAny includeMinor onChange={(id) => { setNationId(id || undefined); reset(); }} />
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
          <Chip label="Listed for sale/loan" active={listedOnly} onPress={() => { setListedOnly(!listedOnly); reset(); }} />
          {(['ovr', 'potential', 'value', 'age'] as Sort[]).map((s) => (
            <Chip key={s} label={`Sort: ${s === 'ovr' ? 'rating' : s}`} active={sort === s} onPress={() => { setSort(s); reset(); }} />
          ))}
        </View>
      </Card>
      )}
      <Card>
        <T muted style={{ fontSize: 12 }}>
          {result.total} players. Page {page + 1} of {pages}.
        </T>
        {result.rows.length === 0 && <T muted>No players match.</T>}
        {result.rows.map(({ p, ask }) => {
          const interest = interestIn(game.world, p, club);
          return (
            <PlayerRow
              key={p.id}
              p={p}
              right={p.loan ? 'On loan' : p.clubId ? formatMoney(ask) : 'Free'}
              note={`${p.clubId ? game.world.clubs[p.clubId].name : 'Free agent'}${interest === 'reluctant' ? ', reluctant' : ''}`}
              onPress={() => router.push(`/player/${p.id}`)}
            />
          );
        })}
        <Row>
          <Button label="Previous" small variant="secondary" style={{ flex: 1 }} disabled={page === 0} onPress={() => setPage(page - 1)} />
          <Button label="Next" small variant="secondary" style={{ flex: 1 }} disabled={page + 1 >= pages} onPress={() => setPage(page + 1)} />
        </Row>
      </Card>
    </Screen>
  );
}
