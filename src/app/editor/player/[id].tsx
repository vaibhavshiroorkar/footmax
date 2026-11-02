import React, { useMemo, useState } from 'react';
import { Pressable, TextInput, View } from 'react-native';
import { Redirect, useLocalSearchParams, useRouter } from 'expo-router';
import { useGame, useStore } from '../../../state/store';
import { Button, Card, Choice, H2, Row, Screen, T, inputStyle } from '../../../ui/kit';
import { NationPicker } from '../../../ui/shared';
import { colors } from '../../../ui/theme';
import { overall } from '../../../engine/player';
import { editPlayer } from '../../../engine/editor';
import { Position } from '../../../engine/types';
import { useLeaveGuard } from '../../../ui/leaveGuard';
import { rolesFor } from '../../../engine/roles';

function Stepper({ label, value, onChange, min, max }: { label: string; value: number; onChange: (v: number) => void; min: number; max: number }) {
  return (
    <Row style={{ justifyContent: 'space-between' }}>
      <T>{label}</T>
      <Row>
        <Button label="-5" small variant="secondary" onPress={() => onChange(Math.max(min, value - 5))} />
        <Button label="-1" small variant="secondary" onPress={() => onChange(Math.max(min, value - 1))} />
        <T bold style={{ width: 36, textAlign: 'center' }}>
          {value}
        </T>
        <Button label="+1" small variant="secondary" onPress={() => onChange(Math.min(max, value + 1))} />
        <Button label="+5" small variant="secondary" onPress={() => onChange(Math.min(max, value + 5))} />
      </Row>
    </Row>
  );
}

export default function EditPlayer() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const game = useGame();
  const mutate = useStore((s) => s.mutate);
  const showToast = useStore((s) => s.showToast);
  const router = useRouter();
  const p = game?.world.players[id ?? ''];
  const [first, setFirst] = useState(p?.firstName ?? '');
  const [last, setLast] = useState(p?.lastName ?? '');
  const [nation, setNation] = useState(p?.nationId ?? 'ENG');
  const [pos, setPos] = useState<Position>(p?.position ?? 'MID');
  const [role, setRole] = useState<string | null>(p?.role ?? null);
  const [age, setAge] = useState(p?.age ?? 20);
  const [ovr, setOvr] = useState(p ? overall(p) : 60);
  const [pot, setPot] = useState(p?.potential ?? 60);
  const [clubQ, setClubQ] = useState('');
  const [clubId, setClubId] = useState<string | null>(p?.clubId ?? null);
  const clubs = useMemo(() => {
    if (!game || clubQ.trim().length < 2) return [];
    const s = clubQ.toLowerCase();
    return Object.values(game.world.clubs).filter((c) => c.name.toLowerCase().includes(s)).slice(0, 8);
  }, [game, clubQ]);
  const dirty = !!p && (first !== p.firstName || last !== p.lastName || nation !== p.nationId || pos !== p.position || role !== (p.role ?? null) || age !== p.age || ovr !== overall(p) || pot !== p.potential || clubId !== p.clubId);
  const guard = useLeaveGuard(dirty);
  if (!game || !p) return <Redirect href="/editor" />;
  const isUser = p.id === game.career?.playerId;

  return (
    <Screen title="Edit player">
      {guard.card}
      <Card>
        <H2>Name</H2>
        <TextInput keyboardAppearance="dark" selectionColor={colors.accent} style={inputStyle} value={first} onChangeText={setFirst} placeholder="First name (blank for one-name players)" placeholderTextColor={colors.faint} />
        <TextInput keyboardAppearance="dark" selectionColor={colors.accent} style={inputStyle} value={last} onChangeText={setLast} placeholder="Last name" placeholderTextColor={colors.faint} />
      </Card>
      <Card>
        <H2>Ratings</H2>
        <Stepper label="Overall" value={ovr} onChange={(v) => { setOvr(v); setPot(Math.max(pot, v)); }} min={20} max={99} />
        <Stepper label="Potential" value={pot} onChange={(v) => setPot(Math.max(v, ovr))} min={20} max={99} />
        <Stepper label="Age" value={age} onChange={setAge} min={15} max={45} />
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
          {(['GK', 'DEF', 'MID', 'FWD'] as Position[]).map((x) => (
            <Choice key={x} half active={pos === x} label={x} onPress={() => { setPos(x); setRole(null); }} />
          ))}
        </View>
        <T muted style={{ fontSize: 12 }}>Exact role (optional)</T>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
          <Choice half active={!role} label="None" onPress={() => setRole(null)} />
          {rolesFor(pos).map((r) => (
            <Choice key={r} half active={role === r} label={r} onPress={() => setRole(r)} />
          ))}
        </View>
      </Card>
      {!isUser && (
        <Card>
          <H2>Club</H2>
          <T muted>Now: {clubId ? game.world.clubs[clubId]?.name : 'Free agent'}</T>
          <TextInput keyboardAppearance="dark" selectionColor={colors.accent} style={inputStyle} value={clubQ} onChangeText={setClubQ} placeholder="Search for a new club" placeholderTextColor={colors.faint} />
          {clubs.map((c) => (
            <Pressable key={c.id} onPress={() => { setClubId(c.id); setClubQ(''); }} style={{ paddingVertical: 4 }}>
              <T style={{ color: colors.accent }}>{c.name}</T>
            </Pressable>
          ))}
          <Button label="Make free agent" small variant="ghost" onPress={() => setClubId(null)} />
        </Card>
      )}
      <Card>
        <H2>Nation</H2>
        <NationPicker world={game.world} value={nation} onChange={setNation} includeMinor />
      </Card>
      <Button
        label="Save changes"
        onPress={() => {
          mutate((g) => editPlayer(g.world, p.id, { firstName: first, lastName: last, nationId: nation, position: pos, role, age, overall: ovr, potential: pot, clubId: isUser ? undefined : clubId }));
          showToast('Player updated.');
          guard.allow();
          router.back();
        }}
      />
    </Screen>
  );
}
