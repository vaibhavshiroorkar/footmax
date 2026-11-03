import React, { ReactNode, useEffect, useRef, useState, useId } from 'react';
import { Animated, Easing, KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleProp, StyleSheet, Text, TextStyle, View, ViewStyle } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import Svg, { Circle, Path, Text as SvgText, Defs, LinearGradient as SvgGradient, Stop } from 'react-native-svg';
import { usePathname, useRouter } from 'expo-router';
import { alpha, colors, fonts, onColor, radius, shade, space } from './theme';
import { Club } from '../engine/types';
import { useGame } from '../state/store';
import { navBadges } from '../engine/alerts';
import { playSound } from './sound';
import { hapticsOn, motionReduced } from '../state/settings';

export type IconName = React.ComponentProps<typeof Ionicons>['name'];
const NATIVE = Platform.OS !== 'web';

export function haptic(kind: 'light' | 'medium' | 'heavy' | 'success' | 'warning' = 'light') {
  // Taps click on every platform; vibration is phones only.
  if (kind === 'light' || kind === 'medium') playSound('tap', kind === 'medium' ? 0.6 : 0.4);
  if (!NATIVE || !hapticsOn()) return;
  try {
    if (kind === 'success') Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    else if (kind === 'warning') Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
    else Haptics.impactAsync(kind === 'heavy' ? Haptics.ImpactFeedbackStyle.Heavy : kind === 'medium' ? Haptics.ImpactFeedbackStyle.Medium : Haptics.ImpactFeedbackStyle.Light);
  } catch {
    // Haptics are a nicety; some devices have none.
  }
}

export function Icon({ name, size = 18, color = colors.text }: { name: IconName; size?: number; color?: string }) {
  return <Ionicons name={name} size={size} color={color} />;
}

// A tinted icon tile. "solid" fills it with the colour for emphasis.
export function Sticker({ icon, color, size = 40, solid }: { icon: IconName; color: string; size?: number; solid?: boolean }) {
  return (
    <View style={{ width: size, height: size, borderRadius: size * 0.22, backgroundColor: solid ? color : alpha(color, 0.15), borderWidth: 1.5, borderColor: alpha(color, solid ? 1 : 0.35), alignItems: 'center', justifyContent: 'center' }}>
      <Icon name={icon} size={size * 0.5} color={solid ? onColor(color) : color} />
    </View>
  );
}

// Fades and slides a block in; index staggers lists.
export function FadeIn({ children, index = 0, style }: { children: ReactNode; index?: number; style?: StyleProp<ViewStyle> }) {
  // With reduced motion, content appears in place.
  const v = useState(() => new Animated.Value(motionReduced() ? 1 : 0))[0];
  useEffect(() => {
    if (motionReduced()) return;
    Animated.timing(v, { toValue: 1, duration: 260, delay: Math.min(index, 12) * 30, easing: Easing.out(Easing.cubic), useNativeDriver: NATIVE }).start();
  }, [v, index]);
  // Fades only: content appears where it will stay, it never slides into place.
  return <Animated.View style={[style, { opacity: v }]}>{children}</Animated.View>;
}

// The value, but only after it has stopped changing for `ms`. Searches
// over thousands of players use it so typing stays smooth.
export function useDebounced<T>(value: T, ms = 250): T {
  const [settled, setSettled] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setSettled(value), ms);
    return () => clearTimeout(t);
  }, [value, ms]);
  return settled;
}

