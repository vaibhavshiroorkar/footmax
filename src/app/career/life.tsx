import React, { useEffect, useState } from 'react';
import { Animated, Easing, Text, View } from 'react-native';
import { Redirect } from 'expo-router';
import { useGame, useStore } from '../../state/store';
import { Button, Card, H2, Icon, IconName, Pill, Row, Screen, StatBar, T, Tabs, haptic } from '../../ui/kit';
import { alpha, colors, fonts } from '../../ui/theme';
import { LIFE_ACTIONS, SHOP, buyItem, lifeAction } from '../../engine/career';
import { CASES, EquipItem, RARITY, SLOTS, Slot, equip, openCase, sell } from '../../engine/equipment';
import { ATTR_LABELS, formatMoney } from '../../engine/player';
import { Game } from '../../engine/types';

type Tab = 'week' | 'shop' | 'cases';

// Money's home: this week's activities, the shop, and cases of equipment.
export default function Life() {
  const game = useGame();
  const mutate = useStore((s) => s.mutate);
  // Results show as a toast at the top, so the cards never move.
  const setMsg = useStore((s) => s.showToast);
  const [tab, setTab] = useState<Tab>('week');
  if (!game?.career) return <Redirect href="/" />;
  const c = game.career;

  return (
    <Screen title="Life">
      <Card>
        <Row style={{ justifyContent: 'space-between' }}>
          <Row gap={8}>
            <Icon name="wallet" size={18} color={colors.gold} />
            <Text style={{ fontFamily: fonts.display, fontSize: 24, color: colors.text }}>{formatMoney(c.money)}</Text>
          </Row>
          <T muted style={{ fontSize: 12.5 }}>
            {c.sponsors.length ? `${c.sponsors.length} sponsor${c.sponsors.length > 1 ? 's' : ''}` : 'No sponsors yet'}
          </T>
        </Row>
        <StatBar label="Energy" value={c.energy} color={colors.blue} />
      </Card>
      <Tabs<Tab>
        tabs={[
          { key: 'week', label: 'This week' },
          { key: 'shop', label: 'Shop' },
          { key: 'cases', label: 'Cases' },
        ]}
        value={tab}
        onChange={setTab}
      />

      {tab === 'week' && (
        <>
          {LIFE_ACTIONS.filter((a) => a.id !== 'rest').map((a) => (
            <Card key={a.id}>
              <Row style={{ justifyContent: 'space-between' }}>
                <T bold>{a.label}</T>
                <Pill label={`${a.energy} energy`} color={colors.blue} />
              </Row>
              <T muted style={{ fontSize: 13 }}>
                {a.description}
              </T>
              <Button label="Do it" small variant="secondary" disabled={c.energy < a.energy} onPress={() => setMsg(mutate((g) => lifeAction(g, a.id)).text)} />
            </Card>
          ))}
          <H2>Sponsors</H2>
          <Card>
            {c.sponsors.length === 0 ? (
              <T muted>No sponsors yet. Brands come calling once you have some fame.</T>
            ) : (
              c.sponsors.map((s) => (
                <Row key={s.name} style={{ justifyContent: 'space-between' }}>
                  <T>{s.name}</T>
                  <T muted>
                    {formatMoney(s.weekly)}/wk, {s.weeksLeft} wk left
                  </T>
                </Row>
              ))
            )}
          </Card>
        </>
      )}

      {tab === 'shop' &&
        SHOP.map((item) => {
          const owned = c.items.includes(item.id);
          return (
            <Card key={item.id}>
              <Row style={{ justifyContent: 'space-between' }}>
                <T bold>{item.label}</T>
                {owned ? <Pill label="Owned" color={colors.green} /> : <T bold>{formatMoney(item.price)}</T>}
              </Row>
              <T muted style={{ fontSize: 13 }}>
                {item.description}
              </T>
              {!owned && <Button label={c.money < item.price ? `Need ${formatMoney(item.price)}` : 'Buy'} small variant="secondary" disabled={c.money < item.price} onPress={() => setMsg(mutate((g) => buyItem(g, item.id)).text)} />}
            </Card>
          );
        })}

      {tab === 'cases' && <Cases game={game} />}
    </Screen>
  );
}

// The piece pops in when its case opens.
function Reveal({ children }: { children: React.ReactNode }) {
  const pop = useState(() => new Animated.Value(0.4))[0];
  useEffect(() => {
    Animated.timing(pop, { toValue: 1, duration: 380, easing: Easing.out(Easing.back(2)), useNativeDriver: false }).start();
  }, [pop]);
  return <Animated.View style={{ alignItems: 'center', gap: 4, transform: [{ scale: pop }] }}>{children}</Animated.View>;
}

