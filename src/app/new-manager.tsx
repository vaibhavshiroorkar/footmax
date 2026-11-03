import React, { useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, TextInput, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useStore } from '../state/store';
import { Badge, Button, Card, Choice, Row, Screen, T, inputStyle } from '../ui/kit';
import { NationPicker } from '../ui/shared';
import { alpha, colors } from '../ui/theme';
import { generateWorld, newManagerGame, newSeed } from '../engine/game';
import { formatMoney } from '../engine/player';
import { ensureDomesticLeague, nationById, targetOverall , START_YEAR } from '../engine/generator';
import { teamRating } from '../engine/international';
import { World } from '../engine/types';

import { SeasonPicker, useSeasonPack } from '../ui/seasonPicker';

// Rating of every player a nation could pick. It scans the whole world, so
// it is cached per world and nation instead of rerun on every keystroke.
const ratingCache = new WeakMap<World, Map<string, number>>();
function nationRating(world: World, nationId: string, teamId: string): number {
  let byNation = ratingCache.get(world);
  if (!byNation) ratingCache.set(world, (byNation = new Map()));
  let r = byNation.get(nationId);
  if (r === undefined) {
    r = Math.round(teamRating(world, { ...world.nationalTeams[teamId], playerIds: Object.values(world.players).filter((p) => p.nationId === nationId).map((p) => p.id) }));
    byNation.set(nationId, r);
  }
  return r;
}

// The world takes a moment to build, so it is made after the first paint.
export default function NewManager() {
  const customPack = useStore((s) => s.customPack);
  const [usePack, setUsePack] = useState(false);
  const [world, setWorld] = useState<World | null>(null);
  const [year, setYear] = useState(START_YEAR);
  const seasonPack = useSeasonPack(year);
  const pack = usePack && customPack ? customPack : seasonPack;
  useEffect(() => {
    if (!pack) return;
    let live = true;
    const t = setTimeout(() => live && setWorld(generateWorld(newSeed(), pack)), 30);
    return () => {
      live = false;
      clearTimeout(t);
    };
  }, [pack]);
  if (!world) {
    return (
      <Screen title="New manager game">
        <ActivityIndicator color={colors.accent} style={{ paddingVertical: 40 }} />
        <T muted style={{ textAlign: 'center' }}>
          Building the world...
        </T>
      </Screen>
    );
  }
  return (
    <ManagerSetup
      key={usePack ? 'pack' : `season-${year}`}
      world={world}
      year={year}
      onYear={(y) => {
        setYear(y);
        setWorld(null);
      }}
      usePack={usePack}
      onTogglePack={() => {
        setUsePack(!usePack);
        setWorld(null);
      }}
    />
  );
}

function ManagerSetup({ world, year, onYear, usePack, onTogglePack }: { world: World; year: number; onYear: (year: number) => void; usePack: boolean; onTogglePack: () => void }) {
  const router = useRouter();
  const setGame = useStore((s) => s.startGame);
  const customPack = useStore((s) => s.customPack);
  const [nationId, setNationId] = useState('ENG');
  const [clubId, setClubId] = useState<string | null>(null);
  const [withNation, setWithNation] = useState(false);
  const [nationOnly, setNationOnly] = useState(false);
  const [name, setName] = useState('');

  const nation = nationById(world, nationId)!;
  const leagues = nation.leagueIds.map((id) => world.leagues.find((l) => l.id === id)!).filter(Boolean);
  const squadRating = nationRating(world, nation.id, nation.teamId);

  const ready = nationOnly || !!clubId;
  const label = nationOnly ? `Manage ${nation.name}` : clubId ? `Take charge of ${world.clubs[clubId].name}${withNation ? ` and ${nation.name}` : ''}` : 'Pick a club';

  return (
    <Screen title="New manager game">
      {!usePack && <SeasonPicker value={year} onChange={onYear} />}
      <Card>
        <T bold>Your name</T>
        <TextInput keyboardAppearance="dark" selectionColor={colors.accent} style={inputStyle} placeholder="Manager name" placeholderTextColor={colors.faint} value={name} onChangeText={setName} maxLength={24} />
      </Card>
      <Card>
        <T bold>Nation</T>
        <NationPicker
          world={world}
          value={nationId}
          onChange={(id) => {
            // Nations without a simulated league get one built from their real clubs.
            if (!nationById(world, id)?.leagueIds.length) ensureDomesticLeague(world, id);
            setNationId(id);
            setClubId(null);
          }}
        />
      </Card>
      <Card>
        <T bold>National team</T>
        <T muted style={{ fontSize: 13 }}>
          {nation.name}: squad rating {squadRating}
        </T>
        <Choice active={withNation && !nationOnly} label={`Club and ${nation.name}`} sub="Run a club and the national team at the same time." onPress={() => { setWithNation(!withNation); setNationOnly(false); }} />
        <Choice active={nationOnly} label={`${nation.name} only`} sub="No club. You play the summer tournaments." onPress={() => { setNationOnly(!nationOnly); setWithNation(false); }} />
      </Card>
      {!nationOnly &&
        leagues.map((league) => (
          <Card key={league.id}>
            <T bold>{league.name}</T>
            {[...league.clubIds]
              .sort((a, b) => world.clubs[b].reputation - world.clubs[a].reputation)
              .map((id) => {
                const c = world.clubs[id];
                const active = clubId === id;
                return (
                  <Pressable key={id} onPress={() => setClubId(id)} style={{ paddingVertical: 8, paddingHorizontal: 8, borderRadius: 8, backgroundColor: active ? alpha(colors.accent, 0.1) : 'transparent', borderWidth: 1, borderColor: active ? colors.accent : 'transparent' }}>
                    <Row>
                      <Badge club={c} size={32} />
                      <View style={{ flex: 1 }}>
                        <T bold={active}>{c.name}</T>
                        <T muted style={{ fontSize: 12 }}>
                          Rep {c.reputation}, squad level {targetOverall(c.reputation)}, budget {formatMoney(c.budget)}
                        </T>
                      </View>
                    </Row>
                  </Pressable>
                );
              })}
          </Card>
        ))}
      {customPack && (
        <Card>
          <Choice active={usePack} label={`Use imported data pack: ${customPack.name}`} onPress={onTogglePack} />
        </Card>
      )}
      <Button
        label={label}
        disabled={!ready}
        onPress={() => {
          const nt = nationOnly || withNation ? nation.teamId : null;
          if (!setGame(newManagerGame(world, nationOnly ? null : clubId, nt, name))) {
            useStore.getState().showToast('All save slots are in use. Delete a save on the title screen first.', '/');
            return;
          }
          router.replace('/manager');
        }}
      />
    </Screen>
  );
}