// Counts up (or down) to a new value.
export function AnimatedNumber({ value, style, format = (n: number) => String(Math.round(n)), duration = 700 }: { value: number; style?: StyleProp<TextStyle>; format?: (n: number) => string; duration?: number }) {
  const [shown, setShown] = useState(value);
  const from = useRef(value);
  useEffect(() => {
    const start = from.current;
    if (start === value) return;
    const t0 = Date.now();
    let frame: number;
    const tick = () => {
      const k = Math.min(1, (Date.now() - t0) / duration);
      const eased = 1 - Math.pow(1 - k, 3);
      setShown(start + (value - start) * eased);
      if (k < 1) frame = requestAnimationFrame(tick);
      else from.current = value;
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [value, duration]);
  return <Text style={style}>{format(shown)}</Text>;
}

// Play sits in the middle as the big button; everything else that is not
// daily lives under More on the left.
const CAREER_TABS: { href: string; icon: IconName; label: string; color: string; center?: boolean; also?: string[] }[] = [
  { href: '/career/more', icon: 'grid', label: 'More', color: colors.accent },
  { href: '/career/train', icon: 'barbell', label: 'Train', color: colors.accent, also: ['/career/skills'] },
  { href: '/career', icon: 'football', label: 'Play', color: colors.accent, center: true },
  { href: '/inbox', icon: 'mail', label: 'Inbox', color: colors.accent },
  { href: '/career/profile', icon: 'person', label: 'Me', color: colors.accent },
];
const MANAGER_TABS: { href: string; icon: IconName; label: string; color: string }[] = [
  { href: '/manager', icon: 'home', label: 'Home', color: colors.accent },
  { href: '/manager/squad', icon: 'people', label: 'Squad', color: colors.accent },
  { href: '/manager/transfers', icon: 'swap-horizontal', label: 'Market', color: colors.accent },
  { href: '/inbox', icon: 'mail', label: 'Inbox', color: colors.accent },
  { href: '/league', icon: 'podium', label: 'League', color: colors.accent },
];

// Squad and Market only make sense with a club. A national-team-only
// manager gets the national squad and tournaments; someone out of work
// keeps just what still applies.
function managerTabs(game: ReturnType<typeof useGame>) {
  const m = game?.manager;
  if (!m || m.clubId) return MANAGER_TABS;
  const keep = MANAGER_TABS.filter((t) => t.href === '/manager' || t.href === '/inbox' || t.href === '/league');
  if (!m.nationalTeamId) return keep;
  return [keep[0], { href: '/manager/national', icon: 'flag' as IconName, label: 'National', color: colors.accent }, { href: '/tournaments', icon: 'trophy' as IconName, label: 'Cups', color: colors.accent }, ...keep.slice(1)];
}

function NavItem({ tab, active, onPress, badge }: { tab: (typeof CAREER_TABS)[number]; active: boolean; onPress: () => void; badge?: number }) {
  const s = useState(() => new Animated.Value(active ? 1 : 0))[0];
  useEffect(() => {
    Animated.spring(s, { toValue: active ? 1 : 0, useNativeDriver: NATIVE, friction: 7, tension: 140 }).start();
  }, [active, s]);
  const outline = `${tab.icon}-outline` as IconName;
  if (tab.center) {
    return (
      <Pressable onPress={onPress} accessibilityRole="tab" accessibilityState={{ selected: active }} accessibilityLabel={tab.label} style={{ flex: 1, alignItems: 'center', minHeight: 52 }}>
        <View style={{ marginTop: -18, width: 58, height: 58, borderRadius: 29, backgroundColor: colors.accent, alignItems: 'center', justifyContent: 'center', borderWidth: 4, borderColor: colors.bg, shadowColor: colors.accent, shadowOpacity: active ? 0.6 : 0.3, shadowRadius: 10, shadowOffset: { width: 0, height: 2 } }}>
          <Icon name={tab.icon} size={26} color={colors.ink} />
          {badge ? (
            <View style={{ position: 'absolute', top: -4, right: -4, minWidth: 20, height: 20, borderRadius: 10, backgroundColor: colors.gold, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 4, borderWidth: 2, borderColor: colors.bg }}>
              <Text style={{ color: colors.ink, fontFamily: fonts.bold, fontSize: 10.5 }}>{badge > 9 ? '9+' : badge}</Text>
            </View>
          ) : null}
        </View>
        <Text style={{ fontFamily: fonts.bold, fontSize: 11.5, color: active ? colors.accent : colors.text, marginTop: 1 }}>{tab.label}</Text>
      </Pressable>
    );
  }
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="tab"
      accessibilityState={{ selected: active }}
      accessibilityLabel={badge ? `${tab.label}, ${badge} important` : tab.label}
      style={{ flex: 1, alignItems: 'center', paddingTop: 10, paddingBottom: 8, minHeight: 52 }}
    >
      <Animated.View style={{ alignItems: 'center', transform: [{ scale: s.interpolate({ inputRange: [0, 1], outputRange: [1, 1.06] }) }] }}>
        <View style={{ width: 54, height: 30, borderRadius: 15, alignItems: 'center', justifyContent: 'center', backgroundColor: active ? alpha(tab.color, 0.14) : 'transparent' }}>
          <Icon name={active ? tab.icon : outline} size={21} color={active ? tab.color : colors.muted} />
        </View>
        {badge ? (
          <View style={{ position: 'absolute', top: -3, right: 6, minWidth: 17, height: 17, borderRadius: 9, backgroundColor: colors.red, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 4, borderWidth: 2, borderColor: colors.card }}>
            <Text style={{ color: '#fff', fontFamily: fonts.bold, fontSize: 10 }}>{badge > 99 ? '99' : badge}</Text>
          </View>
        ) : null}
      </Animated.View>
      <Text style={{ fontFamily: fonts.medium, fontSize: 11.5, color: active ? colors.text : colors.muted, marginTop: 3 }}>{tab.label}</Text>
    </Pressable>
  );
}

// Badges only count things the player has to act on (see engine/alerts).
export function BottomNav({ mode }: { mode: 'career' | 'manager' }) {
  const router = useRouter();
  const path = usePathname();
  const game = useGame();
  const badges = game ? navBadges(game) : undefined;
  const tabs = mode === 'career' ? CAREER_TABS : managerTabs(game);
  return (
    <View style={styles.nav}>
      {tabs.map((t) => (
        <NavItem
          key={t.href}
          tab={t}
          active={path === t.href || ((t as { also?: string[] }).also ?? []).includes(path)}
          badge={badges?.[t.href]}
          onPress={() => {
            if (path === t.href) return;
            haptic();
            router.navigate(t.href as never);
          }}
        />
      ))}
    </View>
  );
}

// Faint mown stripes under a floodlight, fading down the screen.
function Backdrop() {
  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="none">
      <View style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 520, flexDirection: 'row' }}>
        {Array.from({ length: 8 }, (_, i) => (
          <View key={i} style={{ flex: 1, backgroundColor: i % 2 ? 'rgba(255,255,255,0.025)' : 'transparent' }} />
        ))}
      </View>
      <LinearGradient colors={[alpha('#d6e6ff', 0.06), alpha(colors.bg, 0.4), colors.bg]} locations={[0, 0.5, 1]} style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 520 }} />
    </View>
  );
}

