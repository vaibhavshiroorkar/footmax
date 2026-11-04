import React, { useEffect, useState } from 'react';
import { Animated, Modal, Platform, Pressable, ScrollView, Text, View } from 'react-native';
import { Redirect, useLocalSearchParams } from 'expo-router';
import { SkillsBody } from './skills';
import { useGame, useStore } from '../../state/store';
import { Button, Card, Icon, IconName, PLAYER_RING, RatingRing, Row, Screen, StatBar, Sticker, T, Tabs } from '../../ui/kit';
import { readyMoves, upgradeCount } from '../../engine/alerts';
import { GameFor } from '../../ui/training/games';
import { AttrRow, AttributeGrid } from '../../ui/attributes';
import { MovesBody } from '../../ui/skillMoves';
import { alpha, colors, fonts } from '../../ui/theme';
import { drillsFor, lifeAction, train } from '../../engine/career';
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

type Tab = 'train' | 'abilities' | 'moves';

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
  const mutate = useStore((s) => s.mutate);
  const [playing, setPlaying] = useState<string | null>(null);
  const [result, setResult] = useState<Result | null>(null);
  // While the overlay is open the cards keep the old numbers; they move
  // when it closes, so the gains land where you can see them.
  const [frozen, setFrozen] = useState<Partial<Record<AttrKey, number>> | null>(null);
  // Results show as a toast at the top, so the drill tiles never move.
  const setLast = useStore((st) => st.showToast);
  const params = useLocalSearchParams<{ tab?: string }>();
  const [tab, setTab] = useState<Tab>(params.tab === 'skills' || params.tab === 'abilities' ? 'abilities' : params.tab === 'moves' ? 'moves' : 'train');
  if (!game?.career) return <Redirect href="/" />;
  const upgrades = upgradeCount(game);
  const c = game.career;
  const p = game.world.players[c.playerId];
  const drills = drillsFor(p);
  const nearCap = overall(p) >= p.potential - 1;
  const w = weightsFor(p);

  // score: the mini-game's result, or nothing for a quick session.
  const run = (drillId: string, score: number | undefined, overlay: boolean) => {
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
    const res = { drill: drillId, score: score ?? 0, before, after, ovrBefore, ovrAfter: overall(p), xp };
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

  const shown = { ...p.attrs, ...(frozen ?? {}) };
  const moves = readyMoves(game).length;
  const abilities = upgrades - Math.min(upgrades, moves);
  return (
    <Screen title="Train" nav="career">
      {/* Every attribute first, always in the same place. */}
      <Card>
        <Row style={{ justifyContent: 'space-between' }}>
          <View>
            <Text style={{ fontFamily: fonts.display, fontSize: 20, color: colors.text }}>Your attributes</Text>
            {nearCap ? (
              <T muted style={{ fontSize: 12 }}>
                Near your ceiling
              </T>
            ) : null}
          </View>
          <RatingRing value={overall(p)} size={PLAYER_RING} />
        </Row>
        <AttributeGrid attrs={shown} keeper={p.position === 'GK'} weights={w} />
        <Row gap={18}>
          <View style={{ flex: 1 }}>
            <StatBar label="Energy" value={c.energy} color={colors.blue} right={`${Math.round(c.energy)}/100`} />
          </View>
          <View style={{ flex: 1 }}>
            <StatBar label="Fitness" value={p.fitness} color={p.fitness < 50 ? colors.red : colors.green} />
          </View>
        </Row>
      </Card>

      <Tabs<Tab>
        tabs={[
          { key: 'train', label: 'Training' },
          { key: 'abilities', label: abilities ? `Abilities (${abilities})` : 'Abilities' },
          { key: 'moves', label: moves ? `Moves (${moves})` : 'Moves' },
        ]}
        value={tab}
        onChange={setTab}
      />
      {tab === 'abilities' && <SkillsBody />}
      {tab === 'moves' && <MovesBody />}
      {tab === 'train' && (
        <>
          {/* Drills as compact tiles, two to a row. */}
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10 }}>
            {drills.map((d) => {
              const look = LOOK[d.id];
              const disabled = c.energy < d.energy || p.injuryWeeks > 0;
              return (
                <View key={d.id} style={{ flexBasis: '47%', flexGrow: 1, padding: 12, gap: 8, borderRadius: 12, borderWidth: 1.5, borderColor: colors.border, backgroundColor: colors.card, opacity: disabled ? 0.55 : 1 }}>
                  <Row gap={10}>
                    <Sticker icon={look.icon} color={look.color} size={36} />
                    <View style={{ flex: 1 }}>
                      <Text style={{ fontFamily: fonts.display, fontSize: 17, color: colors.text, lineHeight: 19 }} numberOfLines={2}>
                        {d.label}
                      </Text>
                      <Text style={{ fontFamily: fonts.medium, fontSize: 11.5, color: colors.muted }} numberOfLines={1}>
                        {d.attrs.map((k) => ATTR_LABELS[k]).join(' + ')}
                      </Text>
                    </View>
                  </Row>
                  <Row gap={6}>
                    <Button label="Play" icon="game-controller" small style={{ flex: 3 }} disabled={disabled} onPress={() => start(d.id)} />
                    <Button label="Quick" small variant="secondary" style={{ flex: 2 }} disabled={disabled} onPress={() => run(d.id, undefined, false)} />
                  </Row>
                </View>
              );
            })}
            {/* Rest sits in the grid: fitness back, for some energy. */}
            <View style={{ flexBasis: '47%', flexGrow: 1, padding: 12, gap: 8, borderRadius: 12, borderWidth: 1.5, borderColor: colors.border, backgroundColor: colors.card }}>
              <Row gap={10}>
                <Sticker icon="bed" color={colors.teal} size={36} />
                <View style={{ flex: 1 }}>
                  <Text style={{ fontFamily: fonts.display, fontSize: 17, color: colors.text, lineHeight: 19 }} numberOfLines={2}>
                    Rest day
                  </Text>
                  <Text style={{ fontFamily: fonts.medium, fontSize: 11.5, color: colors.muted }} numberOfLines={1}>
                    +20 fitness, 15 energy
                  </Text>
                </View>
              </Row>
              <Button
                label="Rest"
                small
                variant="secondary"
                disabled={c.energy < 15 || p.fitness >= 100}
                onPress={() => {
                  const r = mutate((g) => lifeAction(g, 'rest'));
                  setLast(r.text);
                }}
              />
            </View>
          </View>
        </>
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
