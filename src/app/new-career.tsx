import React, { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, Text, TextInput, View } from 'react-native';
import { usePreventRemove, useRouter } from 'expo-router';
import Svg, { Circle, Line, Rect } from 'react-native-svg';
import { useStore } from '../state/store';
import { Badge, Button, Card, Choice, H2, Icon, Pill, Row, Screen, StatTile, T, Tabs, haptic, inputStyle } from '../ui/kit';
import { NationPicker } from '../ui/shared';
import { Avatar, BOOT_COLORS, HAIR_COLORS, HAIR_STYLES, SKINS } from '../ui/avatar';
import { alpha, colors, fonts, ratingColor } from '../ui/theme';
import { generateWorld, newCareerGame, newSeed, starterClubs } from '../engine/game';
import { leagueOf } from '../engine/league';
import { nationById } from '../engine/generator';
import { ROLES, Role, rolesFor } from '../engine/roles';
import { ATTR_LABELS, overall } from '../engine/player';
import { Allocation, CELEBRATIONS, MAX_PER_ATTR, STAT_POINTS, STYLE_PRESETS, allocatable, applyAllocation, autoAllocate, pointsSpent, weakFootCost } from '../engine/creation';
import { Build, Look, Position, World } from '../engine/types';

const STEPS = ['Identity', 'Nation', 'Position', 'Body', 'Stats', 'Look', 'Club'];
const BUILDS: { key: Build; label: string; hint: string }[] = [
  { key: 'lean', label: 'Lean', hint: '+pace, +dribbling, -physical' },
  { key: 'athletic', label: 'Athletic', hint: 'Balanced, a little of everything' },
  { key: 'stocky', label: 'Stocky', hint: '+physical, -pace' },
];

function MiniPitch({ role, active }: { role: Role; active: boolean }) {
  const s = ROLES[role].spot;
  return (
    <Svg width={44} height={60} viewBox="0 0 44 60">
      <Rect x={1} y={1} width={42} height={58} rx={4} fill={colors.pitchDark} stroke="#ffffff55" strokeWidth={1} />
      <Line x1={1} y1={30} x2={43} y2={30} stroke="#ffffff44" strokeWidth={1} />
      <Circle cx={22} cy={30} r={6} stroke="#ffffff44" strokeWidth={1} fill="none" />
      <Circle cx={4 + s.x * 36} cy={56 - s.y * 52} r={5} fill={active ? colors.gold : colors.accent} stroke="#fff" strokeWidth={1} />
    </Svg>
  );
}

function Swatches({ list, value, onChange }: { list: string[]; value: number; onChange: (i: number) => void }) {
  return (
    <Row gap={8} style={{ flexWrap: 'wrap' }}>
      {list.map((c, i) => (
        <Pressable
          key={c}
          accessibilityRole="radio"
          accessibilityState={{ selected: value === i }}
          accessibilityLabel={`Colour ${i + 1}`}
          onPress={() => {
            haptic();
            onChange(i);
          }}
          style={{ width: 34, height: 34, borderRadius: 17, backgroundColor: c, borderWidth: 3, borderColor: value === i ? colors.accent : colors.border }}
        />
      ))}
    </Row>
  );
}

function Stepper({ value, onMinus, onPlus, label }: { value: string; onMinus: () => void; onPlus: () => void; label?: string }) {
  return (
    <Row gap={8}>
      {label && <T style={{ flex: 1 }}>{label}</T>}
      <Pressable onPress={onMinus} style={stepBtn} accessibilityRole="button" accessibilityLabel={`Less ${label ?? ''}`.trim()}>
        <Icon name="remove" size={16} />
      </Pressable>
      <Text style={{ minWidth: 54, textAlign: 'center', fontFamily: fonts.display, fontSize: 20, color: colors.text }}>{value}</Text>
      <Pressable onPress={onPlus} style={stepBtn} accessibilityRole="button" accessibilityLabel={`More ${label ?? ''}`.trim()}>
        <Icon name="add" size={16} />
      </Pressable>
    </Row>
  );
}
const stepBtn = { width: 40, height: 40, borderRadius: 12, backgroundColor: colors.cardAlt, borderWidth: 1, borderColor: colors.borderStrong, alignItems: 'center' as const, justifyContent: 'center' as const };