export function Screen({ children, title, back = true, right, scroll = true, nav }: { children: ReactNode; title?: string; back?: boolean; right?: ReactNode; scroll?: boolean; nav?: 'career' | 'manager' }) {
  const router = useRouter();
  const body = <View style={styles.inner}>{children}</View>;
  return (
    <SafeAreaView style={styles.safe} edges={nav ? ['top', 'left', 'right', 'bottom'] : ['top', 'left', 'right']}>
      <Backdrop />
      {title !== undefined && (
        <View style={styles.header}>
          {back && !nav && <IconButton icon="chevron-back" onPress={() => (router.canGoBack() ? router.back() : router.replace('/'))} label="Back" />}
          <Text style={styles.headerTitle} numberOfLines={1}>
            {title}
          </Text>
          {right}
        </View>
      )}
      {/* iOS does not move content out from under the keyboard by itself. */}
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined} enabled={Platform.OS === 'ios'}>
        {scroll ? (
          <ScrollView contentContainerStyle={[styles.scroll, nav && { paddingBottom: 24 }]} keyboardShouldPersistTaps="handled" keyboardDismissMode="on-drag" showsVerticalScrollIndicator={false}>
            {body}
          </ScrollView>
        ) : (
          <View style={[styles.scroll, { flex: 1 }]}>{body}</View>
        )}
      </KeyboardAvoidingView>
      {nav && <BottomNav mode={nav} />}
    </SafeAreaView>
  );
}

export function IconButton({ icon, onPress, label, color = colors.text }: { icon: IconName; onPress: () => void; label?: string; color?: string }) {
  return (
    <Pressable
      onPress={() => {
        haptic();
        onPress();
      }}
      hitSlop={10}
      accessibilityLabel={label}
      accessibilityRole="button"
      style={({ pressed }) => [styles.iconBtn, pressed && { transform: [{ scale: 0.9 }] }]}
    >
      <Icon name={icon} size={20} color={color} />
    </Pressable>
  );
}

