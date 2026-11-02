import React, { useEffect, useState } from 'react';
import { Animated, Modal, Platform, Pressable, ScrollView, Text, View } from 'react-native';
import { Redirect, useRouter } from 'expo-router';
import { useGame, useStore } from '../../state/store';
import { Button, Card, Icon, IconName, Row, Screen, StatBar, Sticker, T } from '../../ui/kit';
import { GameFor } from '../../ui/training/games';
import { AttrRow } from '../../ui/attributes';
import { alpha, colors, fonts } from '../../ui/theme';
import { drillsFor, train, trainingGain } from '../../engine/career';
import { ATTR_LABELS, overall, weightsFor } from '../../engine/player';
import { AttrKey } from '../../engine/types';
import { motionReduced } from '../../state/settings';

const NATIVE = Platform.OS !== 'web';

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
  after: Partial<Record<AttrKey, number>>;
  ovrBefore: number;
  ovrAfter: number;
  xp: number;
}

function Stars({ score }: { score: number }) {
  const n = score >= 0.8 ? 3 : score >= 0.5 ? 2 : 1;
  const [pops] = useState(() => [0, 1, 2].map(() => new Animated.Value(0)));
  useEffect(() => {
    if (motionReduced()) return pops.forEach((v) => v.setValue(1));
    Animated.stagger(
      180,
      pops.map((v) => Animated.spring(v, { toValue: 1, useNativeDriver: NATIVE, friction: 4 })),
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

// The session's result. The rows mount at the old values and move to the
// new ones a beat later, so every point gained pops in front of you.
function ResultView({ r, onClose }: { r: Result; onClose: () => void }) {
  const [landed, setLanded] = useState(false);
  useEffect(() => {
    const t = setTimeout(() => setLanded(true), 450);
    return () => clearTimeout(t);
  }, []);
  const keys = Object.keys(r.after) as AttrKey[];
  const gainedPoints = keys.reduce((n, k) => n + Math.floor((r.after[k] ?? 0) + 1e-6) - Math.floor((r.before[k] ?? 0) + 1e-6), 0);
  return (
    <View style={{ gap: 12 }}>
      <Stars score={r.score} />
      <Text style={{ fontFamily: fonts.display, fontSize: 26, color: colors.text, textAlign: 'center', letterSpacing: 0.5 }}>
        {r.score >= 0.8 ? 'Brilliant session!' : r.score >= 0.5 ? 'Good work!' : 'Keep at it!'}
      </Text>
      <View>
        {keys.map((k) => (
          <AttrRow key={k} k={k} value={(landed ? r.after[k] : r.before[k]) ?? 0} keyAttr />
        ))}
      </View>
      <Row gap={8} style={{ justifyContent: 'center', flexWrap: 'wrap' }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 12, paddingVertical: 6, borderRadius: 12, backgroundColor: alpha(colors.gold, 0.12) }}>
          <Icon name="sparkles" size={15} color={colors.gold} />
          <Text style={{ fontFamily: fonts.bold, fontSize: 14, color: colors.gold }}>+{r.xp} XP</Text>
        </View>
        {gainedPoints > 0 && (
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 12, paddingVertical: 6, borderRadius: 12, backgroundColor: alpha(colors.accent, 0.14) }}>
            <Icon name="arrow-up" size={15} color={colors.accent} />
            <Text style={{ fontFamily: fonts.bold, fontSize: 14, color: colors.accent }}>
              +{gainedPoints} point{gainedPoints > 1 ? 's' : ''}
            </Text>
          </View>
        )}
      </Row>
      <View style={{ height: 30, justifyContent: 'center' }}>
        {r.ovrAfter > r.ovrBefore && (
          <Row gap={8} style={{ justifyContent: 'center' }}>
            <Icon name="trending-up" size={22} color={colors.accent} />
            <Text style={{ fontFamily: fonts.display, fontSize: 22, color: colors.accent }}>
              Overall {r.ovrBefore} {'->'} {r.ovrAfter}!
            </Text>
          </Row>
        )}
      </View>
      <Button label="Nice" icon="checkmark" onPress={onClose} />
    </View>
  );
}

export default function Train() {
  const game = useGame();
  const router = useRouter();
  const mutate = useStore((s) => s.mutate);
  const [playing, setPlaying] = useState<string | null>(null);
  const [result, setResult] = useState<Result | null>(null);
  // While the overlay is open the cards keep the old numbers; they move
  // when it closes, so the gains land where you can see them.
  const [frozen, setFrozen] = useState<Partial<Record<AttrKey, number>> | null>(null);
  const [last, setLast] = useState<string>('');
  if (!game?.career) return <Redirect href="/" />;
  const c = game.career;
  const p = game.world.players[c.playerId];
  const drills = drillsFor(p);
  const gain = trainingGain(p, c.items.includes('trainer'));
  const nearCap = overall(p) >= p.potential - 1;
  const w = weightsFor(p);
  const sessionsLeft = Math.floor(c.energy / (drills[0]?.energy ?? 40));

  const run = (drillId: string, score: number, overlay: boolean) => {
    const d = drills.find((x) => x.id === drillId)!;
    const before: Partial<Record<AttrKey, number>> = {};
    for (const k of d.attrs) before[k] = p.attrs[k];
    const ovrBefore = overall(p);
    const r = mutate((g) => train(g, drillId, score));
    setPlaying(null);
    if (!r.ok) {
      useStore.getState().showToast(r.text);
      setFrozen(null);
      return;
    }
    const after: Partial<Record<AttrKey, number>> = {};
    for (const k of d.attrs) after[k] = p.attrs[k];
    const xp = r.xp ?? 0;
    const res = { drill: drillId, score, before, after, ovrBefore, ovrAfter: overall(p), xp };
    if (overlay) setResult(res);
    setLast(`${LOOK[drillId].game}: ${d.attrs.map((k) => `${ATTR_LABELS[k]} +${((after[k] ?? 0) - (before[k] ?? 0)).toFixed(2)}`).join(', ')}, +${res.xp} XP`);
  };

  const start = (drillId: string) => {
    const d = drills.find((x) => x.id === drillId)!;
    const snap: Partial<Record<AttrKey, number>> = {};
    for (const k of d.attrs) snap[k] = p.attrs[k];
    setFrozen(snap);
    setResult(null);
    setPlaying(drillId);
  };
  const close = () => {
    setResult(null);
    setPlaying(null);
    setFrozen(null);
  };

  return (
    <Screen title="Training" nav="career">
      <Card>
        <Row gap={10}>
          <Sticker icon="battery-charging" color={colors.blue} size={38} />
          <View style={{ flex: 1 }}>
            <StatBar label={`Energy  |  ${sessionsLeft} session${sessionsLeft === 1 ? '' : 's'} left this week`} value={c.energy} color={colors.blue} />
          </View>
        </Row>
        <Row gap={10}>
          <Sticker icon="pulse" color={p.fitness < 50 ? colors.red : colors.accent} size={38} />
          <View style={{ flex: 1 }}>
            <StatBar label="Fitness" value={p.fitness} color={p.fitness < 50 ? colors.red : colors.accent} />
          </View>
        </Row>
        <T muted style={{ fontSize: 12.5 }}>
          Two big sessions a week. Play the mini-game for up to 1.5x gains, or quick-train for 0.9x. The gold bar fills toward your next point.
          {nearCap ? ' You are near your ceiling, so gains are small now.' : ''}
        </T>
        <View style={{ height: 18, justifyContent: 'center' }}>
          <Text numberOfLines={1} style={{ fontFamily: fonts.medium, fontSize: 12, color: colors.accent }}>
            {last}
          </Text>
        </View>
      </Card>

      {drills.map((d) => {
        const look = LOOK[d.id];
        const disabled = c.energy < d.energy || p.injuryWeeks > 0;
        return (
          <Card key={d.id}>
            <Row gap={12}>
              <Sticker icon={look.icon} color={look.color} size={46} />
              <View style={{ flex: 1 }}>
                <Text style={{ fontFamily: fonts.display, fontSize: 20, color: colors.text }}>{d.label}</Text>
                <T muted style={{ fontSize: 12 }}>
                  {look.game}  |  about +{(gain * 1.5).toFixed(1)} a session at best
                </T>
              </View>
            </Row>
            <View>
              {d.attrs.map((k) => (
                <AttrRow key={k} k={k} value={frozen?.[k] ?? p.attrs[k]} keyAttr={(w[k] ?? 0) >= 0.15} />
              ))}
            </View>
            <Row>
              <Button label="Play" icon="game-controller" sub="Up to 1.5x" style={{ flex: 2 }} disabled={disabled} onPress={() => start(d.id)} />
              <Button label="Quick" icon="flash" sub="0.9x" variant="secondary" style={{ flex: 1 }} disabled={disabled} onPress={() => run(d.id, 0.35, false)} />
            </Row>
          </Card>
        );
      })}

      {sessionsLeft === 0 && (
        <Button label="Training done. Back to the hub" icon="home" variant="secondary" onPress={() => router.replace('/career')} />
      )}

      <Modal visible={!!playing || !!result} transparent animationType="fade" onRequestClose={close}>
        <Pressable style={{ flex: 1, backgroundColor: 'rgba(5,8,14,0.82)', justifyContent: 'center', padding: 16 }} onPress={() => result && close()}>
          <Pressable style={{ maxWidth: 520, width: '100%', alignSelf: 'center' }} onPress={() => undefined}>
            <ScrollView contentContainerStyle={{ flexGrow: 1 }} style={{ maxHeight: '100%' }}>
              <View style={{ backgroundColor: colors.card, borderRadius: 24, borderWidth: 1, borderColor: alpha(playing ? LOOK[playing].color : colors.gold, 0.5), padding: 16, gap: 12 }}>
                {playing && (
                  <>
                    <Row gap={10}>
                      <Sticker icon={LOOK[playing].icon} color={LOOK[playing].color} />
                      <Text style={{ fontFamily: fonts.display, fontSize: 22, color: colors.text, flex: 1 }}>{LOOK[playing].game}</Text>
                      <Button label="Quit" small variant="ghost" onPress={close} />
                    </Row>
                    <GameFor drill={playing} onDone={(score) => run(playing, score, true)} />
                  </>
                )}
                {result && !playing && <ResultView r={result} onClose={close} />}
              </View>
            </ScrollView>
          </Pressable>
        </Pressable>
      </Modal>
    </Screen>
  );
}
