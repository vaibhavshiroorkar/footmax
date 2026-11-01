import React, { useState } from 'react';
import { Redirect } from 'expo-router';
import { useGame, useStore } from '../../state/store';
import { Button, Card, H2, Pill, Row, Screen, T, Tabs } from '../../ui/kit';
import { LineupEditor, TacticsEditor } from '../../ui/teamEditors';
import { PlayerRow } from '../../ui/playerRow';
import { colors } from '../../ui/theme';
import { managerNation } from '../../engine/manager';
import { nationalPool, pickNationalSquad, SQUAD_SIZE, teamRating } from '../../engine/international';
import { overall } from '../../engine/player';

type Tab = 'squad' | 'lineup' | 'tactics';

export default function National() {
  const game = useGame();
  const mutate = useStore((s) => s.mutate);
  const [tab, setTab] = useState<Tab>('squad');
  const team = game ? managerNation(game) : null;
  if (!game || !team) return <Redirect href="/manager" />;
  const pool = nationalPool(game.world, team.nationId).sort((a, b) => overall(b) - overall(a));
  const inSquad = new Set(team.playerIds);

  const toggle = (id: string) =>
    mutate(() => {
      if (inSquad.has(id)) team.playerIds = team.playerIds.filter((x) => x !== id);
      else if (team.playerIds.length < SQUAD_SIZE) team.playerIds = [...team.playerIds, id];
      team.lineup = null;
    });

  return (
    <Screen title={team.name}>
      <Tabs<Tab>
        tabs={[
          { key: 'squad', label: 'Call-ups' },
          { key: 'lineup', label: 'Lineup' },
          { key: 'tactics', label: 'Tactics' },
        ]}
        value={tab}
        onChange={setTab}
      />
      {tab === 'squad' && (
        <>
          <Card>
            <Row style={{ justifyContent: 'space-between' }}>
              <T bold>
                Squad {team.playerIds.length}/{SQUAD_SIZE}
              </T>
              <Pill label={`Rating ${Math.round(teamRating(game.world, team))}`} color={colors.blue} />
            </Row>
            <T muted style={{ fontSize: 13 }}>
              Tap players to call them up or drop them. Take at least 2 keepers. Your squad is used at international breaks and tournaments.
            </T>
            <Button label="Auto pick best 26" small variant="secondary" onPress={() => mutate(() => {
              team.playerIds = pickNationalSquad(game.world, team.nationId);
              team.lineup = null;
            })} />
          </Card>
          <Card>
            <H2>Eligible players</H2>
            {pool.slice(0, 80).map((p) => (
              <PlayerRow
                key={p.id}
                p={p}
                selected={inSquad.has(p.id)}
                onPress={() => toggle(p.id)}
                right={inSquad.has(p.id) ? 'In squad' : ''}
                note={p.clubId ? game.world.clubs[p.clubId]?.name : 'Free agent'}
              />
            ))}
          </Card>
        </>
      )}
      {tab === 'lineup' && <LineupEditor team={team} />}
      {tab === 'tactics' && <TacticsEditor team={team} />}
    </Screen>
  );
}
