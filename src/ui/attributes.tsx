import React, { useEffect, useRef, useState } from 'react';
import { Animated, Easing, Platform, Text, View } from 'react-native';
import { AttrKey, Attributes, Player, ATTR_KEYS } from '../engine/types';
import { ATTR_LABELS, weightsFor } from '../engine/player';
import { alpha, colors, fonts, ratingColor } from './theme';
import { motionReduced } from '../state/settings';

const NATIVE = Platform.OS !== 'web';

// Attributes always show in this order, on every screen, so a number is
// always where you last saw it. Goalkeeping only shows for keepers.
export function attrOrder(isKeeper: boolean): AttrKey[] {
  return ATTR_KEYS.filter((k) => k !== 'goalkeeping' || isKeeper);
}

// Whole points, plus how far the next point has filled. Attributes grow
// in small steps underneath; the player sees them land one point at a time.
export function points(v: number): { whole: number; next: number } {
  const whole = Math.floor(v + 1e-6);
  return { whole, next: Math.max(0, Math.min(1, v - whole)) };
}

// One attribute: name, value bar, whole number, the bar toward the next
// point, and a "+1" that pops when a point lands. Every part has a fixed
// size, so nothing around it moves when the numbers change.
export function AttrRow({ k, value, keyAttr, note, noteColor }: { k: AttrKey; value: number; keyAttr?: boolean; note?: string; noteColor?: string }) {
  const { whole, next } = points(value);
  const fill = useState(() => new Animated.Value(next))[0];
  const level = useState(() => new Animated.Value(value / 99))[0];
  const pop = useState(() => new Animated.Value(0))[0];
  const [gain, setGain] = useState(0);
  const was = useRef(whole);
  useEffect(() => {
    const gained = whole - was.current;
    was.current = whole;
    Animated.timing(level, { toValue: value / 99, duration: 650, easing: Easing.out(Easing.cubic), useNativeDriver: false }).start();
    if (gained > 0 && !motionReduced()) {
      // Fill to the top, land the point, then fill again to where it is now.
      Animated.timing(fill, { toValue: 1, duration: 380, easing: Easing.in(Easing.quad), useNativeDriver: false }).start(() => {
        fill.setValue(0);
        setGain(gained);
        pop.setValue(1);
        Animated.spring(pop, { toValue: 0, friction: 4, tension: 70, useNativeDriver: NATIVE }).start(() => setGain(0));
        Animated.timing(fill, { toValue: next, duration: 420, easing: Easing.out(Easing.quad), useNativeDriver: false }).start();
      });
    } else {
      Animated.timing(fill, { toValue: next, duration: 500, easing: Easing.out(Easing.quad), useNativeDriver: false }).start();
    }
  }, [whole, next, value, fill, level, pop]);
  const color = ratingColor(whole);
  return (
    <View style={{ gap: 4, paddingVertical: 3 }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
        <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: keyAttr ? colors.accent : 'transparent' }} />
        <Text style={{ flex: 1, fontFamily: keyAttr ? fonts.semibold : fonts.medium, fontSize: 13.5, color: keyAttr ? colors.text : colors.muted }} numberOfLines={1}>
          {ATTR_LABELS[k]}
        </Text>
        <Text style={{ width: 58, textAlign: 'right', fontFamily: fonts.semibold, fontSize: 11, color: noteColor ?? colors.faint }} numberOfLines={1}>
          {note ?? ''}
        </Text>
        <View style={{ width: 34, height: 5, borderRadius: 3, backgroundColor: colors.bgElev, overflow: 'hidden' }} accessibilityLabel={`${Math.round(next * 100)}% to the next point`}>
          <Animated.View style={{ height: '100%', backgroundColor: colors.gold, width: fill.interpolate({ inputRange: [0, 1], outputRange: ['0%', '100%'] }) }} />
        </View>
        <Animated.Text style={{ width: 30, textAlign: 'right', fontFamily: fonts.display, fontSize: 19, color, transform: [{ scale: pop.interpolate({ inputRange: [0, 1], outputRange: [1, 1.45] }) }] }}>{whole}</Animated.Text>
        <Animated.View style={{ width: 30, alignItems: 'center', opacity: pop, transform: [{ translateY: pop.interpolate({ inputRange: [0, 1], outputRange: [-6, 0] }) }] }}>
          <Text style={{ fontFamily: fonts.bold, fontSize: 12, color: colors.ink, backgroundColor: colors.accent, borderRadius: 8, paddingHorizontal: 5, overflow: 'hidden' }}>{gain ? `+${gain}` : ' '}</Text>
        </Animated.View>
      </View>
      <View style={{ height: 6, marginLeft: 14, borderRadius: 3, backgroundColor: colors.bgElev, overflow: 'hidden' }}>
        <Animated.View style={{ height: '100%', borderRadius: 3, backgroundColor: alpha(color, 0.9), width: level.interpolate({ inputRange: [0, 1], outputRange: ['0%', '100%'] }) }} />
      </View>
    </View>
  );
}

// All of a player's attributes, key ones marked, in the fixed order.
export function AttributeList({ p, notes }: { p: Pick<Player, 'position' | 'attrs'> & { role?: string }; notes?: Partial<Record<AttrKey, { text: string; color: string }>> }) {
  return <AttributeGrid attrs={p.attrs} keeper={p.position === 'GK'} weights={weightsFor(p)} notes={notes} />;
}

export function AttributeGrid({ attrs, keeper, weights, notes }: { attrs: Attributes; keeper: boolean; weights: Partial<Record<AttrKey, number>>; notes?: Partial<Record<AttrKey, { text: string; color: string }>> }) {
  return (
    <View>
      {attrOrder(keeper).map((k) => (
        <AttrRow key={k} k={k} value={attrs[k]} keyAttr={(weights[k] ?? 0) >= 0.15} note={notes?.[k]?.text} noteColor={notes?.[k]?.color} />
      ))}
    </View>
  );
}

export function potentialLabel(p: Player, ovr: number): string {
  const room = p.potential - ovr;
  if (p.age >= 29 || room <= 1) return 'At his peak';
  if (p.potential >= 88) return 'World class prospect';
  if (p.potential >= 80) return 'Future star';
  if (p.potential >= 70) return 'Solid pro';
  return 'Squad player';
}
