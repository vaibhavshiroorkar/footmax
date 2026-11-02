import React, { useState } from 'react';
import { Pressable, Text, TextInput, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useGame, useStore } from '../state/store';
import { Button, Card, FadeIn, Icon, IconName, Pill, Row, SectionLabel, Screen, T, haptic, inputStyle } from '../ui/kit';
import { PitchHero } from '../ui/pitchHero';
import { alpha, colors, fonts, onColor, teamColor } from '../ui/theme';
import { userFixture } from '../engine/game';
import { teamById } from '../engine/lineup';
import { Avatar } from '../ui/avatar';
import { MAX_SLOTS, SlotMeta } from '../state/slots';
import { exportSaveFile, pickSaveFile } from '../state/saveFiles';

function ago(t: number): string {
  const s = Math.max(0, Math.round((Date.now() - t) / 1000));
  if (s < 60) return 'just now';
  if (s < 3600) return `${Math.round(s / 60)} min ago`;
  if (s < 86400) return `${Math.round(s / 3600)} h ago`;
  return `${Math.round(s / 86400)} d ago`;
}

// Avatar for careers, a crest chip for manager saves.
function SlotFace({ slot, size }: { slot: SlotMeta; size: number }) {
  const kit = slot.crest?.colors ?? ['#5b8cff', '#ffffff'];
  if (slot.look) return <Avatar look={slot.look} number={slot.number} kit={kit} size={size} />;
  const base = teamColor(kit);
  return (
    <View style={{ width: size, height: size, borderRadius: size * 0.3, backgroundColor: alpha(base, 0.9), alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: 'rgba(255,255,255,0.15)' }}>
      {slot.crest ? (
        <Text style={{ fontFamily: fonts.display, fontSize: size * 0.32, color: onColor(base), letterSpacing: 0.5 }}>{slot.crest.short.slice(0, 3)}</Text>
      ) : (
        <Icon name="briefcase" size={size * 0.45} color={colors.muted} />
      )}
    </View>
  );
}

function SlotRow({ slot, current, index }: { slot: SlotMeta; current: boolean; index: number }) {
  const router = useRouter();
  const loadSlot = useStore((s) => s.loadSlot);
  const deleteSlot = useStore((s) => s.deleteSlot);
  const renameSlot = useStore((s) => s.renameSlot);
  const showToast = useStore((s) => s.showToast);
  const [menu, setMenu] = useState<'closed' | 'open' | 'rename' | 'delete'>('closed');
  const [name, setName] = useState(slot.name ?? slot.title);
  const [busy, setBusy] = useState(false);

  const open = async () => {
    if (busy) return;
    haptic();
    setBusy(true);
    const ok = await loadSlot(slot.id);
    setBusy(false);
    // loadSlot explains why in a toast.
    if (!ok) return;
    router.push(slot.mode === 'career' ? '/career' : '/manager');
  };

  return (
    <FadeIn index={index}>
      <View style={{ backgroundColor: colors.card, borderRadius: 18, borderWidth: 1, borderColor: current ? alpha(colors.accent, 0.45) : colors.border, overflow: 'hidden' }}>
        <Pressable onPress={open} style={({ pressed }) => ({ flexDirection: 'row', alignItems: 'center', gap: 12, padding: 12, backgroundColor: pressed ? colors.cardAlt : 'transparent' })}>
          <SlotFace slot={slot} size={46} />
          <View style={{ flex: 1, gap: 1 }}>
            <Row gap={6}>
              <Text style={{ fontFamily: fonts.display, fontSize: 19, color: colors.text, letterSpacing: 0.3, flexShrink: 1 }} numberOfLines={1}>
                {slot.name ?? slot.title}
              </Text>
              {current && <Pill label="Loaded" color={colors.accent} />}
            </Row>
            <Text style={{ fontFamily: fonts.body, fontSize: 12, color: colors.muted }} numberOfLines={1}>
              {slot.mode === 'career' ? 'Career' : 'Manager'}  |  {slot.detail}
            </Text>
            <Text style={{ fontFamily: fonts.body, fontSize: 11, color: colors.faint }}>
              {slot.when}  |  saved {ago(slot.updatedAt)}
            </Text>
          </View>
          {slot.rating !== undefined && (
            <View style={{ alignItems: 'center', minWidth: 34 }}>
              <Text style={{ fontFamily: fonts.display, fontSize: 24, color: colors.text }}>{slot.rating}</Text>
              <Text style={{ fontFamily: fonts.semibold, fontSize: 8, color: colors.muted, letterSpacing: 1 }}>OVR</Text>
            </View>
          )}
          <Pressable hitSlop={10} onPress={() => setMenu(menu === 'closed' ? 'open' : 'closed')} style={{ padding: 4 }} accessibilityLabel="Save options">
            <Icon name="ellipsis-vertical" size={18} color={colors.muted} />
          </Pressable>
        </Pressable>
        {menu === 'open' && (
          <Row style={{ paddingHorizontal: 12, paddingBottom: 12 }} gap={8}>
            <Button label="Rename" icon="pencil" small variant="secondary" style={{ flex: 1 }} onPress={() => setMenu('rename')} />
            <Button
              label="Export"
              icon="download-outline"
              small
              variant="secondary"
              style={{ flex: 1 }}
              onPress={async () => {
                const err = await exportSaveFile(slot.id, slot.name ?? slot.title);
                showToast(err ?? 'Save file exported. Keep it somewhere safe; Import loads it back.');
                setMenu('closed');
              }}
            />
            <Button label="Delete" icon="trash-outline" small variant="secondary" style={{ flex: 1 }} onPress={() => setMenu('delete')} />
          </Row>
        )}
        {menu === 'rename' && (
          <View style={{ paddingHorizontal: 12, paddingBottom: 12, gap: 8 }}>
            <TextInput style={inputStyle} value={name} onChangeText={setName} placeholder="Save name" placeholderTextColor={colors.faint} maxLength={32} autoFocus />
            <Row gap={8}>
              <Button label="Cancel" small variant="ghost" style={{ flex: 1 }} onPress={() => setMenu('closed')} />
              <Button
                label="Save name"
                small
                style={{ flex: 1 }}
                onPress={() => {
                  renameSlot(slot.id, name === slot.title ? '' : name);
                  setMenu('closed');
                }}
              />
            </Row>
          </View>
        )}
        {menu === 'delete' && (
          <View style={{ paddingHorizontal: 12, paddingBottom: 12, gap: 8 }}>
            <T muted style={{ fontSize: 13 }}>
              Delete this save for good? This cannot be undone.
            </T>
            <Row gap={8}>
              <Button label="Keep it" small variant="secondary" style={{ flex: 1 }} onPress={() => setMenu('closed')} />
              <Button
                label="Delete"
                small
                variant="danger"
                icon="trash"
                style={{ flex: 1 }}
                onPress={() => {
                  deleteSlot(slot.id);
                  setMenu('closed');
                }}
              />
            </Row>
          </View>
        )}
      </View>
    </FadeIn>
  );
}

