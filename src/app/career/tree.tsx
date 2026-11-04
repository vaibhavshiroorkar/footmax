import React, { useMemo, useRef, useState } from 'react';
import { Pressable, ScrollView, Text, View, useWindowDimensions } from 'react-native';
import { Redirect } from 'expo-router';
import Svg, { Line } from 'react-native-svg';
import { useGame, useStore } from '../../state/store';
import { Button, Icon, IconName, Pill, Row, Screen, haptic } from '../../ui/kit';
import { ATTR_LABELS } from '../../engine/player';
import { unlockNode } from '../../engine/career';
import { TreeNode, allNodes, canUnlock, nodeCost, nodeDescription, nodeLabel, nodeNeeds, nodeOwned, nodeState, readyNodes, techniqueById, treeFor } from '../../engine/skillTree';
import { alpha, colors, fonts } from '../../ui/theme';

const SKILL_ICONS: Record<string, IconName> = { finisher: 'football', finesse: 'color-wand', speedster: 'flash', dribbler: 'shuffle', playmaker: 'git-branch', setpiece: 'navigate', engine: 'battery-charging', wall: 'shield', leader: 'megaphone', shotstopper: 'hand-left', clutch: 'flame' };

function iconFor(n: TreeNode): IconName {
  if (n.kind === 'tech') return (techniqueById(n.tech)?.icon ?? 'star') as IconName;
  if (n.kind === 'skill') return SKILL_ICONS[n.skill] ?? 'star';
  if (n.kind === 'stat') return 'add-circle';
  if (n.kind === 'foot') return 'footsteps';
  return 'git-compare';
}

