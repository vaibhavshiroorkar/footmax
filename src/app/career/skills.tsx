import React from 'react';
import { Text, View } from 'react-native';
import { Redirect } from 'expo-router';
import { useGame, useStore } from '../../state/store';
import { AnimatedNumber, Button, Card, FadeIn, Icon, IconName, Pill, Row, Screen, SectionLabel, StatBar, T, haptic } from '../../ui/kit';
import { SkillDef, canUpgrade, skillLevel, skillsFor, xpForLevel } from '../../engine/skills';
import { learnSecondary, upgradeSkill } from '../../engine/career';
import { ROLES, ROLE_NEIGHBOURS, SECONDARY_ROLE_COST, SECONDARY_ROLE_LEVEL, isRole } from '../../engine/roles';
import { ATTR_LABELS } from '../../engine/player';
import { canLearnSecondary } from '../../engine/alerts';
import { Player } from '../../engine/types';
import { alpha, colors, fonts } from '../../ui/theme';

const SKILL_ICONS: Record<string, IconName> = {
  finisher: 'football',
  finesse: 'color-wand',
  speedster: 'flash',
  dribbler: 'shuffle',
  playmaker: 'git-branch',
  setpiece: 'navigate',
  engine: 'battery-charging',
  wall: 'shield',
  leader: 'megaphone',
  shotstopper: 'hand-left',
  clutch: 'flame',
};

type State = 'ready' | 'points' | 'attr' | 'maxed';

function stateOf(p: Player, s: SkillDef, points: number): State {
  const lvl = skillLevel(p, s.id);
  if (lvl >= 3) return 'maxed';
  if (canUpgrade(p, s.id, points).ok) return 'ready';
  return p.attrs[s.attr] >= s.needs[lvl] ? 'points' : 'attr';
}

function SkillCard({ p, s, points, index }: { p: Player; s: SkillDef; points: number; index: number }) {
  const mutate = useStore((st) => st.mutate);
  const showToast = useStore((st) => st.showToast);
  const celebrate = useStore((st) => st.celebrate);
  const lvl = skillLevel(p, s.id);
  const state = stateOf(p, s, points);
  const cost = lvl + 1;
  const have = Math.round(p.attrs[s.attr]);
  const need = s.needs[Math.min(lvl, 2)];
  const tone = state === 'ready' ? colors.accent : state === 'maxed' ? colors.gold : colors.muted;
  return (
    <FadeIn index={index}>
      <View style={{ backgroundColor: colors.card, borderRadius: 20, borderWidth: 1, borderColor: state === 'ready' ? alpha(colors.accent, 0.5) : colors.border, padding: 14, gap: 10, overflow: 'hidden' }}>
        <Row gap={12}>
          <View style={{ width: 44, height: 44, borderRadius: 13, backgroundColor: alpha(lvl ? colors.gold : tone, 0.14), borderWidth: 1, borderColor: alpha(lvl ? colors.gold : tone, 0.3), alignItems: 'center', justifyContent: 'center' }}>
            <Icon name={SKILL_ICONS[s.id] ?? 'star'} size={21} color={lvl ? colors.gold : tone} />
          </View>
          <View style={{ flex: 1, gap: 2 }}>
            <Text style={{ fontFamily: fonts.display, fontSize: 19, color: colors.text, letterSpacing: 0.3 }}>{s.label}</Text>
            <Text style={{ fontFamily: fonts.body, fontSize: 12.5, color: colors.muted, lineHeight: 17 }}>{s.description}</Text>
          </View>
        </Row>
        {/* Three level pips, each with the attribute it needs. */}
        <Row gap={6}>
          {[0, 1, 2].map((i) => {
            const got = i < lvl;
            const next = i === lvl;
            return (
              <View key={i} style={{ flex: 1, gap: 4 }}>
                <View style={{ height: 6, borderRadius: 3, backgroundColor: got ? colors.gold : next && state === 'ready' ? alpha(colors.accent, 0.6) : colors.bgElev }} />
                <Text style={{ fontFamily: fonts.body, fontSize: 11.5, color: got ? colors.gold : colors.faint }}>
                  Lv {i + 1}  |  {ATTR_LABELS[s.attr]} {s.needs[i]}
                </Text>
              </View>
            );
          })}
        </Row>
        {state === 'ready' && (
          <Button
            label={`Upgrade to level ${cost}  |  ${cost} pt${cost > 1 ? 's' : ''}`}
            icon="arrow-up-circle"
            small
            onPress={() => {
              const r = mutate((g) => upgradeSkill(g, s.id));
              if (!r.ok) return showToast(r.text);
              haptic('success');
              celebrate({ title: `${s.label} ${'I'.repeat(cost)}`, sub: `Level ${cost} unlocked. ${s.description}`, icon: SKILL_ICONS[s.id] ?? 'star', duration: 2200 });
            }}
          />
        )}
        {state === 'points' && <Pill label={`Needs ${cost} skill point${cost > 1 ? 's' : ''} (you have ${points})`} icon="lock-closed" color={colors.muted} />}
        {state === 'attr' && <StatBar label={`${ATTR_LABELS[s.attr]} for level ${cost}`} value={have} max={need} color={colors.blue} right={`${have} / ${need}`} />}
        {state === 'maxed' && <Pill label="Maxed" icon="checkmark-circle" color={colors.gold} />}
      </View>
    </FadeIn>
  );
}