function ModeCard({ icon, color, title, text, onPress, disabled }: { icon: IconName; color: string; title: string; text: string; onPress: () => void; disabled?: boolean }) {
  return (
    <Pressable
      disabled={disabled}
      onPress={() => {
        haptic();
        onPress();
      }}
      style={({ pressed }) => ({ flex: 1, minWidth: 150, opacity: disabled ? 0.4 : 1, transform: [{ scale: pressed ? 0.98 : 1 }] })}
    >
      <View style={{ backgroundColor: colors.card, borderRadius: 18, borderWidth: 1, borderColor: colors.border, padding: 14, gap: 10, height: '100%' }}>
        <View style={{ width: 40, height: 40, borderRadius: 12, backgroundColor: alpha(color, 0.14), alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: alpha(color, 0.3) }}>
          <Icon name={icon} size={20} color={color} />
        </View>
        <Text style={{ fontFamily: fonts.display, fontSize: 21, color: colors.text, letterSpacing: 0.4, textTransform: 'uppercase' }}>{title}</Text>
        <Text style={{ fontFamily: fonts.body, fontSize: 12.5, color: colors.muted, lineHeight: 17 }}>{text}</Text>
      </View>
    </Pressable>
  );
}

export default function Title() {
  const router = useRouter();
  const game = useGame();
  const slots = useStore((s) => s.slots);
  const slotId = useStore((s) => s.slotId);
  const current = slots.find((s) => s.id === slotId);
  const next = game ? userFixture(game) : undefined;
  const full = slots.length >= MAX_SLOTS;
  const startGame = useStore((s) => s.startGame);
  const showToast = useStore((s) => s.showToast);

  return (
    <Screen>
      <PitchHero height={current ? 200 : 280}>
        <Pill label="2025/26 database" color={colors.accent} icon="football" />
        <Text style={{ fontFamily: fonts.display, fontSize: 64, color: colors.text, lineHeight: 66, marginTop: 8, letterSpacing: 2 }} numberOfLines={1} adjustsFontSizeToFit>
          FOOT<Text style={{ color: colors.accent }}>MAX</Text>
        </Text>
        <Text style={{ fontFamily: fonts.body, fontSize: 14, color: colors.muted }}>From academy kid to legend. Or run the show from the dugout.</Text>
      </PitchHero>

      {game && current && (
        <FadeIn>
          <Card glow={colors.accent}>
            <Row gap={14}>
              <SlotFace slot={current} size={60} />
              <View style={{ flex: 1 }}>
                <Text style={{ fontFamily: fonts.semibold, fontSize: 10.5, color: colors.accent, letterSpacing: 1.4 }}>{game.mode === 'career' ? 'PLAYER CAREER' : 'MANAGER'}</Text>
                <Text style={{ fontFamily: fonts.display, fontSize: 28, color: colors.text, letterSpacing: 0.3 }} numberOfLines={1}>
                  {current.name ?? current.title}
                </Text>
                <T muted style={{ fontSize: 12.5, lineHeight: 17 }}>
                  {current.detail}. {current.when}
                </T>
              </View>
              {current.rating !== undefined && (
                <View style={{ alignItems: 'center' }}>
                  <Text style={{ fontFamily: fonts.display, fontSize: 38, color: colors.accent }}>{current.rating}</Text>
                  <Text style={{ fontFamily: fonts.semibold, fontSize: 9, color: colors.muted, letterSpacing: 1.2 }}>OVR</Text>
                </View>
              )}
            </Row>
            {next && (
              <Row style={{ backgroundColor: colors.bgElev, borderRadius: 12, padding: 10, justifyContent: 'center', borderWidth: 1, borderColor: colors.border }} gap={8}>
                <Icon name="football-outline" size={14} color={colors.accent} />
                <T style={{ fontSize: 13 }}>
                  Next: {teamById(game.world, next.homeId).name} vs {teamById(game.world, next.awayId).name}
                </T>
              </Row>
            )}
            <Button label="Continue" icon="play" onPress={() => router.push(game.mode === 'career' ? '/career' : '/manager')} />
          </Card>
        </FadeIn>
      )}

      {slots.length > 0 && (
        <>
          <Row style={{ justifyContent: 'space-between', marginTop: 6 }}>
            <SectionLabel icon="save-outline">Saved games</SectionLabel>
            <Text style={{ fontFamily: fonts.medium, fontSize: 11.5, color: full ? colors.gold : colors.muted, marginTop: 6 }}>
              {slots.length} of {MAX_SLOTS} slots
            </Text>
          </Row>
          {slots.map((s, i) => (
            <SlotRow key={s.id} slot={s} current={s.id === slotId} index={i} />
          ))}
        </>
      )}

      <SectionLabel icon="add-circle-outline">{slots.length ? 'New game' : 'Choose your path'}</SectionLabel>
      {full && (
        <Row gap={8} style={{ backgroundColor: alpha(colors.gold, 0.1), borderRadius: 12, padding: 10, borderWidth: 1, borderColor: alpha(colors.gold, 0.3) }}>
          <Icon name="information-circle" size={16} color={colors.gold} />
          <T style={{ fontSize: 12.5, flex: 1 }}>All {MAX_SLOTS} slots are in use. Delete a save to start a new game.</T>
        </Row>
      )}
      <Row gap={10} style={{ alignItems: 'stretch', flexWrap: 'wrap' }}>
        <ModeCard icon="person" color={colors.accent} title="Player career" text="Pick any nation, start small at home and earn your big move." onPress={() => router.push('/new-career')} disabled={full} />
        <ModeCard icon="clipboard" color={colors.blue} title="Manager" text="Run a real club, a national team or both. Buy anyone." onPress={() => router.push('/new-manager')} disabled={full} />
      </Row>
      <Button
        label="Import save file"
        icon="folder-open-outline"
        variant="secondary"
        small
        disabled={full}
        onPress={async () => {
          const r = await pickSaveFile();
          if (!r) return;
          if ('error' in r) return showToast(r.error);
          if (!startGame(r.game)) return showToast(`All ${MAX_SLOTS} slots are in use. Delete a save first.`);
          showToast('Save imported.');
          router.push(r.game.mode === 'career' ? '/career' : '/manager');
        }}
      />
      <Pressable onPress={() => router.push('/editor')} style={({ pressed }) => ({ opacity: pressed ? 0.7 : 1 })}>
        <Row gap={10} style={{ backgroundColor: colors.card, borderRadius: 18, borderWidth: 1, borderColor: colors.border, padding: 14 }}>
          <Icon name="create-outline" size={20} color={colors.purple} />
          <View style={{ flex: 1 }}>
            <Text style={{ fontFamily: fonts.medium, fontSize: 14, color: colors.text }}>Editor and data packs</Text>
            <Text style={{ fontFamily: fonts.body, fontSize: 12, color: colors.muted }}>Fix ratings, rename players, import your own database.</Text>
          </View>
          <Icon name="chevron-forward" size={18} color={colors.faint} />
        </Row>
      </Pressable>
      <View style={{ alignItems: 'center', gap: 6, marginTop: 8 }}>
        <Text style={{ fontFamily: fonts.body, fontSize: 11.5, color: colors.muted, textAlign: 'center', lineHeight: 16 }}>
          Unofficial fan game. Not affiliated with any league, club, federation or player.
        </Text>
        <Row gap={18}>
          <Text style={{ fontFamily: fonts.medium, fontSize: 12, color: colors.muted, paddingVertical: 8 }} onPress={() => router.push('/legal/privacy')}>
            Privacy
          </Text>
          <Text style={{ fontFamily: fonts.medium, fontSize: 12, color: colors.muted, paddingVertical: 8 }} onPress={() => router.push('/legal/terms')}>
            Terms
          </Text>
        </Row>
      </View>
    </Screen>
  );
}
