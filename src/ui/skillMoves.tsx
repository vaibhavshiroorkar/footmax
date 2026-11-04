import React from 'react';
import { Pressable, Text, View } from 'react-native';
import { useGame, useStore } from '../state/store';
import { Card, Icon, IconName, Row, SectionLabel, haptic } from './kit';
import { alpha, colors, fonts } from './theme';
import { SKILL_MOVES, SkillMove, canLearnMove, hasMove } from '../engine/skills';
import { startMove } from '../engine/career';
import { moveFee, moveWeeks } from '../engine/perks';
import { formatMoney } from '../engine/player';

// Skill moves: small icon tiles. You pay the coach and it takes a few weeks, Dribble moves
// can be picked in a dribble moment; finishing moves help the shots they suit.
export function MovesBody() {
  const game = useGame();
  const mutate = useStore((s) => s.mutate);
  const showToast = useStore((s) => s.showToast);
  if (!game?.career) return null;
  const c = game.career;
  const p = game.world.players[c.playerId];

  const tile = (m: SkillMove) => {
    const owned = hasMove(p, m.id);
    const check = canLearnMove(p, m.id);
    const fee = moveFee(m, p);
    const training = c.moveTraining?.id === m.id;
    const ready = !owned && check.ok && !c.moveTraining && c.money >= fee;
    const tone = owned ? colors.gold : ready ? colors.accent : colors.faint;
    return (
      <Pressable
        key={m.id}
        accessibilityRole="button"
        accessibilityLabel={`${m.label}, ${owned ? 'learned' : training ? 'in training' : ready ? `train for ${formatMoney(fee)}` : check.reason ?? 'not now'}`}
        onPress={() => {
          if (owned) return showToast(`${m.label}: ${m.description}`);
          if (training) return showToast(`${c.moveTraining?.weeksLeft} weeks left on ${m.label}.`);
          if (!ready) return showToast(check.reason ?? (c.moveTraining ? 'One move at a time.' : `The coach charges ${formatMoney(fee)}.`));
          const r = mutate((g) => startMove(g, m.id));
          showToast(r.text);
          if (r.ok) haptic('success');
        }}
        style={({ pressed }) => ({
          width: '23%',
          flexGrow: 1,
          alignItems: 'center',
          gap: 4,
          paddingVertical: 10,
          paddingHorizontal: 4,
          borderRadius: 14,
          borderWidth: 1,
          borderColor: owned ? alpha(colors.gold, 0.5) : ready ? alpha(colors.accent, 0.6) : colors.border,
          backgroundColor: pressed ? alpha(tone, 0.14) : owned ? alpha(colors.gold, 0.08) : colors.card,
        })}
      >
        <View style={{ width: 34, height: 34, borderRadius: 17, alignItems: 'center', justifyContent: 'center', backgroundColor: alpha(tone, 0.16) }}>
          <Icon name={(owned || ready ? m.icon : 'lock-closed') as IconName} size={16} color={tone} />
        </View>
        <Text style={{ fontFamily: fonts.semibold, fontSize: 11, color: owned || ready ? colors.text : colors.muted, textAlign: 'center' }} numberOfLines={2}>
          {m.label}
        </Text>
        <Text style={{ fontFamily: fonts.bold, fontSize: 10.5, color: tone }}>{owned ? 'Learned' : training ? `${c.moveTraining?.weeksLeft} wk left` : `${formatMoney(fee)}, ${moveWeeks(m)} wk`}</Text>
      </Pressable>
    );
  };

  return (
    <>
      <Card>
        <Row style={{ justifyContent: 'space-between' }}>
          <View style={{ flex: 1 }}>
            <Text style={{ fontFamily: fonts.display, fontSize: 20, color: colors.text }}>Skill moves</Text>
          </View>
          <View style={{ alignItems: 'flex-end' }}>
            <Text style={{ fontFamily: fonts.semibold, fontSize: 11, color: colors.muted, letterSpacing: 1.2 }}>MONEY</Text>
            <Text style={{ fontFamily: fonts.display, fontSize: 28, color: colors.gold }}>{formatMoney(c.money)}</Text>
          </View>
        </Row>
      </Card>
      <SectionLabel icon="flash-outline">Dribble moves</SectionLabel>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>{SKILL_MOVES.filter((m) => m.kind === 'dribble').map(tile)}</View>
      <SectionLabel icon="football-outline">Finishing</SectionLabel>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>{SKILL_MOVES.filter((m) => m.kind === 'finish').map(tile)}</View>
    </>
  );
}