export function Card({ children, style, gradient, glow, tint }: { children: ReactNode; style?: StyleProp<ViewStyle>; gradient?: readonly string[]; glow?: string; tint?: string }) {
  return (
    <View style={[styles.cardWrap, glow ? { borderColor: alpha(glow, 0.5) } : null, style]}>
      {gradient ? <LinearGradient colors={gradient as unknown as [string, string]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={StyleSheet.absoluteFill} /> : null}
      {tint ? <View style={[StyleSheet.absoluteFill, { backgroundColor: alpha(tint, 0.08) }]} /> : null}
      {glow ? <View style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 3, backgroundColor: glow }} /> : null}
      <View style={styles.cardInner}>{children}</View>
    </View>
  );
}

export function H1({ children, style }: { children: ReactNode; style?: StyleProp<TextStyle> }) {
  return <Text style={[styles.h1, style]}>{children}</Text>;
}

export function H2({ children, style }: { children: ReactNode; style?: StyleProp<TextStyle> }) {
  return <Text style={[styles.h2, style]}>{children}</Text>;
}

export function SectionLabel({ children, icon }: { children: ReactNode; icon?: IconName }) {
  return (
    <Row gap={8} style={{ marginTop: 8 }}>
      {icon && <Icon name={icon} size={15} color={colors.muted} />}
      <Text style={styles.section}>{children}</Text>
      <View style={{ flex: 1, height: 0, borderTopWidth: 1.5, borderStyle: 'dashed', borderColor: colors.borderStrong }} />
    </Row>
  );
}

export function T({ children, muted, style, bold, onPress }: { children: ReactNode; muted?: boolean; bold?: boolean; style?: StyleProp<TextStyle>; onPress?: () => void }) {
  return (
    <Text onPress={onPress} suppressHighlighting style={[styles.t, muted && { color: colors.muted }, bold && { fontFamily: fonts.semibold }, style]}>
      {children}
    </Text>
  );
}

type Variant = 'primary' | 'secondary' | 'danger' | 'ghost' | 'gold' | 'blue' | 'purple';

const FACES: Record<Exclude<Variant, 'ghost' | 'secondary'>, string> = {
  primary: colors.accent,
  danger: colors.red,
  gold: colors.gold,
  blue: colors.blue,
  purple: colors.purple,
};

// A chunky button: a solid face sitting on a darker lip. Pressing pushes
// the face down onto the lip, like a real button.
export function Button({ label, onPress, variant = 'primary', disabled, sub, style, small, icon }: { label: string; onPress: () => void; variant?: Variant; disabled?: boolean; sub?: string; style?: StyleProp<ViewStyle>; small?: boolean; icon?: IconName }) {
  const ghost = variant === 'ghost';
  const plain = variant === 'secondary';
  const face = ghost ? 'transparent' : plain ? colors.cardAlt : FACES[variant];
  const lipColor = ghost ? 'transparent' : plain ? '#0a0f18' : shade(face, -0.35);
  const fg = ghost ? colors.muted : plain ? colors.text : onColor(face);
  const lip = ghost ? 0 : small ? 3 : 4;
  return (
    <View style={[{ opacity: disabled ? 0.4 : 1 }, style]}>
      <Pressable
        onPress={() => {
          haptic(ghost || plain ? 'light' : 'medium');
          onPress();
        }}
        disabled={disabled}
        accessibilityRole="button"
        accessibilityLabel={sub ? `${label}. ${sub}` : label}
        accessibilityState={{ disabled: !!disabled }}
        style={({ pressed }) => [
          styles.btn,
          small && styles.btnSmall,
          { backgroundColor: face, borderBottomWidth: pressed ? Math.min(1, lip) : lip, borderBottomColor: lipColor, marginTop: pressed ? lip - Math.min(1, lip) : 0 },
          plain && { borderWidth: 1.5, borderColor: colors.borderStrong, borderBottomColor: lipColor },
        ]}
      >
        <Row gap={8} style={{ justifyContent: 'center' }}>
          {icon && <Icon name={icon} size={small ? 16 : 19} color={fg} />}
          <Text style={[styles.btnText, small && { fontSize: 16 }, { color: fg }]} numberOfLines={2}>
            {label}
          </Text>
        </Row>
        {sub ? <Text style={[styles.btnSub, { color: plain || ghost ? colors.muted : alpha(fg, 0.75) }]}>{sub}</Text> : null}
      </Pressable>
    </View>
  );
}

