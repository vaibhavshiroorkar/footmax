import React from 'react';
import { Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import Svg, { Circle, Polyline, Line, Text as SvgText } from 'react-native-svg';
import { MILESTONES, progressOf } from '../engine/progress';
import { ATTR_LABELS, overall } from '../engine/player';
import { AttrKey, Game } from '../engine/types';
import { AnimatedNumber, Button, Card, FadeIn, Icon, IconName, Pill, Row, StatBar, Sticker, T } from './kit';
import { alpha, colors, fonts, ratingColor } from './theme';
import { useStore } from '../state/store';

const OBJ_ICONS: Record<string, IconName> = {
  apps: 'shirt',
  goals: 'football',
  assists: 'git-branch',
  cleanSheets: 'shield-checkmark',
  tackles: 'shield',
  saves: 'hand-left',
  training: 'barbell',
  rating: 'star',
};

// compact: only the two targets closest to done, for the home screen.
export function ObjectivesCard({ game, compact }: { game: Game; compact?: boolean }) {
  const pr = progressOf(game);
  const done = pr.objectives.filter((o) => o.done).length;
  const share = (o: (typeof pr.objectives)[number]) => (o.kind === 'rating' ? (o.progress ? o.progress / o.target : 0) : o.progress / o.target);
  const shown = compact ? [...pr.objectives].filter((o) => !o.done).sort((a, b) => share(b) - share(a)).slice(0, 2) : pr.objectives;
  return (
    <Card>
      <Row style={{ justifyContent: 'space-between' }}>
        <Row gap={8}>
          <Sticker icon="flag" color={colors.orange} size={34} />
          <Text style={{ fontFamily: fonts.display, fontSize: 20, color: colors.text }}>Season goals</Text>
        </Row>
        <Pill label={`${done}/${pr.objectives.length}`} color={colors.orange} solid />
      </Row>
      {shown.map((o, i) => {
        const pct = o.kind === 'rating' ? (o.progress ? o.progress / o.target : 0) : o.progress / o.target;
        return (
          <FadeIn key={o.id} index={i}>
            <View style={{ gap: 2, opacity: o.done ? 0.65 : 1 }}>
              <Row gap={8}>
                <Icon name={o.done ? 'checkmark-circle' : OBJ_ICONS[o.kind]} size={18} color={o.done ? colors.green : colors.muted} />
                <Text style={{ flex: 1, fontFamily: fonts.medium, fontSize: 13.5, color: colors.text, textDecorationLine: o.done ? 'line-through' : 'none' }}>{o.label}</Text>
                <Pill label={`+${o.reward.xp} XP`} color={colors.purple} />
              </Row>
              {!o.done && <StatBar label="" value={Math.min(1, pct) * 100} color={colors.orange} right={o.kind === 'rating' ? (o.progress ? o.progress.toFixed(2) : '-') : `${o.progress}/${o.target}`} />}
            </View>
          </FadeIn>
        );
      })}
    </Card>
  );
}

export function MilestonesPeek({ game }: { game: Game }) {
  const router = useRouter();
  const pr = progressOf(game);
  const next = MILESTONES.filter((m) => !pr.milestones.includes(m.id)).slice(0, 3);
  // Milestones no longer pop up, so the newest one is shown here instead.
  const latest = MILESTONES.find((m) => m.id === pr.milestones[pr.milestones.length - 1]);
  return (
    <Card>
      <Row style={{ justifyContent: 'space-between' }}>
        <Row gap={8}>
          <Sticker icon="ribbon" color={colors.pink} size={34} />
          <Text style={{ fontFamily: fonts.display, fontSize: 20, color: colors.text }}>Milestones</Text>
        </Row>
        <Pill label={`${pr.milestones.length}/${MILESTONES.length}`} color={colors.pink} solid />
      </Row>
      <StatBar label="Collection" value={pr.milestones.length} max={MILESTONES.length} color={colors.pink} right={`${Math.round((100 * pr.milestones.length) / MILESTONES.length)}%`} />
      {latest && (
        <Row gap={8} style={{ backgroundColor: alpha(colors.gold, 0.08), borderRadius: 12, padding: 10, borderWidth: 1, borderColor: alpha(colors.gold, 0.25) }}>
          <Icon name={latest.icon as IconName} size={16} color={colors.gold} />
          <T style={{ flex: 1, fontSize: 13 }}>Latest: {latest.label}</T>
          <Pill label={`+${latest.xp} XP`} color={colors.gold} />
        </Row>
      )}
      {next.map((m) => (
        <Row key={m.id} gap={8}>
          <Icon name="lock-closed" size={14} color={colors.faint} />
          <T muted style={{ flex: 1, fontSize: 13 }}>
            Next: {m.label}
          </T>
          <Pill label={`+${m.xp} XP`} color={colors.purple} />
        </Row>
      ))}
      <Button label="See all milestones" icon="ribbon" small variant="secondary" onPress={() => router.push('/career/milestones')} />
    </Card>
  );
}

// Shown once at the start of a season: how much the player grew.
export function SeasonReview({ game }: { game: Game }) {
  const mutate = useStore((s) => s.mutate);
  const pr = progressOf(game);
  const r = pr.review;
  if (!r) return null;
  const deltas = (Object.keys(r.after.attrs) as AttrKey[])
    .map((k) => ({ k, d: r.after.attrs[k] - r.before.attrs[k] }))
    .filter((x) => Math.abs(x.d) >= 0.5)
    .sort((a, b) => b.d - a.d)
    .slice(0, 5);
  return (
    <FadeIn>
      <Card glow={colors.gold}>
        <Row gap={10}>
          <Sticker icon="trending-up" color={colors.gold} size={40} />
          <View style={{ flex: 1 }}>
            <Text style={{ fontFamily: fonts.display, fontSize: 22, color: colors.text }}>Season {r.season}/{String(r.season + 1).slice(2)} in review</Text>
            <T muted style={{ fontSize: 12.5 }}>Here is how much you grew.</T>
          </View>
        </Row>
        <Row style={{ justifyContent: 'center', gap: 18, paddingVertical: 6 }}>
          <View style={{ alignItems: 'center' }}>
            <Text style={{ fontFamily: fonts.display, fontSize: 40, color: colors.faint }}>{r.before.ovr}</Text>
            <T muted style={{ fontSize: 11 }}>Before</T>
          </View>
          <Icon name="arrow-forward" size={30} color={colors.accent} />
          <View style={{ alignItems: 'center' }}>
            <AnimatedNumber value={r.after.ovr} duration={1400} style={{ fontFamily: fonts.display, fontSize: 52, color: ratingColor(r.after.ovr) }} />
            <T muted style={{ fontSize: 11 }}>Now</T>
          </View>
          <Pill label={`${r.after.ovr - r.before.ovr >= 0 ? '+' : ''}${r.after.ovr - r.before.ovr}`} color={colors.accent} solid />
        </Row>
        {deltas.map((x) => (
          <Row key={x.k} style={{ justifyContent: 'space-between' }}>
            <T>{ATTR_LABELS[x.k]}</T>
            <Text style={{ fontFamily: fonts.display, fontSize: 16, color: x.d >= 0 ? colors.accentDark : colors.red }}>
              {Math.round(r.before.attrs[x.k])} {'->'} {Math.round(r.after.attrs[x.k])}
            </Text>
          </Row>
        ))}
        <Button label="Let's go!" icon="rocket" onPress={() => mutate((g) => (progressOf(g).review = undefined))} />
      </Card>
    </FadeIn>
  );
}

// Overall rating season by season, with the current value as the last point.
export function GrowthChart({ game }: { game: Game }) {
  const pr = progressOf(game);
  const p = game.world.players[game.career!.playerId];
  const pts = [...pr.ovrHistory.map((h) => h.ovr), overall(p)];
  const W = 300;
  const H = 130;
  const min = Math.max(20, Math.min(...pts) - 5);
  const max = Math.min(99, Math.max(...pts) + 5);
  const x = (i: number) => 20 + (i * (W - 40)) / Math.max(1, pts.length - 1);
  const y = (v: number) => H - 20 - ((v - min) / Math.max(1, max - min)) * (H - 40);
  return (
    <Card>
      <Row gap={8}>
        <Sticker icon="stats-chart" color={colors.teal} size={34} />
        <Text style={{ fontFamily: fonts.display, fontSize: 20, color: colors.text }}>Growth</Text>
      </Row>
      <Svg width="100%" height={H} viewBox={`0 0 ${W} ${H}`}>
        <Line x1={20} y1={H - 20} x2={W - 20} y2={H - 20} stroke={colors.border} strokeWidth={2} />
        <Polyline points={pts.map((v, i) => `${x(i)},${y(v)}`).join(' ')} fill="none" stroke={colors.teal} strokeWidth={4} strokeLinejoin="round" strokeLinecap="round" />
        {pts.map((v, i) => (
          <React.Fragment key={i}>
            <Circle cx={x(i)} cy={y(v)} r={6} fill="#fff" stroke={colors.teal} strokeWidth={3} />
            <SvgText x={x(i)} y={y(v) - 10} fontSize={12} fontFamily={fonts.display} fill={colors.text} textAnchor="middle">
              {v}
            </SvgText>
          </React.Fragment>
        ))}
      </Svg>
      <T muted style={{ fontSize: 12 }}>
        One point per season start, plus today.
      </T>
    </Card>
  );
}
