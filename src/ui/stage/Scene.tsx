import React, { useEffect, useState } from 'react';
import { Animated, Platform, StyleSheet, Text, View } from 'react-native';
import Svg from 'react-native-svg';
import { Callout } from '../pitchSim';
import { RefereeFigure, RigFigure } from '../rig/Figure';
import { armUp, celebrate, playOn, point, stand } from '../rig/poses';
import { useTicker } from '../moments/useTicker';
import { alpha, fonts } from '../theme';
import { motionReduced } from '../../state/settings';

const NATIVE = Platform.OS !== 'web';

// Short scenes over the pitch, inside its own block, so nothing on the page
// moves. They sit on top of live play; the pitch carries on underneath.

function usePop() {
  const pop = useState(() => new Animated.Value(0))[0];
  useEffect(() => {
    if (motionReduced()) pop.setValue(1);
    else Animated.spring(pop, { toValue: 1, friction: 5, tension: 130, useNativeDriver: NATIVE }).start();
  }, [pop]);
  return pop;
}

const shadow = { textShadowColor: 'rgba(0,0,0,0.65)', textShadowRadius: 8, textShadowOffset: { width: 0, height: 2 } };

// The referee and his signal, with the call beside him.
export function RefScene({ c }: { c: Callout }) {
  const pop = usePop();
  const pose = c.signal === 'spot' ? point(1) : c.signal === 'wave' ? playOn() : c.signal === 'arm' || c.signal === 'card' ? armUp(1) : c.signal === 'point' ? point(-1) : stand();
  const card = c.tone === 'yellow' ? 'yellow' : c.tone === 'red' ? 'red' : undefined;
  return (
    <View pointerEvents="none" style={[StyleSheet.absoluteFill, styles.dim]}>
      <Animated.View style={[styles.row, { opacity: pop, transform: [{ scale: pop.interpolate({ inputRange: [0, 1], outputRange: [0.75, 1] }) }] }]}>
        <Svg width={92} height={120} viewBox="-44 -92 88 100">
          <RefereeFigure x={0} ground={0} h={60} pose={pose} card={card} />
        </Svg>
        <View style={{ flexShrink: 1 }}>
          <Text style={[styles.call, shadow]} numberOfLines={1} adjustsFontSizeToFit>
            {c.text}
          </Text>
          {!!c.sub && (
            <Text style={[styles.sub, shadow]} numberOfLines={2}>
              {c.sub}
            </Text>
          )}
        </View>
      </Animated.View>
    </View>
  );
}

// The scorer in the middle of the screen, doing his celebration.
export function GoalScene({ c, kit, skin, hair, boots, tint }: { c: Callout; kit: string; skin?: string; hair?: string | null; boots?: string; tint: string }) {
  const pop = usePop();
  const t = useTicker(!motionReduced());
  const { pose, lift, turn } = celebrate(c.style ?? '', t);
  return (
    <View pointerEvents="none" style={[StyleSheet.absoluteFill, { alignItems: 'center', justifyContent: 'center', backgroundColor: alpha(tint, 0.42) }]}>
      <Animated.View style={{ alignItems: 'center', opacity: pop, transform: [{ scale: pop.interpolate({ inputRange: [0, 1], outputRange: [0.6, 1] }) }] }}>
        <Svg width={130} height={118} viewBox="-52 -94 104 100">
          <RigFigure x={0} ground={0} h={60} pose={pose} lift={lift} turn={turn} kit={kit} skin={skin} hair={hair} boots={boots} />
        </Svg>
        <Text style={[styles.goal, shadow]}>{c.text}</Text>
        {!!c.sub && <Text style={[styles.sub, shadow, { textAlign: 'center' }]}>{c.sub}</Text>}
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  dim: { alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(8,12,20,0.5)', paddingHorizontal: 12 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 6, maxWidth: '100%' },
  call: { fontFamily: fonts.display, fontSize: 34, color: '#ffffff', letterSpacing: 1.5 },
  sub: { fontFamily: fonts.bold, fontSize: 12.5, color: '#ffffff', letterSpacing: 0.5 },
  goal: { fontFamily: fonts.display, fontSize: 40, lineHeight: 42, color: '#ffffff', letterSpacing: 3 },
});