// For big one-tap actions: the first tap arms it and changes the label,
// the second tap within a few seconds does it.
export function ConfirmButton({ confirmLabel = 'Tap again to confirm', onPress, label, variant, ...rest }: Parameters<typeof Button>[0] & { confirmLabel?: string }) {
  const [armed, setArmed] = useState(false);
  useEffect(() => {
    if (!armed) return;
    const t = setTimeout(() => setArmed(false), 3500);
    return () => clearTimeout(t);
  }, [armed]);
  return (
    <Button
      {...rest}
      label={armed ? confirmLabel : label}
      variant={armed ? 'gold' : variant}
      onPress={() => {
        if (!armed) return setArmed(true);
        setArmed(false);
        onPress();
      }}
    />
  );
}

export function Row({ children, style, gap = space.sm, accessibilityLabel }: { children: ReactNode; style?: StyleProp<ViewStyle>; gap?: number; accessibilityLabel?: string }) {
  return (
    <View style={[{ flexDirection: 'row', alignItems: 'center', gap }, style]} accessible={!!accessibilityLabel} accessibilityLabel={accessibilityLabel}>
      {children}
    </View>
  );
}

export function StatBar({ label, value, max = 100, color = colors.accent, right, icon, light }: { label: string; value: number; max?: number; color?: string; right?: string; icon?: IconName; light?: boolean }) {
  const pct = Math.max(0, Math.min(1, value / max));
  const anim = useState(() => new Animated.Value(0))[0];
  useEffect(() => {
    Animated.timing(anim, { toValue: pct, duration: 650, easing: Easing.out(Easing.cubic), useNativeDriver: false }).start();
  }, [pct, anim]);
  const textColor = colors.text;
  return (
    <View style={{ marginVertical: 3 }}>
      <Row style={{ justifyContent: 'space-between' }}>
        <Row gap={6}>
          {icon && <Icon name={icon} size={14} color={light ? '#ffffff' : color} />}
          <Text style={[styles.barLabel, { color: light ? 'rgba(255,255,255,0.9)' : colors.muted }]}>{label}</Text>
        </Row>
        <Text style={[styles.barValue, { color: textColor }]}>{right ?? Math.round(value)}</Text>
      </Row>
      <View style={[styles.barTrack, light && { backgroundColor: 'rgba(255,255,255,0.14)' }]}>
        <Animated.View style={{ width: anim.interpolate({ inputRange: [0, 1], outputRange: ['0%', '100%'] }), height: '100%', borderRadius: 3, backgroundColor: color }} />
      </View>
    </View>
  );
}

export function Pill({ label, color = colors.muted, icon, solid }: { label: string; color?: string; icon?: IconName; solid?: boolean }) {
  return (
    <View style={[styles.pill, { backgroundColor: solid ? color : alpha(color, 0.13), borderColor: alpha(color, solid ? 1 : 0.25) }]}>
      {icon && <Icon name={icon} size={12} color={solid ? onColor(color) : color} />}
      <Text style={[styles.pillText, { color: solid ? onColor(color) : shade(color, 0.15) }]}>{label}</Text>
    </View>
  );
}

