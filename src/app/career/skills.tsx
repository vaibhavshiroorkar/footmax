import React, { useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { Redirect } from 'expo-router';
import { useGame, useStore } from '../../state/store';
import { AnimatedNumber, Button, Card, Icon, IconName, Pill, Row, SectionLabel, StatBar, T, haptic } from '../../ui/kit';
import { SKILLS, xpForLevel } from '../../engine/skills';
import { learnSecondary, unlockNode } from '../../engine/career';
import { TreeNode, canUnlock, nodeCost, nodeLabel, nodeNeeds, nodeOwned, nodeState, readyNodes, techniqueById, treeFor } from '../../engine/skillTree';
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

const TECH_ICONS: Record<string, IconName> = { fakeshot: 'swap-horizontal', curler: 'color-wand', splitter: 'git-network', lastditch: 'shield-half', sweeper: 'hand-right' };

const nodeIcon = (n: TreeNode): IconName => (n.kind === 'tech' ? TECH_ICONS[n.tech] ?? 'star' : SKILL_ICONS[n.skill] ?? 'star');

function describe(n: TreeNode): string {
  if (n.kind === 'tech') return techniqueById(n.tech)?.description ?? '';
  return SKILLS.find((d) => d.id === n.skill)?.description ?? '';
}

// The tree: three branches side by side, each a chain of nodes joined by a
// line. Tapping a node shows it in the panel underneath, which keeps its
// size, so nothing moves.
function SkillTree({ p, points }: { p: Player; points: number }) {
  const mutate = useStore((st) => st.mutate);
  const showToast = useStore((st) => st.showToast);
  const celebrate = useStore((st) => st.celebrate);
  const branches = treeFor(p);
  const [sel, setSel] = useState<{ b: string; i: number }>(() => {
    const first = readyNodes(p, points)[0];
    return first ? { b: first.branch.id, i: first.index } : { b: branches[0].id, i: 0 };
  });
  const branch = branches.find((b) => b.id === sel.b) ?? branches[0];
  const index = Math.min(sel.i, branch.nodes.length - 1);
  const node = branch.nodes[index];
  const state = nodeState(p, branch, index, points);
  const needs = nodeNeeds(node);
  const check = canUnlock(p, node, points);
  return (
    <>
      <Card>
        <Row style={{ alignItems: 'flex-start' }} gap={6}>
          {branches.map((b) => (
            <View key={b.id} style={{ flex: 1, minWidth: 0, alignItems: 'center' }}>
              <Text style={{ fontFamily: fonts.display, fontSize: 15, letterSpacing: 0.6, color: colors.text, textTransform: 'uppercase', marginBottom: 6 }} numberOfLines={1}>
                {b.label}
              </Text>
              {b.nodes.map((n, i) => {
                const st = nodeState(p, b, i, points);
                const on = branch.id === b.id && index === i;
                const tone = st === 'owned' ? colors.gold : st === 'ready' ? colors.accent : st === 'next' ? colors.muted : colors.faint;
                return (
                  <View key={i} style={{ alignItems: 'center', width: '100%' }}>
                    {i > 0 && <View style={{ width: 3, height: 12, backgroundColor: nodeOwned(p, b.nodes[i - 1]) ? colors.gold : colors.border }} />}
                    <Pressable
                      onPress={() => {
                        haptic();
                        setSel({ b: b.id, i });
                      }}
                      accessibilityRole="button"
                      accessibilityLabel={`${nodeLabel(n)}, ${st}`}
                      style={{ alignItems: 'center', width: '100%' }}
                    >
                      <View style={{ width: 44, height: 44, borderRadius: n.kind === 'tech' ? 12 : 22, alignItems: 'center', justifyContent: 'center', backgroundColor: st === 'owned' ? alpha(colors.gold, 0.22) : st === 'ready' ? alpha(colors.accent, 0.16) : colors.bgElev, borderWidth: on ? 3 : 2, borderColor: on ? colors.text : tone }}>
                        <Icon name={st === 'locked' ? 'lock-closed' : nodeIcon(n)} size={19} color={tone} />
                      </View>
                      <Text style={{ fontFamily: fonts.semibold, fontSize: 10, lineHeight: 12, height: 24, marginTop: 3, color: st === 'locked' ? colors.faint : colors.text, textAlign: 'center' }} numberOfLines={2}>
                        {nodeLabel(n)}
                      </Text>
                    </Pressable>
                  </View>
                );
              })}
            </View>
          ))}
        </Row>
      </Card>
      {/* The chosen node: a fixed-size panel, so picking one moves nothing. */}
      <Card glow={state === 'ready' ? colors.accent : undefined} style={{ minHeight: 172 }}>
        <Row gap={12}>
          <View style={{ width: 44, height: 44, borderRadius: 13, backgroundColor: alpha(state === 'owned' ? colors.gold : colors.accent, 0.14), alignItems: 'center', justifyContent: 'center' }}>
            <Icon name={nodeIcon(node)} size={21} color={state === 'owned' ? colors.gold : colors.accent} />
          </View>
          <View style={{ flex: 1, gap: 2 }}>
            <Text style={{ fontFamily: fonts.display, fontSize: 19, color: colors.text, letterSpacing: 0.3 }} numberOfLines={1}>
              {nodeLabel(node)}
              {node.kind === 'tech' ? '  (technique)' : ''}
            </Text>
            <Text style={{ fontFamily: fonts.body, fontSize: 12.5, color: colors.muted, lineHeight: 17, height: 51 }} numberOfLines={3}>
              {describe(node)}
            </Text>
          </View>
        </Row>
        <Row gap={8}>
          <Pill label={`${ATTR_LABELS[needs.attr]} ${needs.value}`} icon="barbell" color={p.attrs[needs.attr] >= needs.value ? colors.green : colors.red} />
          <Pill label={`${nodeCost(node)} pt${nodeCost(node) > 1 ? 's' : ''}`} icon="sparkles" color={points >= nodeCost(node) ? colors.accent : colors.muted} />
        </Row>
        {state === 'owned' ? (
          <Pill label="Yours" icon="checkmark-circle" color={colors.gold} />
        ) : (
          <Button
            label={state === 'locked' ? 'Unlock the one above first' : check.ok ? 'Unlock' : check.reason ?? 'Locked'}
            icon={check.ok && state !== 'locked' ? 'arrow-up-circle' : 'lock-closed'}
            small
            disabled={!check.ok || state === 'locked'}
            onPress={() => {
              const r = mutate((g) => unlockNode(g, branch.id, index));
              if (!r.ok) return showToast(r.text);
              haptic('success');
              celebrate({ title: nodeLabel(node), sub: describe(node), icon: nodeIcon(node), duration: 2200 });
            }}
          />
        )}
      </Card>
    </>
  );
}

// The skills panel, shown on the Train tab next to training.
export function SkillsBody() {
  const game = useGame();
  const mutate = useStore((s) => s.mutate);
  const showToast = useStore((s) => s.showToast);
  if (!game?.career) return <Redirect href="/" />;
  const c = game.career;
  const p = game.world.players[c.playerId];
  const ready = readyNodes(p, c.skillPoints);
  const secondaryReady = canLearnSecondary(game);
  const unlocked = c.level >= SECONDARY_ROLE_LEVEL;

  return (
    <>
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

      <SectionLabel icon="git-network-outline">{ready.length ? `Skill tree  |  ${ready.length} ready` : 'Skill tree'}</SectionLabel>
      <SkillTree p={p} points={c.skillPoints} />
    </>
  );
}

// Old links to the skills screen land on the Skills half of Train.
export default function Skills() {
  return <Redirect href="/career/train?tab=skills" />;
}
