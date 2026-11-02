import React, { useEffect, useState } from 'react';
import { Animated, Easing, Platform, Pressable, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import Svg, { Path } from 'react-native-svg';
import { useRouter } from 'expo-router';
import { Button, Icon, IconName, haptic } from './kit';
import { alpha, colors, fonts } from './theme';
import { motionReduced } from '../state/settings';

const NATIVE = Platform.OS !== 'web';
const CONFETTI = [colors.accent, colors.gold, colors.teal, colors.blue, colors.purple, '#ffffff'];

export interface CelebrationData {
  title: string;
  sub?: string;
  icon?: IconName;
  duration?: number;
  // A button that takes the player where they can act on it.
  action?: { label: string; href: string };
}

function Piece({ index, width, height }: { index: number; width: number; height: number }) {
  const fall = useState(() => new Animated.Value(0))[0];
  const [spec] = useState(
    () => ({
      x: Math.random() * width,
      drift: (Math.random() - 0.5) * 140,
      delay: Math.random() * 350,
      duration: 1500 + Math.random() * 1300,
      size: 7 + Math.random() * 9,
      round: Math.random() < 0.35,
      color: CONFETTI[index % CONFETTI.length],
      spin: Math.random() < 0.5 ? '-' : '',
    }),
  );
  useEffect(() => {
    Animated.timing(fall, { toValue: 1, duration: spec.duration, delay: spec.delay, easing: Easing.out(Easing.quad), useNativeDriver: NATIVE }).start();
  }, [fall, spec]);
  return (
    <Animated.View
      style={{
        position: 'absolute',
        left: spec.x,
        top: -20,
        width: spec.size,
        height: spec.round ? spec.size : spec.size * 1.6,
        borderRadius: spec.round ? spec.size / 2 : 2,
        backgroundColor: spec.color,
        opacity: fall.interpolate({ inputRange: [0, 0.85, 1], outputRange: [1, 1, 0] }),
        transform: [
          { translateY: fall.interpolate({ inputRange: [0, 1], outputRange: [0, height * 0.95] }) },
          { translateX: fall.interpolate({ inputRange: [0, 1], outputRange: [0, spec.drift] }) },
          { rotate: fall.interpolate({ inputRange: [0, 1], outputRange: ['0deg', `${spec.spin}600deg`] }) },
        ],
      }}
    />
  );
}

// Sunburst behind the icon.
function Rays({ color }: { color: string }) {
  const spin = useState(() => new Animated.Value(0))[0];
  useEffect(() => {
    if (motionReduced()) return;
    const loop = Animated.loop(Animated.timing(spin, { toValue: 1, duration: 9000, easing: Easing.linear, useNativeDriver: NATIVE }));
    loop.start();
    return () => loop.stop();
  }, [spin]);
  const paths = Array.from({ length: 12 }, (_, i) => {
    const a = (i / 12) * Math.PI * 2;
    const b = a + Math.PI / 14;
    return `M100 100 L${100 + 100 * Math.cos(a)} ${100 + 100 * Math.sin(a)} L${100 + 100 * Math.cos(b)} ${100 + 100 * Math.sin(b)} Z`;
  });
  return (
    <Animated.View style={{ position: 'absolute', width: 220, height: 220, transform: [{ rotate: spin.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '360deg'] }) }] }}>
      <Svg width={220} height={220} viewBox="0 0 200 200">
        {paths.map((d, i) => (
          <Path key={i} d={d} fill={color} opacity={0.18} />
        ))}
      </Svg>
    </Animated.View>
  );
}

// Confetti, a sunburst and a card for goals, trophies and upgrades. One
// with an action stays up until the player taps.
export function Celebration({ data, onClose }: { data: CelebrationData | null; onClose: () => void }) {
  const { width, height } = useWindowDimensions();
  const router = useRouter();
  const pop = useState(() => new Animated.Value(0))[0];
  const duration = data?.duration ?? 2800;
  useEffect(() => {
    if (!data) return;
    haptic('success');
    pop.setValue(0);
    Animated.spring(pop, { toValue: 1, useNativeDriver: NATIVE, friction: 4, tension: 110 }).start();
    if (data.action) return;
    const t = setTimeout(onClose, duration);
    return () => clearTimeout(t);
  }, [data, pop, onClose, duration]);
  if (!data) return null;
  return (
    <Pressable style={[StyleSheet.absoluteFill, { backgroundColor: 'rgba(4,6,12,0.78)', alignItems: 'center', justifyContent: 'center' }]} onPress={onClose}>
      {Array.from({ length: motionReduced() ? 0 : 50 }, (_, i) => (
        <Piece key={`${data.title}-${i}`} index={i} width={width} height={height} />
      ))}
      <Animated.View style={{ alignItems: 'center', transform: [{ scale: pop.interpolate({ inputRange: [0, 1], outputRange: [0.4, 1] }) }, { rotate: pop.interpolate({ inputRange: [0, 1], outputRange: ['-8deg', '0deg'] }) }], opacity: pop }}>
        <View style={{ alignItems: 'center', justifyContent: 'center', height: 150, marginBottom: -48, zIndex: 2 }}>
          <Rays color={data.action ? colors.accent : colors.gold} />
          <View style={[styles.medal, data.action && { backgroundColor: colors.accent, shadowColor: colors.accent }]}>
            <View style={{ transform: [{ rotate: '-45deg' }] }}>
              <Icon name={data.icon ?? 'trophy'} size={40} color={colors.ink} />
            </View>
          </View>
        </View>
        <View style={styles.card}>
          <Text style={styles.title}>{data.title}</Text>
          {data.sub ? <Text style={styles.sub}>{data.sub}</Text> : null}
          {data.action ? (
            <View style={{ alignSelf: 'stretch', gap: 6, marginTop: 6 }}>
              <Button
                label={data.action.label}
                icon="arrow-forward"
                onPress={() => {
                  onClose();
                  router.navigate(data.action!.href as never);
                }}
              />
              <Button label="Later" variant="ghost" small onPress={onClose} />
            </View>
          ) : (
            <Text style={styles.tap}>Tap to continue</Text>
          )}
        </View>
      </Animated.View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  medal: { width: 92, height: 92, borderRadius: 30, backgroundColor: colors.gold, borderWidth: 4, borderColor: colors.card, alignItems: 'center', justifyContent: 'center', shadowColor: colors.gold, shadowOpacity: 0.5, shadowRadius: 24, shadowOffset: { width: 0, height: 0 }, elevation: 8, transform: [{ rotate: '45deg' }] },
  card: { alignItems: 'center', gap: 8, paddingTop: 58, paddingBottom: 20, paddingHorizontal: 24, borderRadius: 24, backgroundColor: colors.card, borderWidth: 1, borderColor: alpha('#ffffff', 0.1), width: 320, maxWidth: '90%' as unknown as number },
  title: { fontFamily: fonts.display, fontSize: 34, color: colors.text, textAlign: 'center', letterSpacing: 0.8, textTransform: 'uppercase' },
  sub: { fontFamily: fonts.body, fontSize: 14, color: colors.muted, textAlign: 'center', lineHeight: 20 },
  tap: { fontFamily: fonts.body, fontSize: 11, color: colors.faint, marginTop: 6 },
});
