import React, { useEffect, useState } from 'react';
import { Animated, Text, View } from 'react-native';
import { Redirect } from 'expo-router';
import { useGame, useStore } from '../../state/store';
import { AnimatedNumber, Button, Card, FadeIn, Icon, IconName, Pill, Row, Screen, StatBar, Sticker, T } from '../../ui/kit';
import { GameFor } from '../../ui/training/games';
import { colors, fonts, ratingColor } from '../../ui/theme';
import { drillsFor, train, trainingGain } from '../../engine/career';
import { ATTR_LABELS, overall } from '../../engine/player';
import { AttrKey } from '../../engine/types';

const LOOK: Record<string, { icon: IconName; color: string; game: string }> = {
  finishing: { icon: 'football', color: colors.red, game: 'Target practice' },
  speed: { icon: 'flash', color: colors.gold, game: 'Sprint race' },
  playmaking: { icon: 'git-branch', color: colors.accent, game: 'Timing passes' },
  technique: { icon: 'sparkles', color: colors.purple, game: 'Skill combo' },
  defending: { icon: 'shield', color: colors.blue, game: 'Reaction blocks' },
  keeping: { icon: 'hand-left', color: colors.orange, game: 'Reflex saves' },
};

interface Result {
  drill: string;
  score: number;
  before: Partial<Record<AttrKey, number>>;
  gains: Partial<Record<AttrKey, number>>;
  ovrBefore: number;
  ovrAfter: number;
}

function Stars({ score }: { score: number }) {
  const n = score >= 0.8 ? 3 : score >= 0.5 ? 2 : 1;
  const [pops] = useState(() => [0, 1, 2].map(() => new Animated.Value(0)));
  useEffect(() => {
    Animated.stagger(
      180,
      pops.map((v) => Animated.spring(v, { toValue: 1, useNativeDriver: false, friction: 4 })),
    ).start();
  }, [pops]);
  return (
    <Row gap={8} style={{ justifyContent: 'center' }}>
      {pops.map((v, i) => (
        <Animated.View key={i} style={{ transform: [{ scale: v }, { rotate: v.interpolate({ inputRange: [0, 1], outputRange: ['-90deg', '0deg'] }) }] }}>
          <Icon name={i < n ? 'star' : 'star-outline'} size={i === 1 ? 52 : 42} color={i < n ? colors.gold : colors.faint} />
        </Animated.View>
      ))}
    </Row>
  );
}

