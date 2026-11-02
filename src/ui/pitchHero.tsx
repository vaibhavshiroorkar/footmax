import React, { ReactNode, useCallback, useState } from 'react';
import { useFocusEffect } from 'expo-router';
import { motionReduced } from '../state/settings';
import { Animated, Easing, Platform, StyleSheet, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import Svg, { Circle, Line, Rect } from 'react-native-svg';
import { colors } from './theme';

// Mown-grass stripes with pitch markings, fading into the background.
export function PitchHero({ children, height = 300 }: { children: ReactNode; height?: number }) {
  const drift = useState(() => new Animated.Value(0))[0];
  // Runs only while the screen is in front: on web, screens underneath stay
  // mounted and would keep animating on the JS thread.
  useFocusEffect(
    useCallback(() => {
      if (motionReduced()) return;
      const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(drift, { toValue: 1, duration: 6000, easing: Easing.inOut(Easing.sin), useNativeDriver: Platform.OS !== 'web' }),
        Animated.timing(drift, { toValue: 0, duration: 6000, easing: Easing.inOut(Easing.sin), useNativeDriver: Platform.OS !== 'web' }),
      ]),
    );
      loop.start();
      return () => loop.stop();
    }, [drift]),
  );
  return (
    <View style={{ height, borderRadius: 24, overflow: 'hidden', borderWidth: 1, borderColor: colors.border }}>
      <Animated.View style={[StyleSheet.absoluteFill, { transform: [{ scale: drift.interpolate({ inputRange: [0, 1], outputRange: [1.05, 1.12] }) }] }]}>
        <Svg width="100%" height="100%" viewBox="0 0 400 300" preserveAspectRatio="xMidYMid slice">
          {Array.from({ length: 10 }, (_, i) => (
            <Rect key={i} x={i * 40} y={0} width={40} height={300} fill={i % 2 ? colors.pitch : colors.pitchDark} />
          ))}
          <Rect x={20} y={20} width={360} height={260} stroke="#ffffff" strokeOpacity={0.35} strokeWidth={2} fill="none" />
          <Line x1={200} y1={20} x2={200} y2={280} stroke="#ffffff" strokeOpacity={0.35} strokeWidth={2} />
          <Circle cx={200} cy={150} r={45} stroke="#ffffff" strokeOpacity={0.35} strokeWidth={2} fill="none" />
          <Circle cx={200} cy={150} r={3} fill="#ffffff" fillOpacity={0.5} />
          <Rect x={20} y={95} width={50} height={110} stroke="#ffffff" strokeOpacity={0.35} strokeWidth={2} fill="none" />
          <Rect x={330} y={95} width={50} height={110} stroke="#ffffff" strokeOpacity={0.35} strokeWidth={2} fill="none" />
        </Svg>
      </Animated.View>
      <LinearGradient colors={['rgba(6,12,9,0.15)', 'rgba(6,12,9,0.55)', colors.bg]} locations={[0, 0.55, 1]} style={StyleSheet.absoluteFill} />
      <View style={{ flex: 1, justifyContent: 'flex-end', padding: 20 }}>{children}</View>
    </View>
  );
}