// The ability tree: a big map to drag around, a chip to jump to each branch,
// and a panel for the chosen node that keeps its size.
export default function AbilityTree() {
  const game = useGame();
  const mutate = useStore((s) => s.mutate);
  const showToast = useStore((s) => s.showToast);
  const celebrate = useStore((s) => s.celebrate);
  const [zoom, setZoom] = useState(1);
  // The map takes what the header and the node panel leave, so both stay on
  // screen whatever the phone.
  const screen = useWindowDimensions();
  const across = useRef<React.ComponentRef<typeof ScrollView>>(null);
  const down = useRef<React.ComponentRef<typeof ScrollView>>(null);
  const p = game?.career ? game.world.players[game.career.playerId] : null;
  const branches = useMemo(() => (p ? treeFor(p) : []), [p]);
  const nodes = useMemo(() => (p ? allNodes(p) : []), [p]);
  const [picked, setPicked] = useState<string | null>(null);
  if (!game?.career || !p) return <Redirect href="/" />;
  const points = game.career.skillPoints;
  const ready = readyNodes(p, points);
  const node = nodes.find((n) => n.id === picked) ?? ready[0] ?? nodes[0];
  const state = nodeState(p, node, points, nodes);
  const needs = nodeNeeds(node);
  const check = canUnlock(p, node, points, nodes);

  const cellX = 70 * zoom;
  const cellY = 96 * zoom;
  const size = 50 * zoom;
  const width = (Math.max(...nodes.map((n) => n.x)) + 2) * cellX;
  const height = (Math.max(...nodes.map((n) => n.y)) + 2) * cellY;
  const at = (n: TreeNode) => ({ x: (n.x + 0.5) * cellX, y: (n.y + 1) * cellY });
  const byId = new Map(nodes.map((n) => [n.id, n]));

  const jump = (id: string) => {
    haptic();
    const first = branches.find((b) => b.id === id)?.nodes[0];
    if (!first) return;
    across.current?.scrollTo({ x: Math.max(0, at(first).x - 170), animated: true });
    down.current?.scrollTo({ y: 0, animated: true });
    setPicked(first.id);
  };

  return (
    <Screen title="Ability tree" scroll={false}>
      <Row style={{ justifyContent: 'space-between' }}>
        <Text style={{ fontFamily: fonts.display, fontSize: 20, color: points ? colors.accent : colors.muted }}>{points} level point{points === 1 ? '' : 's'}</Text>
        <Row gap={6}>
          {[0.75, 1].map((z) => (
            <Pressable key={z} onPress={() => setZoom(z)} accessibilityRole="button" accessibilityLabel={z < 1 ? 'Zoom out' : 'Zoom in'} style={{ width: 40, height: 34, borderRadius: 9, alignItems: 'center', justifyContent: 'center', borderWidth: 1.5, borderColor: zoom === z ? colors.accent : colors.border, backgroundColor: colors.bgElev }}>
              <Icon name={z < 1 ? 'remove' : 'add'} size={18} color={zoom === z ? colors.accent : colors.muted} />
            </Pressable>
          ))}
        </Row>
      </Row>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ flexGrow: 0 }} contentContainerStyle={{ gap: 6 }}>
        {branches.map((b) => {
          const on = b.nodes.some((n) => n.id === node.id);
          const open = b.nodes.filter((n) => nodeState(p, n, points, nodes) === 'ready').length;
          return (
            <Pressable key={b.id} onPress={() => jump(b.id)} accessibilityRole="button" accessibilityLabel={b.label} style={{ flexDirection: 'row', alignItems: 'center', gap: 5, height: 36, paddingHorizontal: 10, borderRadius: 10, borderWidth: 1.5, borderColor: on ? colors.accent : colors.border, backgroundColor: on ? alpha(colors.accent, 0.14) : colors.bgElev }}>
              <Icon name={b.icon as IconName} size={14} color={on ? colors.accent : colors.muted} />
              <Text style={{ fontFamily: fonts.semibold, fontSize: 12.5, color: on ? colors.text : colors.muted }}>{b.label}</Text>
              {open > 0 && <Text style={{ fontFamily: fonts.bold, fontSize: 11, color: colors.accent }}>{open}</Text>}
            </Pressable>
          );
        })}
      </ScrollView>
      <View style={{ height: Math.max(190, screen.height - 378), borderRadius: 14, overflow: 'hidden', borderWidth: 1, borderColor: colors.border, backgroundColor: colors.bgElev }}>
        <ScrollView ref={down} showsVerticalScrollIndicator={false} nestedScrollEnabled>
          <ScrollView ref={across} horizontal showsHorizontalScrollIndicator={false} nestedScrollEnabled>
            <View style={{ width, height }}>
              <Svg width={width} height={height} style={{ position: 'absolute' }}>
                {nodes.flatMap((n) =>
                  n.parents.map((id) => {
                    const parent = byId.get(id)!;
                    const a = at(parent);
                    const b = at(n);
                    return <Line key={`${id}-${n.id}`} x1={a.x} y1={a.y} x2={b.x} y2={b.y} stroke={nodeOwned(p, parent) && nodeOwned(p, n) ? colors.gold : nodeOwned(p, parent) ? colors.accent : colors.border} strokeWidth={2.5} />;
                  }),
                )}
              </Svg>
              {branches.map((b) => (
                <Text key={b.id} style={{ position: 'absolute', left: at(b.nodes[0]).x - 70, width: 140, top: 6, textAlign: 'center', fontFamily: fonts.display, fontSize: 15 * zoom, letterSpacing: 0.6, color: colors.muted }} numberOfLines={1}>
                  {b.label.toUpperCase()}
                </Text>
              ))}
              {nodes.map((n) => {
                const s = nodeState(p, n, points, nodes);
                const on = n.id === node.id;
                const tone = s === 'owned' ? colors.gold : s === 'ready' ? colors.accent : s === 'next' ? colors.muted : colors.faint;
                const c = at(n);
                return (
                  <Pressable
                    key={n.id}
                    onPress={() => {
                      haptic();
                      setPicked(n.id);
                    }}
                    accessibilityRole="button"
                    accessibilityLabel={`${nodeLabel(n)}, ${s}`}
                    style={{ position: 'absolute', left: c.x - size / 2 - 8, top: c.y - size / 2, width: size + 16, alignItems: 'center' }}
                  >
                    <View style={{ width: size, height: size, borderRadius: n.kind === 'tech' ? 12 : size / 2, alignItems: 'center', justifyContent: 'center', backgroundColor: s === 'owned' ? alpha(colors.gold, 0.22) : s === 'ready' ? alpha(colors.accent, 0.16) : colors.card, borderWidth: on ? 3 : 2, borderColor: on ? colors.text : tone }}>
                      <Icon name={s === 'locked' ? 'lock-closed' : iconFor(n)} size={20 * zoom} color={tone} />
                    </View>
                    <Text style={{ fontFamily: fonts.semibold, fontSize: 9.5, lineHeight: 11, marginTop: 2, color: s === 'locked' ? colors.faint : colors.text, textAlign: 'center' }} numberOfLines={2}>
                      {nodeLabel(n)}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
          </ScrollView>
        </ScrollView>
      </View>
      {/* The chosen node. A fixed height, so picking one moves nothing. */}
      <View style={{ height: 158, gap: 6, padding: 12, borderRadius: 14, borderWidth: 1.5, borderColor: state === 'ready' ? colors.accent : colors.border, backgroundColor: colors.card }}>
        <Text style={{ fontFamily: fonts.display, fontSize: 19, color: colors.text }} numberOfLines={1}>
          {nodeLabel(node)}
        </Text>
        <Text style={{ fontFamily: fonts.body, fontSize: 12.5, lineHeight: 16, height: 32, color: colors.muted }} numberOfLines={2}>
          {nodeDescription(node)}
        </Text>
        <Row gap={8}>
          <Pill label={`${ATTR_LABELS[needs.attr]} ${needs.value}`} icon="barbell" color={p.attrs[needs.attr] >= needs.value ? colors.green : colors.red} />
          <Pill label={`${nodeCost(node)} point${nodeCost(node) > 1 ? 's' : ''}`} icon="sparkles" color={points >= nodeCost(node) ? colors.accent : colors.muted} />
        </Row>
        {state === 'owned' ? (
          <Pill label="Yours" icon="checkmark-circle" color={colors.gold} />
        ) : (
          <Button
            label={check.ok ? 'Unlock' : (check.reason ?? 'Locked')}
            icon={check.ok ? 'arrow-up-circle' : 'lock-closed'}
            small
            disabled={!check.ok}
            onPress={() => {
              const r = mutate((g) => unlockNode(g, node.id));
              if (!r.ok) return showToast(r.text);
              haptic('success');
              celebrate({ title: nodeLabel(node), sub: nodeDescription(node), icon: iconFor(node), duration: 2200 });
            }}
          />
        )}
      </View>
    </Screen>
  );
}