export default function Train() {
  const game = useGame();
  const mutate = useStore((s) => s.mutate);
  const [playing, setPlaying] = useState<string | null>(null);
  const [result, setResult] = useState<Result | null>(null);
  if (!game?.career) return <Redirect href="/" />;
  const c = game.career;
  const p = game.world.players[c.playerId];
  const drills = drillsFor(p);
  const gain = trainingGain(p, c.items.includes('trainer'));
  const nearCap = overall(p) >= p.potential - 1;

  const run = (drillId: string, score: number) => {
    const d = drills.find((x) => x.id === drillId)!;
    const before: Partial<Record<AttrKey, number>> = {};
    for (const k of d.attrs) before[k] = p.attrs[k];
    const ovrBefore = overall(p);
    const r = mutate((g) => train(g, drillId, score));
    setPlaying(null);
    if (r.ok) setResult({ drill: drillId, score, before, gains: r.gains ?? {}, ovrBefore, ovrAfter: overall(p) });
  };

  return (
    <Screen title="Training" nav="career">
      <Card>
        <Row gap={10}>
          <Sticker icon="battery-charging" color={colors.blue} size={38} />
          <View style={{ flex: 1 }}>
            <StatBar label="Energy" value={c.energy} color={colors.blue} />
          </View>
        </Row>
        <Row gap={10}>
          <Sticker icon="pulse" color={p.fitness < 50 ? colors.red : colors.accent} size={38} />
          <View style={{ flex: 1 }}>
            <StatBar label="Fitness" value={p.fitness} color={p.fitness < 50 ? colors.red : colors.accent} />
          </View>
        </Row>
        <T muted style={{ fontSize: 12.5 }}>
          Each drill costs 25 energy. Play the mini-game for up to 1.5x gains, or quick-train for a steady 0.9x. Tired legs (under 45 fitness) risk injury.
          {nearCap ? ' You are near your ceiling, so gains are small now.' : ''}
        </T>
      </Card>

      {playing && (
        <FadeIn>
          <Card glow={LOOK[playing].color}>
            <Row gap={10}>
              <Sticker icon={LOOK[playing].icon} color={LOOK[playing].color} />
              <Text style={{ fontFamily: fonts.display, fontSize: 22, color: colors.text, flex: 1 }}>{LOOK[playing].game}</Text>
              <Button label="Quit" small variant="ghost" onPress={() => setPlaying(null)} />
            </Row>
            <GameFor drill={playing} onDone={(score) => run(playing, score)} />
          </Card>
        </FadeIn>
      )}

      {result && !playing && (
        <FadeIn>
          <Card glow={colors.gold}>
            <Stars score={result.score} />
            <Text style={{ fontFamily: fonts.display, fontSize: 24, color: colors.text, textAlign: 'center' }}>
              {result.score >= 0.8 ? 'Brilliant session!' : result.score >= 0.5 ? 'Good work!' : 'Keep at it!'}
            </Text>
            {Object.entries(result.gains).map(([k, g]) => {
              const key = k as AttrKey;
              const before = result.before[key] ?? 0;
              return (
                <View key={k} style={{ gap: 2 }}>
                  <Row style={{ justifyContent: 'space-between' }}>
                    <Text style={{ fontFamily: fonts.medium, color: colors.muted }}>{ATTR_LABELS[key]}</Text>
                    <Row gap={6}>
                      <AnimatedNumber value={before + (g ?? 0)} format={(n) => n.toFixed(1)} style={{ fontFamily: fonts.display, fontSize: 18, color: colors.text }} />
                      <Pill label={`+${(g ?? 0).toFixed(2)}`} color={colors.accent} solid />
                    </Row>
                  </Row>
                  <StatBar label="" value={before + (g ?? 0)} max={99} color={ratingColor(before)} right=" " />
                </View>
              );
            })}
            {result.ovrAfter > result.ovrBefore && (
              <Row gap={8} style={{ justifyContent: 'center' }}>
                <Icon name="trending-up" size={22} color={colors.accent} />
                <Text style={{ fontFamily: fonts.display, fontSize: 20, color: colors.accentDark }}>
                  Overall {result.ovrBefore} {'->'} {result.ovrAfter}!
                </Text>
              </Row>
            )}
            <Button label="Nice" small variant="secondary" onPress={() => setResult(null)} />
          </Card>
        </FadeIn>
      )}

      {!playing &&
        drills.map((d, i) => {
          const look = LOOK[d.id];
          const disabled = c.energy < d.energy || p.injuryWeeks > 0;
          return (
            <FadeIn key={d.id} index={i}>
              <Card>
                <Row gap={12}>
                  <Sticker icon={look.icon} color={look.color} size={46} />
                  <View style={{ flex: 1 }}>
                    <Text style={{ fontFamily: fonts.display, fontSize: 20, color: colors.text }}>{d.label}</Text>
                    <T muted style={{ fontSize: 12 }}>
                      Mini-game: {look.game}  |  ~+{gain.toFixed(2)} each
                    </T>
                  </View>
                </Row>
                {d.attrs.map((k) => (
                  <StatBar key={k} label={ATTR_LABELS[k]} value={p.attrs[k]} max={99} color={look.color} right={p.attrs[k].toFixed(1)} />
                ))}
                <Row>
                  <Button label="Play" icon="game-controller" sub="Up to 1.5x" style={{ flex: 2 }} disabled={disabled} onPress={() => { setResult(null); setPlaying(d.id); }} />
                  <Button label="Quick" icon="flash" sub="0.9x" variant="secondary" style={{ flex: 1 }} disabled={disabled} onPress={() => run(d.id, 0.35)} />
                </Row>
              </Card>
            </FadeIn>
          );
        })}
    </Screen>
  );
}
