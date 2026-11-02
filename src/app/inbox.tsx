import React, { useEffect, useState } from 'react';
import { Pressable, Text, TextInput, View } from 'react-native';
import { Redirect } from 'expo-router';
import { useGame, useStore } from '../state/store';
import { Button, ConfirmButton, FadeIn, Icon, IconName, Pill, Row, Screen, SectionLabel, T, Tabs, inputStyle } from '../ui/kit';
import { alpha, colors, fonts } from '../ui/theme';
import { ActionType, Message } from '../engine/types';
import { respond } from '../engine/offers';
import { formatMoney } from '../engine/player';
import { actionMessages } from '../engine/alerts';

const KIND: Record<Message['kind'], { label: string; icon: IconName; color: string }> = {
  news: { label: 'News', icon: 'newspaper-outline', color: colors.blue },
  offer: { label: 'Offer', icon: 'briefcase-outline', color: colors.accent },
  season: { label: 'Season', icon: 'calendar-outline', color: colors.purple },
  media: { label: 'Media', icon: 'mic-outline', color: colors.pink },
  national: { label: 'National', icon: 'flag-outline', color: colors.gold },
};

type Filter = 'todo' | 'news';

const BIG_MOVES: ActionType[] = ['club-offer', 'loan-offer', 'job', 'nation-switch', 'nation-job'];

function deadline(weeksLeft: number | undefined): { text: string; urgent: boolean } | null {
  if (weeksLeft === undefined) return null;
  if (weeksLeft <= 0) return { text: 'Answer this week', urgent: true };
  return { text: `${weeksLeft + 1} weeks to answer`, urgent: weeksLeft <= 1 };
}

// A message that needs an answer: always open, with its choices.
function ActionCard({ m, index }: { m: Message; index: number }) {
  const mutate = useStore((s) => s.mutate);
  const showToast = useStore((s) => s.showToast);
  const [amount, setAmount] = useState('');
  const a = m.action!;
  const k = KIND[m.kind];
  const due = deadline(a.weeksLeft);
  // Money counters are typed in thousands to keep typing short.
  const isMoney = ['club-offer', 'renewal', 'sale-bid', 'sponsor', 'contract-demand'].includes(a.type);
  const current = a.fee ?? a.wage ?? a.weekly ?? 0;
  return (
    <FadeIn index={index}>
      <View style={{ backgroundColor: colors.card, borderRadius: 20, borderWidth: 1, borderColor: due?.urgent ? alpha(colors.gold, 0.5) : colors.border, overflow: 'hidden' }}>
        <View style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: 3, backgroundColor: due?.urgent ? colors.gold : k.color }} />
        <View style={{ padding: 16, paddingLeft: 18, gap: 10 }}>
          <Row gap={10} style={{ alignItems: 'flex-start' }}>
            <View style={{ width: 36, height: 36, borderRadius: 11, backgroundColor: alpha(k.color, 0.14), alignItems: 'center', justifyContent: 'center' }}>
              <Icon name={k.icon} size={18} color={k.color} />
            </View>
            <View style={{ flex: 1, gap: 3 }}>
              <Text style={{ fontFamily: fonts.display, fontSize: 19, color: colors.text, letterSpacing: 0.3 }}>{m.title}</Text>
              <T muted style={{ fontSize: 13, lineHeight: 19 }}>
                {m.body}
              </T>
            </View>
          </Row>
          {due && <Pill label={due.text} icon="time-outline" color={due.urgent ? colors.gold : colors.muted} />}
          {a.choices.some((c) => c.needsAmount) && isMoney && (
            <TextInput keyboardAppearance="dark" selectionColor={colors.accent}
              style={inputStyle}
              keyboardType="numeric"
              placeholder={`Counter in $K (now ${formatMoney(current)})`}
              placeholderTextColor={colors.faint}
              value={amount}
              onChangeText={(t) => setAmount(t.replace(/[^0-9]/g, ''))}
            />
          )}
          <Row style={{ flexWrap: 'wrap' }} gap={8}>
            {a.choices.map((c) => {
              const props = {
                label: c.label,
                small: true,
                variant: (c.id === 'accept' ? 'primary' : 'secondary') as 'primary' | 'secondary',
                style: { flexGrow: 1 },
                disabled: c.needsAmount && !amount,
                onPress: () => showToast(mutate((g) => respond(g, m.id, c.id, c.needsAmount ? Number(amount) * 1000 : undefined))),
              };
              // Moves and nationality switches are hard to undo: ask twice.
              return c.id === 'accept' && BIG_MOVES.includes(a.type) ? <ConfirmButton key={c.id} {...props} confirmLabel="Sure? Tap again" /> : <Button key={c.id} {...props} />;
            })}
          </Row>
        </View>
      </View>
    </FadeIn>
  );
}

