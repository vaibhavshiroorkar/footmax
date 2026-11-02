import React from 'react';
import { Pressable, Text, View } from 'react-native';
import { useGame, useStore } from '../state/store';
import { AnimatedNumber, Card, Icon, IconName, Row, SectionLabel, T, haptic } from './kit';
import { alpha, colors, fonts } from './theme';
import { SKILL_MOVES, SkillMove, canLearnMove, hasMove, moveCost } from '../engine/skills';
import { learnMove } from '../engine/career';

// Skill moves: small icon tiles, unlocked with skill points. Dribble moves
// can be picked in a dribble moment; finishing moves help the shots they suit.
export function MovesBody() {
  const game = useGame();
  const mutate = useStore((s) => s.mutate);
  const showToast = useStore((s) => s.showToast);
  const celebrate = useStore((s) => s.celebrate);
  if (!game?.career) return null;
  const c = game.career;
  const p = game.world.players[c.playerId];

  const tile = (m: SkillMove) => {
    const owned = hasMove(p, m.id);
    const check = canLearnMove(p, m.id, c.skillPoints);
    const ready = !owned && check.ok;
    const tone = owned ? colors.gold : ready ? colors.accent : colors.faint;
    return (
      <Pressable
        key={m.id}
        accessibilityRole="button"
        accessibilityLabel={`${m.label}, ${owned ? 'learned' : ready ? `learn for ${moveCost(m)} points` : check.reason}`}
        onPress={() => {
          if (owned) return showToast(`${m.label}: ${m.description}`);
          if (!ready) return showToast(check.reason ?? 'Locked.');
          const r = mutate((g) => learnMove(g, m.id));
          if (!r.ok) return showToast(r.text);
          haptic('success');
          celebrate({ title: m.label, sub: `New skill move. ${m.description}`, icon: m.icon as IconName, duration: 2000 });
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
        <Text style={{ fontFamily: fonts.bold, fontSize: 10.5, color: tone }}>{owned ? 'Learned' : `${moveCost(m)} pt${moveCost(m) > 1 ? 's' : ''}`}</Text>
      </Pressable>
    );
  };

  return (
    <>
      <Card>
        <Row style={{ justifyContent: 'space-between' }}>
          <View style={{ flex: 1 }}>
            <Text style={{ fontFamily: fonts.display, fontSize: 20, color: colors.text }}>Skill moves</Text>
            <T muted style={{ fontSize: 12 }}>
              Learn tricks with skill points. Use a dribble move when you take your man on.
            </T>
          </View>
          <View style={{ alignItems: 'flex-end' }}>
            <Text style={{ fontFamily: fonts.semibold, fontSize: 11, color: colors.muted, letterSpacing: 1.2 }}>POINTS</Text>
            <AnimatedNumber value={c.skillPoints} style={{ fontFamily: fonts.display, fontSize: 32, color: c.skillPoints ? colors.accent : colors.faint }} />
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