export default function Skills() {
  const game = useGame();
  const mutate = useStore((s) => s.mutate);
  const showToast = useStore((s) => s.showToast);
  if (!game?.career) return <Redirect href="/" />;
  const c = game.career;
  const p = game.world.players[c.playerId];
  // Skills keep one fixed order, so upgrading one never moves the others.
  const list = skillsFor(p).map((s) => ({ s, state: stateOf(p, s, c.skillPoints) }));
  const ready = list.filter((x) => x.state === 'ready');
  const secondaryReady = canLearnSecondary(game);
  const unlocked = c.level >= SECONDARY_ROLE_LEVEL;

  return (
    <Screen title="Skills" nav="career">
      <Card glow={ready.length || secondaryReady ? colors.accent : undefined}>
        <Row style={{ justifyContent: 'space-between', alignItems: 'flex-end' }}>
          <View>
            <Text style={{ fontFamily: fonts.semibold, fontSize: 11.5, color: colors.muted, letterSpacing: 1.4 }}>LEVEL</Text>
            <AnimatedNumber value={c.level} style={{ fontFamily: fonts.display, fontSize: 44, color: colors.text, lineHeight: 48 }} />
          </View>
          <View style={{ alignItems: 'flex-end' }}>
            <Text style={{ fontFamily: fonts.semibold, fontSize: 11.5, color: colors.muted, letterSpacing: 1.4 }}>SKILL POINTS</Text>
            <AnimatedNumber value={c.skillPoints} style={{ fontFamily: fonts.display, fontSize: 44, color: c.skillPoints ? colors.accent : colors.faint, lineHeight: 48 }} />
          </View>
        </Row>
        <StatBar label="XP to next level" value={c.xp} max={xpForLevel(c.level)} color={colors.accent} right={`${c.xp} / ${xpForLevel(c.level)}`} />
        <T muted style={{ fontSize: 12 }}>
          Each level gives a skill point. Level 1 of a skill costs 1 point, level 2 costs 2, level 3 costs 3. Each needs a minimum attribute, and level 1 is in reach from the start.
        </T>
      </Card>

      <Card glow={secondaryReady ? colors.accent : undefined}>
        <Row gap={10}>
          <View style={{ width: 40, height: 40, borderRadius: 12, backgroundColor: alpha(colors.teal, 0.14), alignItems: 'center', justifyContent: 'center' }}>
            <Icon name="git-compare" size={19} color={colors.teal} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={{ fontFamily: fonts.display, fontSize: 19, color: colors.text, letterSpacing: 0.3 }}>Positions</Text>
            <T muted style={{ fontSize: 12.5 }}>
              Main: {p.role && isRole(p.role) ? ROLES[p.role].label : p.position}
              {p.secondaryRole && isRole(p.secondaryRole) ? `. Second: ${ROLES[p.secondaryRole].label}` : ''}
            </T>
          </View>
        </Row>
        {!unlocked ? (
          <StatBar label={`Second position unlocks at level ${SECONDARY_ROLE_LEVEL}`} value={c.level} max={SECONDARY_ROLE_LEVEL} color={colors.teal} right={`Lv ${c.level} / ${SECONDARY_ROLE_LEVEL}`} />
        ) : p.role && isRole(p.role) && ROLE_NEIGHBOURS[p.role].length ? (
          <>
            <T muted style={{ fontSize: 12 }}>
              {p.secondaryRole ? 'Switch' : 'Learn'} a second position for {SECONDARY_ROLE_COST} skill points. The coach can then pick you there too.
            </T>
            <Row gap={6} style={{ flexWrap: 'wrap' }}>
              {ROLE_NEIGHBOURS[p.role].map((r) => (
                <Button key={r} label={r} small variant={p.secondaryRole === r ? 'primary' : 'secondary'} disabled={p.secondaryRole === r || c.skillPoints < SECONDARY_ROLE_COST} onPress={() => showToast(mutate((g) => learnSecondary(g, r)).text)} />
              ))}
            </Row>
          </>
        ) : (
          <T muted style={{ fontSize: 12 }}>
            Keepers stay between the posts.
          </T>
        )}
      </Card>

      <SectionLabel icon="sparkles-outline">{ready.length ? `Skills  |  ${ready.length} ready to upgrade` : 'Skills'}</SectionLabel>
      {list.map(({ s }, i) => (
        <SkillCard key={s.id} p={p} s={s} points={c.skillPoints} index={i} />
      ))}
    </Screen>
  );
}
