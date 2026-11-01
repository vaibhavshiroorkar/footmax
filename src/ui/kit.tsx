import React, { ReactNode, useEffect, useRef, useState, useId } from 'react';
import { Animated, Easing, Platform, Pressable, ScrollView, StyleProp, StyleSheet, Text, TextStyle, View, ViewStyle } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import Svg, { Circle, Path, Text as SvgText, Defs, LinearGradient as SvgGradient, Stop } from 'react-native-svg';
import { usePathname, useRouter } from 'expo-router';
import { alpha, colors, fonts, gradients, onColor, radius, shade, space } from './theme';
import { Club } from '../engine/types';
import { useGame } from '../state/store';
import { navBadges } from '../engine/alerts';

export type IconName = React.ComponentProps<typeof Ionicons>['name'];
const NATIVE = Platform.OS !== 'web';

export function haptic(kind: 'light' | 'medium' | 'success' = 'light') {
  if (!NATIVE) return;
  try {
    if (kind === 'success') Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    else Haptics.impactAsync(kind === 'medium' ? Haptics.ImpactFeedbackStyle.Medium : Haptics.ImpactFeedbackStyle.Light);
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
    <View style={{ width: size, height: size, borderRadius: size * 0.3, backgroundColor: solid ? color : alpha(color, 0.14), borderWidth: 1, borderColor: alpha(color, solid ? 1 : 0.28), alignItems: 'center', justifyContent: 'center' }}>
      <Icon name={icon} size={size * 0.5} color={solid ? onColor(color) : color} />
    </View>
  );
}

