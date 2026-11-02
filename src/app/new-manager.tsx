import React, { useMemo, useState } from 'react';
import { Pressable, TextInput, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useStore } from '../state/store';
import { Badge, Button, Card, Choice, Row, Screen, T, inputStyle } from '../ui/kit';
import { NationPicker } from '../ui/shared';
import { colors } from '../ui/theme';
import { generateWorld, newManagerGame, newSeed } from '../engine/game';
import { formatMoney } from '../engine/player';
import { ensureDomesticLeague, nationById, targetOverall } from '../engine/generator';
import { teamRating } from '../engine/international';

export default function NewManager() {
  const router = useRouter();
  const setGame = useStore((s) => s.startGame);
  const customPack = useStore((s) => s.customPack);
  const [usePack, setUsePack] = useState(false);
  const world = useMemo(() => generateWorld(newSeed(), usePack && customPack ? customPack : undefined), [usePack, customPack]);
  const [nationId, setNationId] = useState('ENG');
  const [clubId, setClubId] = useState<string | null>(null);
  const [withNation, setWithNation] = useState(false);
  const [nationOnly, setNationOnly] = useState(false);
  const [name, setName] = useState('');

  const nation = nationById(world, nationId)!;
  // Nations without a simulated league get one built from their real clubs.
  const leagues = useMemo(() => {
    if (!nation.leagueIds.length) ensureDomesticLeague(world, nation.id);
    return nation.leagueIds.map((id) => world.leagues.find((l) => l.id === id)!);
  }, [world, nation]);
  const team = world.nationalTeams[nation.teamId];

  const ready = nationOnly || !!clubId;
  const label = nationOnly ? `Manage ${nation.name}` : clubId ? `Take charge of ${world.clubs[clubId].name}${withNation ? ` and ${nation.name}` : ''}` : 'Pick a club';

  return (
    <Screen title="New manager game">
      <Card>
        <T bold>Your name</T>
        <TextInput style={inputStyle} placeholder="Manager name" placeholderTextColor={colors.faint} value={name} onChangeText={setName} maxLength={24} />
      </Card>
      <Card>
        <T bold>Nation</T>
        <NationPicker
          world={world}
          value={nationId}
          onChange={(id) => {
            setNationId(id);
            setClubId(null);
          }}
        />
      </Card>
      <Card>
        <T bold>National team</T>
        <T muted style={{ fontSize: 13 }}>
          {nation.name}: squad rating {Math.round(teamRating(world, { ...team, playerIds: Object.values(world.players).filter((p) => p.nationId === nation.id).map((p) => p.id) }))}
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
                  <Pressable key={id} onPress={() => setClubId(id)} style={{ paddingVertical: 8, paddingHorizontal: 8, borderRadius: 8, backgroundColor: active ? '#1b2614' : 'transparent', borderWidth: 1, borderColor: active ? colors.accent : 'transparent' }}>
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
          <Choice active={usePack} label={`Use imported data pack: ${customPack.name}`} onPress={() => setUsePack(!usePack)} />
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
