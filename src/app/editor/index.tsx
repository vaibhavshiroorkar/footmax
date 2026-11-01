import React, { useMemo, useState } from 'react';
import { Pressable, TextInput, View } from 'react-native';
import { useRouter } from 'expo-router';
import * as Clipboard from 'expo-clipboard';
import { useGame, useStore } from '../../state/store';
import { Badge, Button, Card, H2, Row, Screen, T, Tabs, inputStyle } from '../../ui/kit';
import { PlayerRow } from '../../ui/playerRow';
import { colors } from '../../ui/theme';
import { searchMarket } from '../../engine/transfers';
import { exportPack, parsePackText } from '../../engine/editor';
import { BUILTIN_PACK } from '../../data/builtin';
import { DataPack } from '../../data/pack';

type Tab = 'players' | 'clubs' | 'pack';

function packSummary(p: DataPack): string {
  const clubs = p.leagues.reduce((n, l) => n + l.clubs.length, 0) + p.otherClubs.reduce((n, o) => n + o.clubs.length, 0);
  const players = [...p.leagues.flatMap((l) => l.clubs), ...p.otherClubs.flatMap((o) => o.clubs)].reduce((n, c) => n + c.players.length, 0);
  return `${p.leagues.length} leagues, ${clubs} clubs, ${players} players`;
}

export default function Editor() {
  const game = useGame();
  const router = useRouter();
  const customPack = useStore((s) => s.customPack);
  const setCustomPack = useStore((s) => s.setCustomPack);
  const showToast = useStore((s) => s.showToast);
  const [tab, setTab] = useState<Tab>(game ? 'players' : 'pack');
  const [q, setQ] = useState('');
  const [paste, setPaste] = useState('');
  const [parsed, setParsed] = useState<{ pack?: DataPack; error?: string } | null>(null);

  const players = useMemo(() => (game && q.trim().length >= 2 ? searchMarket(game.world, null, { text: q }, 0, 40).rows : []), [game, q]);
  const clubs = useMemo(() => {
    if (!game || q.trim().length < 2) return [];
    const s = q.trim().toLowerCase();
    return [...Object.values(game.world.clubs), ...Object.values(game.world.nationalTeams)].filter((c) => c.name.toLowerCase().includes(s)).slice(0, 40);
  }, [game, q]);

  const copy = async (pack: DataPack, label: string) => {
    await Clipboard.setStringAsync(JSON.stringify(pack, null, 1));
    showToast(`${label} copied to the clipboard (${packSummary(pack)}). Paste it into a text editor, change it, and import it back.`);
  };

  return (
    <Screen title="Editor">
      <Tabs<Tab>
        tabs={[
          { key: 'players', label: 'Players' },
          { key: 'clubs', label: 'Clubs' },
          { key: 'pack', label: 'Data pack' },
        ]}
        value={tab}
        onChange={setTab}
      />
      {tab !== 'pack' && !game && (
        <Card>
          <T>Start or continue a game to edit its players and clubs. To change the database for new games, use the Data pack tab.</T>
        </Card>
      )}
      {tab === 'players' && game && (
        <>
          <TextInput style={inputStyle} placeholder="Search players by name" placeholderTextColor={colors.faint} value={q} onChangeText={setQ} />
          <Card>
            {q.trim().length < 2 && <T muted>Type at least two letters.</T>}
            {players.map(({ p }) => (
              <PlayerRow key={p.id} p={p} right="" note={p.clubId ? game.world.clubs[p.clubId]?.name : 'Free agent'} onPress={() => router.push(`/editor/player/${p.id}`)} />
            ))}
          </Card>
        </>
      )}
      {tab === 'clubs' && game && (
        <>
          <TextInput style={inputStyle} placeholder="Search clubs and national teams" placeholderTextColor={colors.faint} value={q} onChangeText={setQ} />
          <Card>
            {q.trim().length < 2 && <T muted>Type at least two letters.</T>}
            {clubs.map((c) => (
              <Pressable key={c.id} onPress={() => router.push(`/editor/club/${c.id}`)} style={{ paddingVertical: 6 }}>
                <Row>
                  <Badge club={c} size={28} />
                  <T style={{ flex: 1 }}>{c.name}</T>
                  <T muted style={{ fontSize: 12 }}>
                    rep {c.reputation}
                  </T>
                </Row>
              </Pressable>
            ))}
          </Card>
        </>
      )}
      {tab === 'pack' && (
        <>
          <Card>
            <H2>Database for new games</H2>
            <T muted style={{ fontSize: 13 }}>
              New careers and manager games are built from a data pack: leagues, clubs and players as JSON. The built-in pack covers the 2025/26 season with estimated ratings.
            </T>
            <T>In use: {customPack ? `${customPack.name} (${packSummary(customPack)})` : `Built-in (${packSummary(BUILTIN_PACK)})`}</T>
            {customPack && <Button label="Go back to the built-in pack" small variant="secondary" onPress={() => setCustomPack(null)} />}
          </Card>
          <Card>
            <H2>Export</H2>
            <Button label="Copy built-in pack" small variant="secondary" onPress={() => copy(BUILTIN_PACK, 'Built-in pack')} />
            {game && <Button label="Copy this save's world as a pack" small variant="secondary" onPress={() => copy(exportPack(game.world, `My world ${game.world.season}`), 'Your world')} />}
            <T muted style={{ fontSize: 12 }}>
              Players look like: {'{"name":"Bukayo Saka","pos":"FWD","nation":"ENG","born":2001,"ovr":88}'}. Use {'"!Name"'} for one-name players. Nation codes are three letters (ENG, BRA, KSA).
            </T>
          </Card>
          <Card>
            <H2>Import</H2>
            <TextInput
              style={[inputStyle, { minHeight: 120, textAlignVertical: 'top', fontSize: 12 }]}
              multiline
              placeholder="Paste a data pack (JSON) here"
              placeholderTextColor={colors.faint}
              value={paste}
              onChangeText={(t) => {
                setPaste(t);
                setParsed(null);
              }}
            />
            <Row>
              <Button label="Paste from clipboard" small variant="secondary" style={{ flex: 1 }} onPress={async () => setPaste(await Clipboard.getStringAsync())} />
              <Button label="Check" small style={{ flex: 1 }} disabled={!paste.trim()} onPress={() => setParsed(parsePackText(paste))} />
            </Row>
            {parsed?.error && <T style={{ color: colors.red }}>{parsed.error}</T>}
            {parsed?.pack && (
              <View style={{ gap: 6 }}>
                <T style={{ color: colors.accent }}>
                  Looks good: {parsed.pack.name}, {packSummary(parsed.pack)}.
                </T>
                <Button
                  label="Use this pack for new games"
                  onPress={async () => {
                    await setCustomPack(parsed.pack!);
                    setPaste('');
                    setParsed(null);
                    showToast('Data pack saved. Start a new career or manager game to use it.');
                  }}
                />
              </View>
            )}
          </Card>
        </>
      )}
    </Screen>
  );
}
