import React, { ReactNode } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Club } from '../engine/types';
import { Badge } from './kit';
import { alpha, colors, fonts, luminance, teamColor } from './theme';

// Dark header card lit by the team's colour, with a big tilted crest behind.
export function TeamHero({ club, kicker, title, subtitle, right, children, portrait }: { club: Club | null; kicker: string; title: string; subtitle?: string; right?: ReactNode; children?: ReactNode; portrait?: ReactNode }) {
  const base = club ? teamColor(club.colors) : colors.blue;
  return (
    <View style={styles.wrap}>
      <LinearGradient colors={[alpha(base, luminance(base) > 0.5 ? 0.35 : 0.6), alpha(base, 0.15), colors.card]} locations={[0, 0.55, 1]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={StyleSheet.absoluteFill} />
      <View style={[styles.edge, { backgroundColor: base }]} />
      <View style={styles.stripe} />
      {club && (
        <View style={styles.watermark} pointerEvents="none">
          <Badge club={club} size={180} />
        </View>
      )}
      <View style={styles.inner}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 14 }}>
          {portrait ?? (club && <Badge club={club} size={60} />)}
          <View style={{ flex: 1 }}>
            <Text style={styles.kicker}>{kicker}</Text>
            <Text style={styles.title} numberOfLines={1}>
              {title}
            </Text>
            {subtitle ? (
              <Text style={styles.subtitle} numberOfLines={2}>
                {subtitle}
              </Text>
            ) : null}
          </View>
          {right}
        </View>
        {children}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { borderRadius: 22, overflow: 'hidden', borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)', backgroundColor: colors.card, shadowColor: '#000', shadowOpacity: 0.4, shadowRadius: 20, shadowOffset: { width: 0, height: 10 }, elevation: 6 },
  edge: { position: 'absolute', top: 0, left: 0, right: 0, height: 3 },
  stripe: { position: 'absolute', top: -40, left: -60, width: 160, height: 400, backgroundColor: 'rgba(255,255,255,0.04)', transform: [{ rotate: '25deg' }] },
  watermark: { position: 'absolute', right: -34, top: -16, opacity: 0.12, transform: [{ rotate: '-12deg' }] },
  inner: { padding: 18, gap: 12 },
  kicker: { fontFamily: fonts.semibold, fontSize: 11.5, color: 'rgba(255,255,255,0.7)', letterSpacing: 1.4, textTransform: 'uppercase' },
  title: { fontFamily: fonts.display, fontSize: 30, color: '#ffffff', lineHeight: 34, letterSpacing: 0.3 },
  subtitle: { fontFamily: fonts.body, fontSize: 13, color: 'rgba(255,255,255,0.8)' },
});