// News and answered messages: one line, tap to read.
function FeedRow({ m }: { m: Message }) {
  const [open, setOpen] = useState(false);
  const k = KIND[m.kind];
  const a = m.action;
  const outcome = a?.resolved ? (a.resolved === 'accepted' ? 'Accepted' : a.resolved === 'expired' ? 'Expired' : a.resolved === 'rejected' ? 'Talks ended' : 'Answered') : null;
  return (
    <Pressable onPress={() => setOpen(!open)} style={({ pressed }) => ({ paddingVertical: 11, paddingHorizontal: 12, gap: 6, backgroundColor: pressed ? colors.cardAlt : 'transparent' })}>
      <Row gap={10}>
        <Icon name={k.icon} size={16} color={k.color} />
        <Text style={{ flex: 1, fontFamily: m.read ? fonts.body : fonts.medium, fontSize: 13.5, color: m.read ? colors.muted : colors.text }} numberOfLines={open ? undefined : 1}>
          {m.title}
        </Text>
        {outcome && <Text style={{ fontFamily: fonts.medium, fontSize: 11, color: colors.faint }}>{outcome}</Text>}
        <Text style={{ fontFamily: fonts.body, fontSize: 11, color: colors.faint }}>w{m.week}</Text>
      </Row>
      {open && (
        <T muted style={{ fontSize: 13, paddingLeft: 26, lineHeight: 19 }}>
          {m.body}
        </T>
      )}
    </Pressable>
  );
}

export default function Inbox() {
  const game = useGame();
  const todo = game ? actionMessages(game) : [];
  const [filter, setFilter] = useState<Filter>(todo.length ? 'todo' : 'news');
  const mutate = useStore((s) => s.mutate);
  // Opening the inbox counts as reading the news; only answers stay flagged.
  useEffect(() => {
    return () => {
      const g = useStore.getState().game;
      if (g?.inbox.some((m) => !m.read && !(m.action && !m.action.resolved))) mutate((x) => x.inbox.forEach((m) => !(m.action && !m.action.resolved) && (m.read = true)));
    };
  }, [mutate]);
  if (!game) return <Redirect href="/" />;
  const feed = game.inbox.filter((m) => !(m.action && !m.action.resolved));
  // Group the feed by season so long careers stay easy to scan.
  const seasons = [...new Set(feed.map((m) => m.season))];

  return (
    <Screen title="Inbox" nav={game.mode}>
      <Tabs<Filter>
        tabs={[
          { key: 'todo', label: todo.length ? `To do (${todo.length})` : 'To do' },
          { key: 'news', label: 'News' },
        ]}
        value={filter}
        onChange={setFilter}
      />
      {filter === 'todo' &&
        (todo.length ? (
          todo.map((m, i) => <ActionCard key={m.id} m={m} index={i} />)
        ) : (
          <View style={{ alignItems: 'center', gap: 8, paddingVertical: 40 }}>
            <View style={{ width: 64, height: 64, borderRadius: 20, backgroundColor: alpha(colors.accent, 0.12), alignItems: 'center', justifyContent: 'center' }}>
              <Icon name="checkmark-done" size={30} color={colors.accent} />
            </View>
            <Text style={{ fontFamily: fonts.display, fontSize: 22, color: colors.text, letterSpacing: 0.5, textTransform: 'uppercase' }}>All clear</Text>
            <T muted style={{ textAlign: 'center', fontSize: 13 }}>
              Nothing needs your answer. Offers, call-ups and requests land here.
            </T>
          </View>
        ))}
      {filter === 'news' &&
        (feed.length === 0 ? (
          <T muted>No news yet.</T>
        ) : (
          seasons.map((season) => (
            <View key={season} style={{ gap: 6 }}>
              <SectionLabel>{`Season ${season}/${String(season + 1).slice(2)}`}</SectionLabel>
              <View style={{ backgroundColor: colors.card, borderRadius: 18, borderWidth: 1, borderColor: colors.border, overflow: 'hidden' }}>
                {feed
                  .filter((m) => m.season === season)
                  .map((m, i) => (
                    <View key={m.id} style={i ? { borderTopWidth: 1, borderColor: colors.border } : undefined}>
                      <FeedRow m={m} />
                    </View>
                  ))}
              </View>
            </View>
          ))
        ))}
    </Screen>
  );
}
