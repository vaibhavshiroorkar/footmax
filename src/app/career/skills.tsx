import React from 'react';
import { Text, View } from 'react-native';
import { Redirect, useRouter } from 'expo-router';
import { useGame } from '../../state/store';
import { AnimatedNumber, Button, Card, Row, StatBar, T } from '../../ui/kit';
import { xpForLevel } from '../../engine/skills';
import { readyNodes, rolesOf } from '../../engine/skillTree';
import { perkLines } from '../../engine/perks';
import { colors, fonts } from '../../ui/theme';

// The abilities tab on Train: your level, a way into the tree, and what your
// attributes are giving you.
export function SkillsBody() {
  const game = useGame();
  const router = useRouter();
  if (!game?.career) return <Redirect href="/" />;
  const c = game.career;
  const p = game.world.players[c.playerId];
  const ready = readyNodes(p, c.skillPoints).length;
  return (
    <>
      <Card glow={ready ? colors.accent : undefined}>
        <Row style={{ justifyContent: 'space-between', alignItems: 'flex-end' }}>
          <View>
            <Text style={{ fontFamily: fonts.semibold, fontSize: 11.5, color: colors.muted, letterSpacing: 1.4 }}>LEVEL</Text>
            <AnimatedNumber value={c.level} style={{ fontFamily: fonts.display, fontSize: 44, color: colors.text, lineHeight: 48 }} />
          </View>
          <View style={{ alignItems: 'flex-end' }}>
            <Text style={{ fontFamily: fonts.semibold, fontSize: 11.5, color: colors.muted, letterSpacing: 1.4 }}>LEVEL POINTS</Text>
            <AnimatedNumber value={c.skillPoints} style={{ fontFamily: fonts.display, fontSize: 44, color: c.skillPoints ? colors.accent : colors.faint, lineHeight: 48 }} />
          </View>
        </Row>
        <StatBar label="XP to next level" value={c.xp} max={xpForLevel(c.level)} color={colors.accent} right={`${c.xp} / ${xpForLevel(c.level)}`} />
        <Button label={ready ? `Ability tree  |  ${ready} ready` : 'Ability tree'} icon="git-network" onPress={() => router.push('/career/tree')} />
      </Card>
      <Card>
        <Text style={{ fontFamily: fonts.display, fontSize: 19, color: colors.text }}>What your attributes give you</Text>
        {perkLines(p).map((l) => (
          <Row key={l.label} style={{ justifyContent: 'space-between' }}>
            <T muted style={{ fontSize: 12.5 }}>{l.label}</T>
            <T style={{ fontSize: 12.5 }}>{l.value}</T>
          </Row>
        ))}
        <T muted style={{ fontSize: 12.5 }}>Positions: {rolesOf(p).join(', ') || p.position}</T>
      </Card>
    </>
  );
}

// Old links to the skills screen land on the Skills half of Train.
export default function Skills() {
  return <Redirect href="/career/train?tab=skills" />;
}