export function Badge({ club, size = 36 }: { club: Club; size?: number }) {
  const [a, b] = club.colors;
  // Each crest needs its own gradient id: on web, hidden screens stay in the
  // DOM and a shared id would point at a gradient that is not rendered.
  // useId can contain characters that break url(#id), so they are stripped.
  const id = `crest${useId().replace(/[^a-zA-Z0-9]/g, '')}`;
  if (club.national) {
    return (
      <Svg width={size} height={size} viewBox="0 0 100 100">
        <Defs>
          <SvgGradient id={id} x1="0" y1="0" x2="1" y2="1">
            <Stop offset="0" stopColor={shade(a, 0.15)} />
            <Stop offset="1" stopColor={shade(a, -0.25)} />
          </SvgGradient>
        </Defs>
        <Circle cx={50} cy={50} r={46} fill={`url(#${id})`} stroke="rgba(255,255,255,0.85)" strokeWidth={5} />
        <Circle cx={50} cy={50} r={39} fill="none" stroke={b} strokeWidth={3} />
        <SvgText x={50} y={61} fontSize={28} fontFamily={fonts.display} fontWeight="bold" fill={b} textAnchor="middle">
          {club.short}
        </SvgText>
      </Svg>
    );
  }
  return (
    <Svg width={size * 0.86} height={size} viewBox="0 0 100 116">
      <Defs>
        <SvgGradient id={id} x1="0" y1="0" x2="0" y2="1">
          <Stop offset="0" stopColor={shade(a, 0.15)} />
          <Stop offset="1" stopColor={shade(a, -0.2)} />
        </SvgGradient>
      </Defs>
      <Path d="M50 3 L95 17 V58 C95 87 74 105 50 113 C26 105 5 87 5 58 V17 Z" fill={`url(#${id})`} stroke="rgba(255,255,255,0.85)" strokeWidth={6} strokeLinejoin="round" />
      <Path d="M50 14 L85 25 V58 C85 82 68 97 50 104 C32 97 15 82 15 58 V25 Z" fill="none" stroke={b} strokeWidth={3} />
      <SvgText x={50} y={72} fontSize={28} fontFamily={fonts.display} fontWeight="bold" fill={b} textAnchor="middle">
        {club.short.slice(0, 3)}
      </SvgText>
    </Svg>
  );
}

// Circular rating gauge.
export function RatingRing({ value, max = 99, size = 72, color = colors.accent, label = 'OVR', light }: { value: number; max?: number; size?: number; color?: string; label?: string; light?: boolean }) {
  const r = 42;
  const c = 2 * Math.PI * r;
  const pct = Math.max(0, Math.min(1, value / max));
  return (
    <View style={{ width: size, height: size, alignItems: 'center', justifyContent: 'center', backgroundColor: light ? 'rgba(0,0,0,0.28)' : colors.bgElev, borderRadius: size / 2 }}>
      <Svg width={size} height={size} viewBox="0 0 100 100" style={StyleSheet.absoluteFill}>
        <Circle cx={50} cy={50} r={r} stroke={light ? 'rgba(255,255,255,0.16)' : colors.border} strokeWidth={7} fill="none" />
        <Circle cx={50} cy={50} r={r} stroke={light ? colors.accent : color} strokeWidth={7} fill="none" strokeDasharray={`${c * pct} ${c}`} strokeLinecap="round" transform="rotate(-90 50 50)" />
      </Svg>
      <AnimatedNumber value={value} style={{ fontFamily: fonts.display, fontSize: size * 0.4, color: colors.text, lineHeight: size * 0.44 }} />
      <Text style={{ fontFamily: fonts.semibold, fontSize: 11.5, color: light ? 'rgba(255,255,255,0.7)' : colors.muted, letterSpacing: 1.2 }}>{label}</Text>
    </View>
  );
}

export function StatTile({ label, value, icon, color = colors.accent, light }: { label: string; value: string; icon: IconName; color?: string; light?: boolean }) {
  return (
    <View style={[styles.tile, light && { backgroundColor: 'rgba(0,0,0,0.22)', borderColor: 'rgba(255,255,255,0.1)' }]}>
      <Sticker icon={icon} color={color} size={28} />
      <Text style={[styles.tileValue, light && { color: '#ffffff' }]} numberOfLines={1}>
        {value}
      </Text>
      <Text style={[styles.tileLabel, light && { color: 'rgba(255,255,255,0.7)' }]}>{label}</Text>
    </View>
  );
}

export function Tabs<K extends string>({ tabs, value, onChange }: { tabs: { key: K; label: string }[]; value: K; onChange: (k: K) => void }) {
  return (
    <Row style={styles.tabs} gap={4}>
      {tabs.map((t) => {
        const active = value === t.key;
        return (
          <Pressable
            key={t.key}
            onPress={() => {
              haptic();
              onChange(t.key);
            }}
            accessibilityRole="tab"
            accessibilityState={{ selected: active }}
            style={[styles.tab, active && { borderBottomColor: colors.accent }]}
          >
            <Text style={[styles.tabText, active && { color: colors.text }]} numberOfLines={1}>
              {t.label}
            </Text>
          </Pressable>
        );
      })}
    </Row>
  );
}

