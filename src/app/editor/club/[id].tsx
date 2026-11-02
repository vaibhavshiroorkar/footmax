import React, { useState } from 'react';
import { TextInput, View } from 'react-native';
import { Redirect, useLocalSearchParams, useRouter } from 'expo-router';
import { useGame, useStore } from '../../../state/store';
import { Badge, Button, Card, H2, Row, Screen, T, inputStyle } from '../../../ui/kit';
import { colors } from '../../../ui/theme';
import { editClub } from '../../../engine/editor';

const HEX = /^#[0-9a-f]{6}$/i;

export default function EditClub() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const game = useGame();
  const mutate = useStore((s) => s.mutate);
  const showToast = useStore((s) => s.showToast);
  const router = useRouter();
  const club = game ? game.world.clubs[id ?? ''] ?? game.world.nationalTeams[id ?? ''] : undefined;
  const [name, setName] = useState(club?.name ?? '');
  const [short, setShort] = useState(club?.short ?? '');
  const [rep, setRep] = useState(club?.reputation ?? 50);
  const [c1, setC1] = useState(club?.colors[0] ?? '#ffffff');
  const [c2, setC2] = useState(club?.colors[1] ?? '#000000');
  if (!game || !club) return <Redirect href="/editor" />;
  const preview = { ...club, name, short: short.toUpperCase(), colors: [HEX.test(c1) ? c1 : club.colors[0], HEX.test(c2) ? c2 : club.colors[1]] as [string, string] };

  return (
    <Screen title="Edit club">
      <Card>
        <Row>
          <Badge club={preview} size={52} />
          <T bold style={{ fontSize: 18 }}>
            {name}
          </T>
        </Row>
        <H2>Name</H2>
        <TextInput style={inputStyle} value={name} onChangeText={setName} placeholder="Club name" placeholderTextColor={colors.faint} />
        <TextInput style={inputStyle} value={short} onChangeText={setShort} maxLength={4} placeholder="Short name (3-4 letters)" placeholderTextColor={colors.faint} />
      </Card>
      <Card>
        <H2>Reputation</H2>
        <Row style={{ justifyContent: 'space-between' }}>
          <Button label="-5" small variant="secondary" onPress={() => setRep(Math.max(10, rep - 5))} />
          <T bold style={{ fontSize: 22 }}>{rep}</T>
          <Button label="+5" small variant="secondary" onPress={() => setRep(Math.min(99, rep + 5))} />
        </Row>
        <T muted style={{ fontSize: 12 }}>
          Reputation sets budgets, income, board targets and which players want to join.
        </T>
      </Card>
      {!club.national && (
        <Card>
          <H2>Colours</H2>
          <View style={{ gap: 6 }}>
            <TextInput style={inputStyle} value={c1} onChangeText={setC1} placeholder="#rrggbb" placeholderTextColor={colors.faint} autoCapitalize="none" />
            <TextInput style={inputStyle} value={c2} onChangeText={setC2} placeholder="#rrggbb" placeholderTextColor={colors.faint} autoCapitalize="none" />
          </View>
        </Card>
      )}
      <Button
        label="Save changes"
        onPress={() => {
          if (!club.national && !(HEX.test(c1) && HEX.test(c2))) {
            showToast('Colours must look like #1a2b3c (a # and six hex digits).');
            return;
          }
          mutate((g) => editClub(g.world, club.id, { name, short, reputation: rep, colors: [c1, c2] }));
          showToast('Club updated.');
          router.back();
        }}
      />
    </Screen>
  );
}