function rarityOdds(odds: Record<string, number>): string {
  return Object.entries(odds)
    .filter(([, v]) => v > 0)
    .map(([k, v]) => `${RARITY[k as keyof typeof RARITY].label} ${v}%`)
    .join('  |  ');
}

// Cases: buy one, it opens in the reveal panel (which keeps its size), and
// the piece goes on if it beats what you wear.
function Cases({ game }: { game: Game }) {
  const mutate = useStore((s) => s.mutate);
  const showToast = useStore((s) => s.showToast);
  const [last, setLast] = useState<{ item: EquipItem; equipped: boolean; key: number } | null>(null);
  const c = game.career!;
  const worn = c.equipped ?? {};
  const list = c.equipment ?? [];
  return (
    <>
      {/* The reveal: always this size, empty until a case is opened. */}
      <Card glow={last ? RARITY[last.item.rarity].color : undefined} style={{ minHeight: 112, alignItems: 'center', justifyContent: 'center' }}>
        {last ? (
          <Reveal key={last.key}>
            <View style={{ width: 52, height: 52, borderRadius: 14, alignItems: 'center', justifyContent: 'center', backgroundColor: alpha(RARITY[last.item.rarity].color, 0.2), borderWidth: 2, borderColor: RARITY[last.item.rarity].color }}>
              <Icon name={SLOTS[last.item.slot].icon as IconName} size={24} color={RARITY[last.item.rarity].color} />
            </View>
            <Text style={{ fontFamily: fonts.display, fontSize: 18, color: RARITY[last.item.rarity].color }} numberOfLines={1}>
              {last.item.name}
            </Text>
            <T muted style={{ fontSize: 12.5 }}>
              {ATTR_LABELS[last.item.attr]} +{last.item.bonus}  |  {last.equipped ? 'On now' : 'Kept in your bag'}
            </T>
          </Reveal>
        ) : (
          <T muted style={{ textAlign: 'center' }}>Open a case to see what is inside.</T>
        )}
      </Card>
      {CASES.map((cs) => (
        <Card key={cs.id}>
          <Row style={{ justifyContent: 'space-between' }}>
            <Row gap={8}>
              <Icon name="cube" size={18} color={cs.id === 'gold' ? colors.gold : cs.id === 'silver' ? '#cbd5e1' : '#c58a52'} />
              <T bold>{cs.label}</T>
            </Row>
            <T bold>{formatMoney(cs.price)}</T>
          </Row>
          <T muted style={{ fontSize: 12 }}>
            {rarityOdds(cs.odds)}
          </T>
          <Button
            label={c.money < cs.price ? `Need ${formatMoney(cs.price)}` : 'Open'}
            icon="sparkles"
            small
            variant={cs.id === 'gold' ? 'gold' : 'secondary'}
            disabled={c.money < cs.price}
            onPress={() => {
              const r = mutate((g) => openCase(g, cs.id));
              if (!r.ok || !r.item) return showToast(r.text);
              haptic('success');
              setLast({ item: r.item, equipped: !!r.equipped, key: Date.now() });
            }}
          />
        </Card>
      ))}
      <H2>Your kit</H2>
      {(Object.keys(SLOTS) as Slot[]).map((slot) => {
        const mine = list.filter((i) => i.slot === slot).sort((a, b) => b.bonus - a.bonus);
        if (!mine.length) return null;
        return (
          <Card key={slot}>
            <Row gap={8}>
              <Icon name={SLOTS[slot].icon as IconName} size={16} color={colors.muted} />
              <T bold>{SLOTS[slot].label}</T>
            </Row>
            {mine.map((i) => {
              const on = worn[slot] === i.id;
              return (
                <Row key={i.id} style={{ justifyContent: 'space-between' }} gap={8}>
                  <View style={{ flex: 1, minWidth: 0 }}>
                    <Text style={{ fontFamily: fonts.semibold, fontSize: 13, color: RARITY[i.rarity].color }} numberOfLines={1}>
                      {i.name}
                    </Text>
                    <T muted style={{ fontSize: 11.5 }}>
                      {ATTR_LABELS[i.attr]} +{i.bonus}
                    </T>
                  </View>
                  {on ? (
                    <Pill label="On" icon="checkmark-circle" color={colors.green} />
                  ) : (
                    <Row gap={6}>
                      <Button label="Wear" small variant="secondary" onPress={() => showToast(mutate((g) => equip(g, i.id)))} />
                      <Button label={`Sell ${formatMoney(RARITY[i.rarity].sell)}`} small variant="ghost" onPress={() => showToast(mutate((g) => sell(g, i.id)))} />
                    </Row>
                  )}
                </Row>
              );
            })}
          </Card>
        );
      })}
    </>
  );
}