export default function NewCareer() {
  const router = useRouter();
  const setGame = useStore((s) => s.startGame);
  const customPack = useStore((s) => s.customPack);
  const [usePack, setUsePack] = useState(false);
  // The world takes a moment to build, so it is made after the first paint
  // instead of freezing the screen on open.
  const [world, setWorld] = useState<World | null>(null);
  const pack = usePack && customPack ? customPack : undefined;
  useEffect(() => {
    let live = true;
    const t = setTimeout(() => live && setWorld(generateWorld(newSeed(), pack)), 30);
    return () => {
      live = false;
      clearTimeout(t);
    };
  }, [pack]);
  const [step, setStep] = useState(0);
  const [first, setFirst] = useState('');
  const [last, setLast] = useState('');
  const [nickname, setNickname] = useState('');
  const [number, setNumber] = useState(9);
  const [nation, setNation] = useState('ENG');
  const [broad, setBroad] = useState<Position>('FWD');
  const [role, setRole] = useState<Role>('ST');
  const [foot, setFoot] = useState<'L' | 'R'>('R');
  const [weakFoot, setWeakFoot] = useState(2);
  const [height, setHeight] = useState(180);
  const [build, setBuild] = useState<Build>('athletic');
  const [styleId, setStyleId] = useState(STYLE_PRESETS.ST[0].id);
  const [alloc, setAlloc] = useState<Allocation>(() => autoAllocate('ST', STYLE_PRESETS.ST[0].weights, STAT_POINTS));
  const [look, setLook] = useState<Look>({ skin: 2, hair: 0, hairColor: 0, boots: 0 });
  const [celebration, setCelebration] = useState(CELEBRATIONS[0].id);
  const [clubId, setClubId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const body = { heightCm: height, build };
  const pool = STAT_POINTS - weakFootCost(weakFoot);
  const spent = pointsSpent(alloc, weakFoot);
  const attrs = useMemo(() => {
    try {
      return applyAllocation(role, body, alloc, weakFoot);
    } catch {
      return null;
    }
    // body is rebuilt each render from height and build.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [role, height, build, alloc, weakFoot]);
  const ovr = attrs ? overall({ attrs, position: ROLES[role].broad, role }) : 0;
  const clubs = useMemo(() => (step >= 6 && world ? starterClubs(world, nation) : []), [world, nation, step]);
  const kit: [string, string] = (world && clubId ? world.clubs[clubId]?.colors : undefined) ?? (world ? nationById(world, nation)?.colors : undefined) ?? ['#5b8cff', '#ffffff'];

  // Leaving part-way loses every choice, so ask first.
  const [leaving, setLeaving] = useState<{ repeat: () => void } | null>(null);
  const started = step > 0 || first.trim().length > 0;
  const allowLeave = usePreventRemove(started && !busy, ({ repeat }) => setLeaving({ repeat }));

  const applyStyle = (r: Role, id: string, wf = weakFoot) => {
    const preset = STYLE_PRESETS[r].find((s) => s.id === id) ?? STYLE_PRESETS[r][0];
    setStyleId(preset.id);
    setAlloc(autoAllocate(r, preset.weights, STAT_POINTS - weakFootCost(wf)));
  };
  const chooseRole = (r: Role) => {
    setRole(r);
    applyStyle(r, STYLE_PRESETS[r][0].id);
    if (r === 'GK') setNumber(1);
  };
  const setWF = (wf: number) => {
    const next = Math.max(1, Math.min(5, wf));
    setWeakFoot(next);
    applyStyle(role, styleId, next);
  };
  const bump = (k: keyof Allocation, d: number) => {
    const cur = alloc[k] ?? 0;
    const v = cur + d;
    if (v < 0 || v > MAX_PER_ATTR || (d > 0 && spent >= STAT_POINTS)) return;
    haptic();
    setAlloc({ ...alloc, [k]: v });
  };

  const canNext = step === 0 ? first.trim().length > 0 && last.trim().length > 0 : step === 4 ? spent <= STAT_POINTS && !!attrs : true;
  const start = () => {
    if (!world) return;
    setBusy(true);
    setTimeout(() => {
      const ok = setGame(
        newCareerGame(
          { firstName: first, lastName: last, nickname, number, nationId: nation, role, foot, weakFoot, heightCm: height, build, style: styleId, allocation: alloc, look, celebration, clubId: clubId ?? undefined },
          world,
        ),
      );
      if (!ok) {
        setBusy(false);
        useStore.getState().showToast('All save slots are in use. Delete a save on the title screen first.', '/');
        return;
      }
      allowLeave();
      router.replace('/career');
    }, 30);
  };

  return (
    <Screen title="New career">
      {leaving && (
        <Card glow={colors.gold}>
          <H2>Leave the creator?</H2>
          <T muted>Your player is not saved yet. Leaving now loses every choice.</T>
          <Row>
            <Button label="Keep going" variant="secondary" style={{ flex: 1 }} onPress={() => setLeaving(null)} />
            <Button
              label="Leave"
              variant="danger"
              style={{ flex: 1 }}
              onPress={() => {
                const go = leaving.repeat;
                setLeaving(null);
                allowLeave();
                go();
              }}
            />
          </Row>
        </Card>
      )}
      {/* Progress */}
      <View style={{ gap: 6 }}>
        <Row gap={4}>
          {STEPS.map((s, i) => (
            <View key={s} style={{ flex: 1, height: 4, borderRadius: 2, backgroundColor: i <= step ? colors.accent : colors.border }} />
          ))}
        </Row>
        <Row style={{ justifyContent: 'space-between' }}>
          <Text style={{ fontFamily: fonts.bold, fontSize: 11, color: colors.accent, letterSpacing: 1.2 }}>
            STEP {step + 1} OF {STEPS.length}: {STEPS[step].toUpperCase()}
          </Text>
          {step >= 2 && <Pill label={`${role}  |  OVR ${ovr || '-'}`} color={ratingColor(ovr)} icon="person" />}
        </Row>
      </View>

      {step === 0 && (
        <Card>
          <H2>Who are you?</H2>
          <TextInput keyboardAppearance="dark" selectionColor={colors.accent} style={inputStyle} placeholder="First name" placeholderTextColor={colors.faint} value={first} onChangeText={setFirst} maxLength={16} />
          <TextInput keyboardAppearance="dark" selectionColor={colors.accent} style={inputStyle} placeholder="Last name" placeholderTextColor={colors.faint} value={last} onChangeText={setLast} maxLength={18} />
          <TextInput keyboardAppearance="dark" selectionColor={colors.accent} style={inputStyle} placeholder="Nickname (optional)" placeholderTextColor={colors.faint} value={nickname} onChangeText={setNickname} maxLength={16} />
          <Stepper label="Shirt number" value={String(number)} onMinus={() => setNumber(number <= 1 ? 99 : number - 1)} onPlus={() => setNumber(number >= 99 ? 1 : number + 1)} />
        </Card>
      )}

      {step === 1 && (
        <Card>
          <H2>Your nation</H2>
          <T muted style={{ fontSize: 13 }}>
            You start at a smaller club in its league and can play for its national team.
          </T>
          {!world && <ActivityIndicator color={colors.accent} />}
          {world && <NationPicker world={world} value={nation} onChange={(id) => { setNation(id); setClubId(null); }} />}
        </Card>
      )}

      {step === 2 && (
        <Card>
          <H2>Your position</H2>
          <Tabs<Position>
            tabs={[
              { key: 'GK', label: 'Keeper' },
              { key: 'DEF', label: 'Defence' },
              { key: 'MID', label: 'Midfield' },
              { key: 'FWD', label: 'Attack' },
            ]}
            value={broad}
            onChange={(b) => {
              setBroad(b);
              chooseRole(rolesFor(b)[0]);
            }}
          />
          {rolesFor(broad).map((r) => {
            const active = role === r;
            return (
              <Pressable key={r} onPress={() => { haptic(); chooseRole(r); }} style={{ flexDirection: 'row', alignItems: 'center', gap: 12, padding: 10, borderRadius: 12, borderWidth: 1, borderColor: active ? colors.accent : colors.border, backgroundColor: active ? alpha(colors.accent, 0.08) : colors.bgElev }}>
                <MiniPitch role={r} active={active} />
                <View style={{ flex: 1 }}>
                  <Text style={{ fontFamily: fonts.display, fontSize: 20, color: active ? colors.accent : colors.text }}>
                    {r} <Text style={{ fontFamily: fonts.medium, fontSize: 13, color: colors.muted }}>{ROLES[r].label}</Text>
                  </Text>
                  <T muted style={{ fontSize: 12 }}>
                    Key: {Object.entries(ROLES[r].weights).sort((a, b) => (b[1] ?? 0) - (a[1] ?? 0)).slice(0, 3).map(([k]) => ATTR_LABELS[k as keyof typeof ATTR_LABELS]).join(', ')}
                  </T>
                </View>
                <Icon name={active ? 'checkmark-circle' : 'ellipse-outline'} size={20} color={active ? colors.accent : colors.faint} />
              </Pressable>
            );
          })}
          <T muted style={{ fontSize: 12 }}>
            You can learn a second position later in your career (level 6).
          </T>
        </Card>
      )}

      {step === 3 && (
        <Card>
          <H2>Body</H2>
          <T bold>Preferred foot</T>
          <Row>
            <Choice half active={foot === 'L'} label="Left" onPress={() => setFoot('L')} />
            <Choice half active={foot === 'R'} label="Right" onPress={() => setFoot('R')} />
          </Row>
          <T bold>Weak foot</T>
          <Row gap={6}>
            {[1, 2, 3, 4, 5].map((n) => (
              <Pressable key={n} onPress={() => setWF(n)} hitSlop={10} accessibilityRole="button" accessibilityLabel={`Weak foot ${n} star${n > 1 ? 's' : ''}`} accessibilityState={{ selected: weakFoot === n }}>
                <Icon name={n <= weakFoot ? 'star' : 'star-outline'} size={28} color={colors.gold} />
              </Pressable>
            ))}
          </Row>
          <T muted style={{ fontSize: 12 }}>
            Shots on your weaker foot lose accuracy. 2 stars is free; each extra star costs 4 stat points ({weakFootCost(weakFoot)} now).
          </T>
          <Stepper label="Height" value={`${height} cm`} onMinus={() => setHeight(Math.max(160, height - 2))} onPlus={() => setHeight(Math.min(204, height + 2))} />
          <T muted style={{ fontSize: 12 }}>
            Taller: stronger{role === 'GK' ? ' and better in goal' : ''}, a little slower and less nimble.
          </T>
          <T bold>Build</T>
          {BUILDS.map((b) => (
            <Choice key={b.key} active={build === b.key} label={b.label} sub={b.hint} onPress={() => setBuild(b.key)} />
          ))}
        </Card>
      )}

      {step === 4 && (
        <>
          <Card>
            <H2>Playing style</H2>
            {STYLE_PRESETS[role].map((s) => (
              <Choice key={s.id} active={styleId === s.id} label={s.label} sub={s.description} onPress={() => applyStyle(role, s.id)} />
            ))}
          </Card>
          <Card>
            <Row style={{ justifyContent: 'space-between' }}>
              <H2>Stat points</H2>
              <Pill label={`${STAT_POINTS - spent} left`} icon="sparkles" color={STAT_POINTS - spent > 0 ? colors.gold : colors.accent} />
            </Row>
            <Row gap={8}>
              <StatTile label="Overall" value={String(ovr)} icon="star" color={ratingColor(ovr)} />
              <StatTile label="Pool" value={String(pool)} icon="wallet" color={colors.purple} />
            </Row>
            {attrs &&
              allocatable(role).map((k) => (
                <Row key={k} gap={8}>
                  <View style={{ flex: 1 }}>
                    <Text style={{ fontFamily: fonts.medium, color: colors.text, fontSize: 13.5 }}>{ATTR_LABELS[k]}</Text>
                    <View style={{ height: 6, backgroundColor: colors.bgElev, borderRadius: 3, marginTop: 3, flexDirection: 'row', overflow: 'hidden' }}>
                      <View style={{ width: `${attrs[k] - (alloc[k] ?? 0)}%`, backgroundColor: colors.borderStrong }} />
                      <View style={{ width: `${alloc[k] ?? 0}%`, backgroundColor: colors.accent }} />
                    </View>
                  </View>
                  <Text style={{ width: 32, textAlign: 'right', fontFamily: fonts.display, fontSize: 18, color: ratingColor(attrs[k]) }}>{attrs[k]}</Text>
                  <Pressable onPress={() => bump(k, -1)} style={stepBtn} accessibilityRole="button" accessibilityLabel={`Remove a point from ${ATTR_LABELS[k]}`}>
                    <Icon name="remove" size={14} />
                  </Pressable>
                  <Pressable onPress={() => bump(k, 1)} style={stepBtn} accessibilityRole="button" accessibilityLabel={`Add a point to ${ATTR_LABELS[k]}`}>
                    <Icon name="add" size={14} />
                  </Pressable>
                </Row>
              ))}
            <Row>
              <Button label="Reset to style" icon="refresh" small variant="secondary" style={{ flex: 1 }} onPress={() => applyStyle(role, styleId)} />
              <Button label="Clear" icon="trash-outline" small variant="ghost" style={{ flex: 1 }} onPress={() => setAlloc({})} />
            </Row>
            <T muted style={{ fontSize: 12 }}>
              Up to {MAX_PER_ATTR} points per attribute. Training grows them from here.
            </T>
          </Card>
        </>
      )}

      {step === 5 && (
        <>
          <Card>
            <View style={{ alignItems: 'center' }}>
              <Avatar look={look} number={number} kit={kit} size={130} />
            </View>
            <T bold>Skin</T>
            <Swatches list={SKINS} value={look.skin} onChange={(i) => setLook({ ...look, skin: i })} />
            <T bold>Hair</T>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
              {HAIR_STYLES.map((h, i) => (
                <Choice key={h} half active={look.hair === i} label={h} onPress={() => setLook({ ...look, hair: i })} />
              ))}
            </View>
            <Swatches list={HAIR_COLORS} value={look.hairColor} onChange={(i) => setLook({ ...look, hairColor: i })} />
            <T bold>Boots</T>
            <Swatches list={BOOT_COLORS} value={look.boots} onChange={(i) => setLook({ ...look, boots: i })} />
          </Card>
          <Card>
            <H2>Goal celebration</H2>
            {CELEBRATIONS.map((c) => (
              <Choice key={c.id} active={celebration === c.id} label={c.label} onPress={() => setCelebration(c.id)} />
            ))}
          </Card>
        </>
      )}

      {step === 6 && (
        <>
          <Card glow={colors.accent}>
            <Row gap={14}>
              <Avatar look={look} number={number} kit={kit} size={72} />
              <View style={{ flex: 1 }}>
                <Text style={{ fontFamily: fonts.display, fontSize: 24, color: colors.text }}>
                  {first} {last}
                </Text>
                {nickname ? <T muted>{`"${nickname}"`}</T> : null}
                <T muted style={{ fontSize: 12.5 }}>
                  {ROLES[role].label}  |  {world ? nationById(world, nation)?.name : ''}  |  {height} cm, {build}  |  {foot === 'L' ? 'Left' : 'Right'} foot
                </T>
              </View>
              <Text style={{ fontFamily: fonts.display, fontSize: 34, color: ratingColor(ovr) }}>{ovr}</Text>
            </Row>
          </Card>
          <Card>
            <H2>Starter club</H2>
            <T muted style={{ fontSize: 13 }}>
              {clubs.length && world ? `${leagueOf(world, clubs[0])?.name}. Leave it on random for a surprise.` : ''}
            </T>
            <Choice active={clubId === null} label="Random" onPress={() => setClubId(null)} />
            {clubs.map((id) => {
              const c = world!.clubs[id];
              const active = clubId === id;
              return (
                <Pressable key={id} onPress={() => setClubId(id)} style={{ padding: 8, borderRadius: 10, borderWidth: 1, borderColor: active ? colors.accent : 'transparent', backgroundColor: active ? alpha(colors.accent, 0.08) : 'transparent' }}>
                  <Row>
                    <Badge club={c} size={30} />
                    <View style={{ flex: 1 }}>
                      <T bold={active}>{c.name}</T>
                      <T muted style={{ fontSize: 12 }}>
                        Reputation {c.reputation}
                      </T>
                    </View>
                  </Row>
                </Pressable>
              );
            })}
          </Card>
          {customPack && (
            <Card>
              <Choice active={usePack} label={`Use imported data pack: ${customPack.name}`} sub="Otherwise the built-in 2025/26 database is used." onPress={() => {
                // A different database has different clubs; the old pick would point at nothing.
                setUsePack(!usePack);
                setWorld(null);
                setClubId(null);
              }} />
            </Card>
          )}
        </>
      )}

      <Row>
        {step > 0 && <Button label="Back" icon="chevron-back" variant="secondary" style={{ flex: 1 }} onPress={() => setStep(step - 1)} />}
        {step < STEPS.length - 1 ? (
          <Button label="Next" icon="chevron-forward" style={{ flex: 2 }} disabled={!canNext} onPress={() => setStep(step + 1)} />
        ) : (
          <Button label={busy || !world ? 'Building the world...' : 'Start career'} icon="football" style={{ flex: 2 }} disabled={busy || !world} onPress={start} />
        )}
      </Row>
    </Screen>
  );
}
