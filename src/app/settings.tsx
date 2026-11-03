import React from 'react';
import { Platform, Pressable, Text } from 'react-native';
import { useRouter } from 'expo-router';
import Constants from 'expo-constants';
import { MatchSpeed, useSettings } from '../state/settings';
import { useAuth } from '../state/auth';
import { Card, Choice, H2, Icon, Row, Screen, T } from '../ui/kit';
import { alpha, colors, fonts } from '../ui/theme';

const SPEEDS: { key: MatchSpeed; label: string }[] = [
  { key: '1', label: '1x' },
  { key: '2', label: '2x' },
  { key: '4', label: '4x' },
];

export default function SettingsScreen() {
  const router = useRouter();
  const s = useSettings();
  const authStatus = useAuth((a) => a.status);
  const version = Constants.expoConfig?.version ?? '1.0.0';

  return (
    <Screen title="Settings">
      <Card>
        <H2>Matches</H2>
        <T muted style={{ fontSize: 13 }}>
          Default speed for live matches
        </T>
        <Row gap={8}>
          {SPEEDS.map((sp) => {
            const active = s.matchSpeed === sp.key;
            return (
              <Pressable
                key={sp.key}
                onPress={() => s.set({ matchSpeed: sp.key })}
                accessibilityRole="button"
                accessibilityState={{ selected: active }}
                accessibilityLabel={`Match speed ${sp.label}`}
                style={{ flex: 1, minHeight: 44, alignItems: 'center', justifyContent: 'center', borderRadius: 12, borderWidth: 1, borderColor: active ? colors.accent : colors.border, backgroundColor: active ? alpha(colors.accent, 0.12) : colors.bgElev }}
              >
                <Text style={{ fontFamily: fonts.medium, fontSize: 14, color: active ? colors.accent : colors.text }}>{sp.label}</Text>
              </Pressable>
            );
          })}
        </Row>
        <Choice active={s.autoMoments} label="Auto-play key moments" sub="The sim plays your shots, passes and saves for you. You can still switch it per match." onPress={() => s.set({ autoMoments: !s.autoMoments })} />
      </Card>

      <Card>
        <H2>Feel</H2>
        <Choice active={s.sound} label="Sound" sub="Kicks, whistles, the crowd and reward chimes." onPress={() => s.set({ sound: !s.sound })} />
        {Platform.OS !== 'web' && <Choice active={s.haptics} label="Vibration" sub="Small taps on buttons, goals and rewards." onPress={() => s.set({ haptics: !s.haptics })} />}
        <Choice
          active={s.reduceMotion || s.osReduceMotion}
          label="Reduce motion"
          sub={s.osReduceMotion ? 'On because your device asks for reduced motion.' : 'Turns off confetti, drifting backgrounds and slide-in effects.'}
          onPress={() => !s.osReduceMotion && s.set({ reduceMotion: !s.reduceMotion })}
        />
        <Choice active={!s.seenTips} label="Show first-run tips again" sub="The short intro cards on the career home screen." onPress={() => s.set({ seenTips: !s.seenTips })} />
      </Card>

      {authStatus !== 'off' && (
        <Pressable onPress={() => router.push(authStatus === 'signed-in' ? '/account' : '/account/sign-in')} accessibilityRole="button">
          <Card>
            <Row gap={10}>
              <Icon name="person-circle-outline" size={20} color={colors.accent} />
              <Text style={{ flex: 1, fontFamily: fonts.medium, fontSize: 14, color: colors.text }}>{authStatus === 'signed-in' ? 'Account and cloud saves' : 'Sign in to sync saves'}</Text>
              <Icon name="chevron-forward" size={18} color={colors.muted} />
            </Row>
          </Card>
        </Pressable>
      )}

      <Row gap={18} style={{ justifyContent: 'center' }}>
        <Text style={{ fontFamily: fonts.medium, fontSize: 12, color: colors.muted, paddingVertical: 10 }} onPress={() => router.push('/legal/privacy')}>
          Privacy
        </Text>
        <Text style={{ fontFamily: fonts.medium, fontSize: 12, color: colors.muted, paddingVertical: 10 }} onPress={() => router.push('/legal/terms')}>
          Terms
        </Text>
      </Row>
      <Text style={{ fontFamily: fonts.body, fontSize: 11, color: colors.muted, textAlign: 'center' }}>FootMax {version}</Text>
    </Screen>
  );
}
