import React, { useState } from 'react';
import { View } from 'react-native';
import { useRouter } from 'expo-router';
import Svg, { Circle, Line, Rect } from 'react-native-svg';
import { Club, Formation, Style } from '../engine/types';
import { autoLineup, available, FORMATIONS, POSITIONS, squad, startingXI } from '../engine/lineup';
import { formatMoney } from '../engine/player';
import { useGame, useStore } from '../state/store';
import { Button, Card, Choice, H2, Row, T } from './kit';
import { PlayerRow } from './playerRow';
import { colors } from './theme';

// Tap a starter, then a reserve, to swap them.
export function LineupEditor({ team }: { team: Club }) {
  const game = useGame()!;
  const mutate = useStore((s) => s.mutate);
  const router = useRouter();
  const [picked, setPicked] = useState<string | null>(null);
  const xi = startingXI(game.world, team);
  const rest = squad(game.world, team).filter((p) => !xi.includes(p.id));
  const order = (ids: string[]) => ids.map((id) => game.world.players[id]).sort((a, b) => POSITIONS.indexOf(a.position) - POSITIONS.indexOf(b.position));

  const tap = (id: string) => {
    if (!picked) return setPicked(id);
    if (picked === id) return setPicked(null);
    const aIn = xi.includes(picked);
    const bIn = xi.includes(id);
    if (aIn !== bIn) {
      const out = aIn ? picked : id;
      const inn = aIn ? id : picked;
      if (available(game.world.players[inn])) mutate(() => (team.lineup = xi.map((x) => (x === out ? inn : x))));
      setPicked(null);
    } else setPicked(id);
  };
  const note = (id: string) => {
    const p = game.world.players[id];
    const club = !team.national ? null : p.clubId ? game.world.clubs[p.clubId] : null;
    return `fit ${Math.round(p.fitness)}${p.loan ? ', on loan' : ''}${p.listed ? `, ${p.listed} listed` : ''}${club ? `, ${club.name}` : ''}`;
  };

  return (
    <>
      <Card>
        <T muted style={{ fontSize: 13 }}>
          Tap a starter and then a reserve to swap them. Injured players drop out of the lineup by themselves.
        </T>
        <Row>
          <Button label="Auto pick best XI" small variant="secondary" style={{ flex: 1 }} onPress={() => mutate(() => (team.lineup = autoLineup(game.world, team)))} />
          {picked && <Button label="Player details" small variant="secondary" style={{ flex: 1 }} onPress={() => router.push(`/player/${picked}`)} />}
        </Row>
      </Card>
      <Card>
        <H2>Starting XI ({team.formation})</H2>
        {order(xi).map((p) => (
          <PlayerRow key={p.id} p={p} selected={picked === p.id} onPress={() => tap(p.id)} right={team.national ? undefined : `${formatMoney(p.wage)}/w`} note={note(p.id)} />
        ))}
      </Card>
      <Card>
        <H2>Reserves</H2>
        {order(rest.map((p) => p.id)).map((p) => (
          <PlayerRow key={p.id} p={p} selected={picked === p.id} onPress={() => tap(p.id)} right={team.national ? undefined : `${formatMoney(p.wage)}/w`} note={note(p.id)} />
        ))}
      </Card>
    </>
  );
}

const STYLES: { key: Style; label: string; hint: string }[] = [
  { key: 'balanced', label: 'Balanced', hint: 'No big risks either way.' },
  { key: 'possession', label: 'Possession', hint: 'Keep the ball, concede fewer chances.' },
  { key: 'counter', label: 'Counter attack', hint: 'Less of the ball, sharper finishing.' },
  { key: 'press', label: 'High press', hint: 'More chances for both sides. Tires players.' },
];

export function TacticsEditor({ team }: { team: Club }) {
  const mutate = useStore((s) => s.mutate);
  useGame();
  const lines = team.formation.split('-').map(Number);
  return (
    <>
      <Card>
        <H2>Formation</H2>
        <Svg width="100%" height={220} viewBox="0 0 300 220">
          <Rect x={0} y={0} width={300} height={220} fill={colors.pitch} rx={8} />
          <Line x1={0} y1={110} x2={300} y2={110} stroke={colors.pitchLine} strokeWidth={1.5} opacity={0.6} />
          <Circle cx={150} cy={110} r={26} stroke={colors.pitchLine} strokeWidth={1.5} fill="none" opacity={0.6} />
          <Circle cx={150} cy={205} r={9} fill={colors.gold} />
          {lines.map((n, row) =>
            Array.from({ length: n }, (_, i) => (
              <Circle key={`${row}-${i}`} cx={(300 / (n + 1)) * (i + 1)} cy={170 - (row * 140) / Math.max(1, lines.length - 1)} r={9} fill={team.colors[0]} stroke={team.colors[1]} strokeWidth={2} />
            )),
          )}
        </Svg>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
          {(Object.keys(FORMATIONS) as Formation[]).map((f) => (
            <Choice
              key={f}
              half
              active={team.formation === f}
              label={f}
              sub={`${FORMATIONS[f].DEF} DEF, ${FORMATIONS[f].MID} MID, ${FORMATIONS[f].FWD} FWD`}
              onPress={() =>
                mutate(() => {
                  team.formation = f;
                  team.lineup = null;
                })
              }
            />
          ))}
        </View>
        <T muted style={{ fontSize: 12 }}>
          Changing formation resets the lineup to the best XI for the new shape.
        </T>
      </Card>
      <Card>
        <H2>Style</H2>
        {STYLES.map((s) => (
          <Choice key={s.key} active={team.style === s.key} label={s.label} sub={s.hint} onPress={() => mutate(() => (team.style = s.key))} />
        ))}
      </Card>
    </>
  );
}