// Fades and slides a block in; index staggers lists.
export function FadeIn({ children, index = 0, style }: { children: ReactNode; index?: number; style?: StyleProp<ViewStyle> }) {
  const v = useState(() => new Animated.Value(0))[0];
  useEffect(() => {
    Animated.timing(v, { toValue: 1, duration: 420, delay: Math.min(index, 12) * 50, easing: Easing.out(Easing.cubic), useNativeDriver: NATIVE }).start();
  }, [v, index]);
  return <Animated.View style={[style, { opacity: v, transform: [{ translateY: v.interpolate({ inputRange: [0, 1], outputRange: [12, 0] }) }] }]}>{children}</Animated.View>;
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

const CAREER_TABS: { href: string; icon: IconName; label: string; color: string }[] = [
  { href: '/career', icon: 'home', label: 'Home', color: colors.accent },
  { href: '/career/train', icon: 'barbell', label: 'Train', color: colors.accent },
  { href: '/career/skills', icon: 'sparkles', label: 'Skills', color: colors.accent },
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

function NavItem({ tab, active, onPress, badge }: { tab: (typeof CAREER_TABS)[number]; active: boolean; onPress: () => void; badge?: number }) {
  const s = useState(() => new Animated.Value(active ? 1 : 0))[0];
  useEffect(() => {
    Animated.spring(s, { toValue: active ? 1 : 0, useNativeDriver: NATIVE, friction: 7, tension: 140 }).start();
  }, [active, s]);
  const outline = `${tab.icon}-outline` as IconName;
  return (
    <Pressable onPress={onPress} style={{ flex: 1, alignItems: 'center', paddingTop: 10, paddingBottom: 8 }}>
      <Animated.View style={{ alignItems: 'center', transform: [{ scale: s.interpolate({ inputRange: [0, 1], outputRange: [1, 1.06] }) }] }}>
        <View style={{ width: 54, height: 30, borderRadius: 15, alignItems: 'center', justifyContent: 'center', backgroundColor: active ? alpha(tab.color, 0.14) : 'transparent' }}>
          <Icon name={active ? tab.icon : outline} size={21} color={active ? tab.color : colors.muted} />
        </View>
        {badge ? (
          <View style={{ position: 'absolute', top: -3, right: 6, minWidth: 17, height: 17, borderRadius: 9, backgroundColor: colors.red, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 4, borderWidth: 2, borderColor: colors.card }}>
            <Text style={{ color: '#fff', fontFamily: fonts.bold, fontSize: 9 }}>{badge > 99 ? '99' : badge}</Text>
          </View>
        ) : null}
      </Animated.View>
      <Text style={{ fontFamily: fonts.medium, fontSize: 10.5, color: active ? colors.text : colors.muted, marginTop: 3 }}>{tab.label}</Text>
    </Pressable>
  );
}

// Badges only count things the player has to act on (see engine/alerts).
export function BottomNav({ mode }: { mode: 'career' | 'manager' }) {
  const router = useRouter();
  const path = usePathname();
  const game = useGame();
  const badges = game ? navBadges(game) : undefined;
  const tabs = mode === 'career' ? CAREER_TABS : MANAGER_TABS;
  return (
    <View style={styles.nav}>
      {tabs.map((t) => (
        <NavItem
          key={t.href}
          tab={t}
          active={path === t.href}
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

// A soft blue light from the top of the screen. A gradient, not circles,
// so there are no hard edges.
function Glow() {
  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="none">
      <LinearGradient colors={[alpha(colors.blue, 0.16), alpha(colors.blue, 0.04), alpha(colors.blue, 0)]} locations={[0, 0.45, 1]} style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 460 }} />
    </View>
  );
}

export function Screen({ children, title, back = true, right, scroll = true, nav }: { children: ReactNode; title?: string; back?: boolean; right?: ReactNode; scroll?: boolean; nav?: 'career' | 'manager' }) {
  const router = useRouter();
  const body = <View style={styles.inner}>{children}</View>;
  return (
    <SafeAreaView style={styles.safe} edges={nav ? ['top', 'left', 'right', 'bottom'] : ['top', 'left', 'right']}>
      <LinearGradient colors={gradients.sky as unknown as [string, string]} style={StyleSheet.absoluteFill} />
      <Glow />
      {title !== undefined && (
        <View style={styles.header}>
          <View style={styles.side}>{back && !nav && <IconButton icon="chevron-back" onPress={() => (router.canGoBack() ? router.back() : router.replace('/'))} label="Back" />}</View>
          <Text style={styles.headerTitle} numberOfLines={1}>
            {title}
          </Text>
          <View style={[styles.side, { alignItems: 'flex-end' }]}>{right}</View>
        </View>
      )}
      {scroll ? (
        <ScrollView contentContainerStyle={[styles.scroll, nav && { paddingBottom: 24 }]} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
          {body}
        </ScrollView>
      ) : (
        <View style={[styles.scroll, { flex: 1 }]}>{body}</View>
      )}
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
      style={({ pressed }) => [styles.iconBtn, pressed && { transform: [{ scale: 0.9 }] }]}
    >
      <Icon name={icon} size={20} color={color} />
    </Pressable>
  );
}

export function Card({ children, style, gradient, glow, tint }: { children: ReactNode; style?: StyleProp<ViewStyle>; gradient?: readonly string[]; glow?: string; tint?: string }) {
  return (
    <View style={[styles.cardWrap, glow ? { borderColor: alpha(glow, 0.55) } : null, style]}>
      {gradient ? <LinearGradient colors={gradient as unknown as [string, string]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={StyleSheet.absoluteFill} /> : null}
      {glow && !gradient ? <LinearGradient colors={[alpha(glow, 0.12), alpha(glow, 0)]} start={{ x: 0, y: 0 }} end={{ x: 0, y: 0.8 }} style={StyleSheet.absoluteFill} /> : null}
      {tint ? <View style={[StyleSheet.absoluteFill, { backgroundColor: alpha(tint, 0.08) }]} /> : null}
      <View style={styles.cardSheen} pointerEvents="none" />
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
    <Row gap={6} style={{ marginTop: 6 }}>
      {icon && <Icon name={icon} size={14} color={colors.onBgMuted} />}
      <Text style={styles.section}>{children}</Text>
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

const FACES: Record<Exclude<Variant, 'ghost' | 'secondary'>, readonly string[]> = {
  primary: gradients.primary,
  danger: gradients.danger,
  gold: gradients.gold,
  blue: gradients.blue,
  purple: gradients.purple,
};

// Flat button with a soft press scale. Primary is the lime accent.
export function Button({ label, onPress, variant = 'primary', disabled, sub, style, small, icon }: { label: string; onPress: () => void; variant?: Variant; disabled?: boolean; sub?: string; style?: StyleProp<ViewStyle>; small?: boolean; icon?: IconName }) {
  const press = useState(() => new Animated.Value(0))[0];
  const to = (v: number) => Animated.spring(press, { toValue: v, useNativeDriver: NATIVE, speed: 60, bounciness: 6 }).start();
  const ghost = variant === 'ghost';
  const plain = variant === 'secondary';
  const face = ghost || plain ? null : FACES[variant];
  const fg = ghost ? colors.muted : plain ? colors.text : onColor(face![1]);
  return (
    <Animated.View style={[{ opacity: disabled ? 0.4 : 1, transform: [{ scale: press.interpolate({ inputRange: [0, 1], outputRange: [1, 0.97] }) }] }, style]}>
      <Pressable
        onPress={() => {
          haptic(face ? 'medium' : 'light');
          onPress();
        }}
        onPressIn={() => to(1)}
        onPressOut={() => to(0)}
        disabled={disabled}
        style={[styles.btn, small && styles.btnSmall, plain && styles.btnPlain, ghost && { backgroundColor: 'transparent' }, variant === 'primary' && !disabled && styles.btnGlow]}
      >
        {face && <LinearGradient colors={face as unknown as [string, string]} start={{ x: 0, y: 0 }} end={{ x: 0, y: 1 }} style={[StyleSheet.absoluteFill, { borderRadius: small ? 12 : radius.md }]} />}
        <Row gap={8} style={{ justifyContent: 'center' }}>
          {icon && <Icon name={icon} size={small ? 15 : 18} color={fg} />}
          <Text style={[styles.btnText, small && { fontSize: 15 }, { color: fg }]} numberOfLines={2}>
            {label}
          </Text>
        </Row>
        {sub ? <Text style={[styles.btnSub, { color: face ? alpha(fg, 0.75) : colors.muted }]}>{sub}</Text> : null}
      </Pressable>
    </Animated.View>
  );
}

export function Row({ children, style, gap = space.sm }: { children: ReactNode; style?: StyleProp<ViewStyle>; gap?: number }) {
  return <View style={[{ flexDirection: 'row', alignItems: 'center', gap }, style]}>{children}</View>;
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
        <Animated.View style={{ width: anim.interpolate({ inputRange: [0, 1], outputRange: ['0%', '100%'] }), height: '100%', borderRadius: 4, overflow: 'hidden' }}>
          <LinearGradient colors={[shade(color, -0.3), color]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={StyleSheet.absoluteFill} />
        </Animated.View>
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
      <Text style={{ fontFamily: fonts.semibold, fontSize: 8.5, color: light ? 'rgba(255,255,255,0.7)' : colors.muted, letterSpacing: 1.2 }}>{label}</Text>
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
            style={[styles.tab, active && { backgroundColor: colors.cardAlt, borderColor: colors.borderStrong }]}
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
      style={({ pressed }) => [styles.choice, half && { minWidth: '45%', flexGrow: 1 }, active && styles.choiceActive, pressed && { transform: [{ scale: 0.97 }] }]}
    >
      <Row style={{ justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <View style={{ flex: 1 }}>
          <Text style={{ color: active ? colors.accent : colors.text, fontFamily: fonts.displayBold, fontSize: 17, letterSpacing: 0.2 }}>{label}</Text>
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
  const y = useState(() => new Animated.Value(140))[0];
  useEffect(() => {
    if (text) Animated.spring(y, { toValue: 0, useNativeDriver: NATIVE, friction: 8, tension: 90 }).start();
    else y.setValue(140);
  }, [text, y]);
  if (!text) return null;
  const { icon, color } = href ? { icon: 'alert-circle' as IconName, color: colors.accent } : toastIcon(text);
  return (
    <Animated.View style={[styles.toastWrap, { transform: [{ translateY: y }] }]}>
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
  header: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: space.md, paddingVertical: space.sm, width: '100%', maxWidth: 600, alignSelf: 'center' },
  side: { width: 70 },
  iconBtn: { width: 40, height: 40, borderRadius: 12, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(255,255,255,0.05)', borderWidth: 1, borderColor: colors.border },
  headerTitle: { flex: 1, textAlign: 'center', color: colors.text, fontSize: 22, fontFamily: fonts.display, letterSpacing: 1.5, textTransform: 'uppercase' },
  scroll: { padding: space.lg, paddingTop: space.sm, paddingBottom: 64 },
  inner: { width: '100%', maxWidth: 600, alignSelf: 'center', gap: space.md },
  cardWrap: { borderRadius: radius.lg, backgroundColor: colors.card, overflow: 'hidden', borderWidth: 1, borderColor: colors.border, shadowColor: '#000', shadowOpacity: 0.35, shadowRadius: 18, shadowOffset: { width: 0, height: 10 }, elevation: 3 },
  cardSheen: { position: 'absolute', top: 0, left: 0, right: 0, height: 1, backgroundColor: 'rgba(255,255,255,0.06)' },
  cardInner: { padding: space.lg, gap: space.sm },
  h1: { color: colors.text, fontSize: 32, fontFamily: fonts.display, letterSpacing: 0.3 },
  h2: { color: colors.text, fontSize: 22, fontFamily: fonts.display, letterSpacing: 0.3 },
  section: { color: colors.muted, fontSize: 11, fontFamily: fonts.semibold, letterSpacing: 1.4, textTransform: 'uppercase' },
  t: { color: colors.text, fontSize: 14, lineHeight: 21, fontFamily: fonts.body },
  btn: { borderRadius: radius.md, paddingVertical: 14, paddingHorizontal: space.lg, alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  btnSmall: { paddingVertical: 9, paddingHorizontal: space.md, borderRadius: 12 },
  btnPlain: { backgroundColor: 'rgba(255,255,255,0.05)', borderWidth: 1, borderColor: colors.borderStrong },
  btnGlow: { shadowColor: colors.accent, shadowOpacity: 0.25, shadowRadius: 16, shadowOffset: { width: 0, height: 4 }, elevation: 4 },
  btnText: { fontSize: 18, fontFamily: fonts.display, textAlign: 'center', letterSpacing: 0.6, textTransform: 'uppercase' },
  btnSub: { fontSize: 11.5, marginTop: 1, fontFamily: fonts.body },
  barLabel: { fontSize: 12.5, fontFamily: fonts.body },
  barValue: { fontSize: 12.5, fontFamily: fonts.semibold },
  barTrack: { height: 8, backgroundColor: colors.bgElev, borderRadius: 4, overflow: 'hidden', marginTop: 5 },
  pill: { flexDirection: 'row', alignSelf: 'flex-start', alignItems: 'center', gap: 4, borderRadius: radius.pill, paddingHorizontal: 9, paddingVertical: 3, borderWidth: 1 },
  pillText: { fontSize: 11.5, fontFamily: fonts.medium },
  tabs: { backgroundColor: colors.card, borderRadius: radius.md, padding: 4, borderWidth: 1, borderColor: colors.border },
  tab: { flex: 1, paddingVertical: 8, borderRadius: 10, alignItems: 'center', borderWidth: 1, borderColor: 'transparent' },
  tabText: { color: colors.muted, fontFamily: fonts.medium, fontSize: 13 },
  choice: { borderWidth: 1, borderColor: colors.border, borderRadius: radius.md, padding: 12, backgroundColor: colors.bgElev },
  choiceActive: { borderColor: colors.accent, backgroundColor: alpha(colors.accent, 0.07) },
  tile: { flex: 1, backgroundColor: colors.bgElev, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border, padding: 10, gap: 4, minWidth: 90, alignItems: 'flex-start' },
  tileValue: { color: colors.text, fontFamily: fonts.display, fontSize: 24 },
  tileLabel: { color: colors.muted, fontFamily: fonts.body, fontSize: 11 },
  nav: { flexDirection: 'row', backgroundColor: 'rgba(17,23,37,0.97)', borderTopWidth: 1, borderColor: colors.border, paddingHorizontal: 6, width: '100%', maxWidth: 600, alignSelf: 'center' },
  toastWrap: { position: 'absolute', left: space.lg, right: space.lg, bottom: 92, alignItems: 'center' },
  toast: { flexDirection: 'row', alignItems: 'center', gap: 12, width: '100%', maxWidth: 560, backgroundColor: colors.cardAlt, borderWidth: 1, borderColor: colors.borderStrong, borderRadius: radius.md, padding: 12, paddingLeft: 15, overflow: 'hidden', shadowColor: '#000', shadowOpacity: 0.5, shadowRadius: 20, elevation: 8 },
});