export function Choice({ active, label, sub, onPress, half }: { active: boolean; label: string; sub?: string; onPress: () => void; half?: boolean }) {
  return (
    <Pressable
      onPress={() => {
        haptic();
        onPress();
      }}
      accessibilityRole="checkbox"
      accessibilityState={{ checked: active }}
      accessibilityLabel={sub ? `${label}. ${sub}` : label}
      style={({ pressed }) => [styles.choice, half && { minWidth: '45%', flexGrow: 1 }, active && styles.choiceActive, pressed && { transform: [{ scale: 0.97 }] }]}
    >
      <Row style={{ justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <View style={{ flex: 1 }}>
          <Text style={{ color: active ? colors.accent : colors.text, fontFamily: fonts.display, fontSize: 19, letterSpacing: 0.3 }}>{label}</Text>
          {sub ? <Text style={{ color: colors.muted, fontSize: 12.5, marginTop: 2, fontFamily: fonts.body }}>{sub}</Text> : null}
        </View>
        <Icon name={active ? 'checkmark-circle' : 'ellipse-outline'} size={22} color={active ? colors.accent : colors.faint} />
      </Row>
    </Pressable>
  );
}

export const inputStyle: TextStyle = {
  backgroundColor: colors.bgElev,
  color: colors.text,
  borderRadius: radius.md,
  borderWidth: 1,
  borderColor: colors.border,
  paddingHorizontal: 14,
  paddingVertical: 12,
  fontSize: 16,
  fontFamily: fonts.medium,
};

export function Divider() {
  return <View style={{ height: 1, backgroundColor: colors.border, marginVertical: space.sm }} />;
}

function toastIcon(text: string): { icon: IconName; color: string } {
  if (/level up/i.test(text)) return { icon: 'star', color: colors.gold };
  if (/season|summer/i.test(text)) return { icon: 'calendar', color: colors.blue };
  if (/signs|joined|sold|loan|interested/i.test(text)) return { icon: 'swap-horizontal', color: colors.accent };
  if (/cannot|not|refuse|tired|walk/i.test(text)) return { icon: 'alert-circle', color: colors.red };
  return { icon: 'notifications', color: colors.purple };
}

// A tappable toast. With href it is a call to action and tapping opens it.
export function Toast({ text, href, onClose }: { text: string | null; href?: string; onClose: () => void }) {
  const router = useRouter();
  // Sits above the tab bar and the home indicator on notched phones.
  const insets = useSafeAreaInsets();
  const y = useState(() => new Animated.Value(140))[0];
  useEffect(() => {
    if (text) Animated.spring(y, { toValue: 0, useNativeDriver: NATIVE, friction: 8, tension: 90 }).start();
    else y.setValue(140);
  }, [text, y]);
  if (!text) return null;
  const { icon, color } = href ? { icon: 'alert-circle' as IconName, color: colors.accent } : toastIcon(text);
  return (
    <Animated.View style={[styles.toastWrap, { bottom: 92 + insets.bottom, transform: [{ translateY: y }] }]}>
      <Pressable
        onPress={() => {
          onClose();
          if (href) router.navigate(href as never);
        }}
        style={styles.toast}
      >
        <View style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: 3, backgroundColor: color }} />
        <Sticker icon={icon} color={color} size={34} />
        <Text style={{ color: colors.text, fontSize: 13.5, flex: 1, fontFamily: fonts.body, lineHeight: 19 }}>{text}</Text>
        {href ? <Text style={{ color: colors.accent, fontFamily: fonts.semibold, fontSize: 12.5 }}>Open</Text> : <Icon name="close" size={16} color={colors.faint} />}
      </Pressable>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  header: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: space.lg, paddingVertical: space.sm, width: '100%', maxWidth: 600, alignSelf: 'center', minHeight: 56 },
  iconBtn: { width: 40, height: 40, borderRadius: 10, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.cardAlt, borderWidth: 1.5, borderColor: colors.borderStrong, borderBottomWidth: 3, borderBottomColor: '#0a0f18' },
  headerTitle: { flex: 1, color: colors.text, fontSize: 30, fontFamily: fonts.display, letterSpacing: 0.6, textTransform: 'uppercase' },
  scroll: { padding: space.lg, paddingTop: space.xs, paddingBottom: 64 },
  inner: { width: '100%', maxWidth: 600, alignSelf: 'center', gap: space.md },
  cardWrap: { borderRadius: radius.lg, backgroundColor: colors.card, overflow: 'hidden', borderWidth: 1.5, borderColor: colors.border, shadowColor: '#000', shadowOpacity: 0.45, shadowRadius: 0, shadowOffset: { width: 0, height: 3 }, elevation: 2 },
  cardInner: { padding: space.lg, gap: space.sm },
  h1: { color: colors.text, fontSize: 36, fontFamily: fonts.display, letterSpacing: 0.4 },
  h2: { color: colors.text, fontSize: 24, fontFamily: fonts.display, letterSpacing: 0.4 },
  section: { color: colors.muted, fontSize: 16, fontFamily: fonts.display, letterSpacing: 1, textTransform: 'uppercase' },
  t: { color: colors.text, fontSize: 14, lineHeight: 21, fontFamily: fonts.body },
  btn: { borderRadius: radius.md, paddingVertical: 12, paddingHorizontal: space.lg, alignItems: 'center', justifyContent: 'center', overflow: 'hidden', minHeight: 50 },
  btnSmall: { paddingVertical: 7, paddingHorizontal: space.md, minHeight: 40 },
  btnText: { fontSize: 20, fontFamily: fonts.display, textAlign: 'center', letterSpacing: 0.8, textTransform: 'uppercase' },
  btnSub: { fontSize: 11.5, marginTop: 0, fontFamily: fonts.medium },
  barLabel: { fontSize: 12.5, fontFamily: fonts.medium },
  barValue: { fontSize: 13, fontFamily: fonts.semibold },
  barTrack: { height: 8, backgroundColor: colors.bgElev, borderRadius: 3, overflow: 'hidden', marginTop: 5, borderWidth: 1, borderColor: colors.border },
  pill: { flexDirection: 'row', alignSelf: 'flex-start', alignItems: 'center', gap: 4, borderRadius: radius.sm, paddingHorizontal: 8, paddingVertical: 3, borderWidth: 1 },
  pillText: { fontSize: 11.5, fontFamily: fonts.semibold },
  tabs: { borderBottomWidth: 1.5, borderColor: colors.border },
  tab: { flex: 1, paddingVertical: 8, minHeight: 42, justifyContent: 'center', alignItems: 'center', borderBottomWidth: 3, borderBottomColor: 'transparent', marginBottom: -1.5 },
  tabText: { color: colors.muted, fontFamily: fonts.display, fontSize: 18, letterSpacing: 0.6, textTransform: 'uppercase' },
  choice: { borderWidth: 1.5, borderColor: colors.border, borderRadius: radius.md, padding: 12, backgroundColor: colors.bgElev },
  choiceActive: { borderColor: colors.accent, backgroundColor: alpha(colors.accent, 0.08) },
  tile: { flex: 1, backgroundColor: colors.bgElev, borderRadius: radius.md, borderWidth: 1.5, borderColor: colors.border, padding: 10, gap: 2, minWidth: 90, alignItems: 'flex-start' },
  tileValue: { color: colors.text, fontFamily: fonts.display, fontSize: 28 },
  tileLabel: { color: colors.muted, fontFamily: fonts.medium, fontSize: 11.5 },
  nav: { flexDirection: 'row', backgroundColor: '#121a28', borderTopWidth: 1.5, borderColor: colors.border, paddingHorizontal: 6, width: '100%', maxWidth: 600, alignSelf: 'center' },
  toastWrap: { position: 'absolute', left: space.lg, right: space.lg, bottom: 92, alignItems: 'center' },
  toast: { flexDirection: 'row', alignItems: 'center', gap: 12, width: '100%', maxWidth: 560, backgroundColor: colors.cardAlt, borderWidth: 1.5, borderColor: colors.borderStrong, borderRadius: radius.md, padding: 12, paddingLeft: 15, overflow: 'hidden', shadowColor: '#000', shadowOpacity: 0.5, shadowRadius: 0, shadowOffset: { width: 0, height: 4 }, elevation: 8 },
});
