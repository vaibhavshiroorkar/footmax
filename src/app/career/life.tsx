import React, { ReactNode, useEffect, useState } from 'react';
import { Animated, Easing, Pressable, Text, View, useWindowDimensions } from 'react-native';
import { Redirect } from 'expo-router';
import { useGame, useStore } from '../../state/store';
import { Button, Card, Icon, IconName, Pill, Row, Screen, StatBar, T, Tabs, haptic } from '../../ui/kit';
import { alpha, colors, fonts } from '../../ui/theme';
import { LIFE_ACTIONS, SHOP, buyItem, lifeAction } from '../../engine/career';
import { CASES, EquipItem, RARITY, SLOTS, Slot, equip, openCase, sell } from '../../engine/equipment';
import { ATTR_LABELS, formatMoney } from '../../engine/player';
import { Game } from '../../engine/types';

type Tab = 'week' | 'shop' | 'cases' | 'kit';

const ACTION_ICONS: Record<string, IconName> = { post: 'phone-portrait', charity: 'heart', night: 'moon', video: 'videocam' };
const SHOP_ICONS: Record<string, IconName> = { icebath: 'snow', media: 'mic', nutrition: 'nutrition', physio: 'medkit', trainer: 'barbell', agent: 'briefcase', car: 'car-sport', house: 'home' };
const CASE_COLORS: Record<string, string> = { bronze: '#c58a52', silver: '#cbd5e1', gold: colors.gold };

// Money's home, laid out as a store: tabs along the top, a details panel
// that keeps its size, and every item as a square tile. Tap a tile to see
// it in the panel and buy, do, open, wear or sell it there.
export default function Life() {
  const game = useGame();
  const [tab, setTab] = useState<Tab>('week');
  if (!game?.career) return <Redirect href="/" />;
  const c = game.career;

  return (
    <Screen title="Life" nav="career">
      <Card>
        <Row style={{ justifyContent: 'space-between' }}>
          <Row gap={8}>
            <Icon name="wallet" size={18} color={colors.gold} />
            <Text style={{ fontFamily: fonts.display, fontSize: 26, color: colors.text }}>{formatMoney(c.money)}</Text>
          </Row>
          <T muted style={{ fontSize: 12.5 }}>
            {c.sponsors.length ? `${c.sponsors.length} sponsor${c.sponsors.length > 1 ? 's' : ''}` : 'No sponsors yet'}
          </T>
        </Row>
        <StatBar label="Energy" icon="flash" value={c.energy} color={colors.blue} />
      </Card>
      <Tabs<Tab>
        tabs={[
          { key: 'week', label: 'This week' },
          { key: 'shop', label: 'Shop' },
          { key: 'cases', label: 'Cases' },
          { key: 'kit', label: 'Kit' },
        ]}
        value={tab}
        onChange={setTab}
      />
      {tab === 'week' && <WeekTab game={game} />}
      {tab === 'shop' && <ShopTab game={game} />}
      {tab === 'cases' && <CasesTab game={game} />}
      {tab === 'kit' && <KitTab game={game} />}
    </Screen>
  );
}

// Three tiles a row on a phone, four on anything wider.
function Grid({ children }: { children: ReactNode }) {
  return <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10 }}>{children}</View>;
}

function useTileWidth(): `${number}%` {
  const { width } = useWindowDimensions();
  return width >= 520 ? '23.3%' : '31.3%';
}

function Tile({ icon, color, title, foot, selected, dim, done, onPress }: { icon: IconName; color: string; title: string; foot: string; selected: boolean; dim?: boolean; done?: boolean; onPress: () => void }) {
  const width = useTileWidth();
  return (
    <Pressable
      onPress={() => {
        haptic();
        onPress();
      }}
      accessibilityRole="button"
      accessibilityState={{ selected }}
      accessibilityLabel={`${title}, ${foot}`}
      style={({ pressed }) => ({
        width,
        aspectRatio: 1,
        padding: 10,
        justifyContent: 'space-between',
        borderRadius: 12,
        borderWidth: 1.5,
        borderColor: selected ? color : colors.border,
        backgroundColor: selected ? alpha(color, 0.12) : pressed ? colors.cardAlt : colors.card,
        opacity: dim && !selected ? 0.6 : 1,
        transform: [{ scale: pressed ? 0.97 : 1 }],
      })}
    >
      <Row style={{ justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <View style={{ width: 36, height: 36, borderRadius: 10, alignItems: 'center', justifyContent: 'center', backgroundColor: alpha(color, 0.16) }}>
          <Icon name={icon} size={19} color={color} />
        </View>
        {done && <Icon name="checkmark-circle" size={18} color={colors.green} />}
      </Row>
      <View style={{ gap: 2 }}>
        <Text style={{ fontFamily: fonts.semibold, fontSize: 12.5, lineHeight: 15, color: colors.text }} numberOfLines={2}>
          {title}
        </Text>
        <Text style={{ fontFamily: fonts.display, fontSize: 16, color: done ? colors.green : color }} numberOfLines={1}>
          {foot}
        </Text>
      </View>
    </Pressable>
  );
}

// The details panel over the grid. It keeps its height whatever is in it.
function Panel({ icon, color, title, children }: { icon: IconName; color: string; title: string; children: ReactNode }) {
  return (
    <Card style={{ minHeight: 150 }}>
      <Row gap={10}>
        <View style={{ width: 40, height: 40, borderRadius: 11, alignItems: 'center', justifyContent: 'center', backgroundColor: alpha(color, 0.16) }}>
          <Icon name={icon} size={20} color={color} />
        </View>
        <Text style={{ flex: 1, fontFamily: fonts.display, fontSize: 21, color: colors.text }} numberOfLines={1}>
          {title}
        </Text>
      </Row>
      {children}
    </Card>
  );
}

function WeekTab({ game }: { game: Game }) {
  const mutate = useStore((s) => s.mutate);
  const toast = useStore((s) => s.showToast);
  const c = game.career!;
  const list = LIFE_ACTIONS.filter((a) => a.id !== 'rest');
  const [pick, setPick] = useState(list[0].id);
  const a = list.find((x) => x.id === pick) ?? list[0];
  return (
    <>
      <Panel icon={ACTION_ICONS[a.id] ?? 'star'} color={colors.blue} title={a.label}>
        <T muted style={{ fontSize: 13 }}>
          {a.description}
        </T>
        <Button label={c.energy < a.energy ? `Needs ${a.energy} energy` : `Do it  (${a.energy} energy)`} small disabled={c.energy < a.energy} onPress={() => toast(mutate((g) => lifeAction(g, a.id)).text)} />
      </Panel>
      <Grid>
        {list.map((x) => (
          <Tile key={x.id} icon={ACTION_ICONS[x.id] ?? 'star'} color={colors.blue} title={x.label} foot={`${x.energy} energy`} selected={x.id === a.id} dim={c.energy < x.energy} onPress={() => setPick(x.id)} />
        ))}
      </Grid>
      <Card>
        <Row gap={8}>
          <Icon name="ribbon" size={16} color={colors.gold} />
          <Text style={{ fontFamily: fonts.display, fontSize: 18, color: colors.text }}>Sponsors</Text>
        </Row>
        {c.sponsors.length === 0 ? (
          <T muted style={{ fontSize: 13 }}>
            Brands come calling once you have some fame.
          </T>
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
  );
}

function ShopTab({ game }: { game: Game }) {
  const mutate = useStore((s) => s.mutate);
  const toast = useStore((s) => s.showToast);
  const c = game.career!;
  const [pick, setPick] = useState(() => (SHOP.find((i) => !c.items.includes(i.id)) ?? SHOP[0]).id);
  const item = SHOP.find((i) => i.id === pick) ?? SHOP[0];
  const owned = c.items.includes(item.id);
  return (
    <>
      <Panel icon={SHOP_ICONS[item.id] ?? 'pricetag'} color={colors.gold} title={item.label}>
        <T muted style={{ fontSize: 13 }}>
          {item.description}
        </T>
        {owned ? (
          <Pill label="Owned" icon="checkmark-circle" color={colors.green} />
        ) : (
          <Button label={c.money < item.price ? `Need ${formatMoney(item.price)}` : `Buy for ${formatMoney(item.price)}`} small variant="gold" disabled={c.money < item.price} onPress={() => toast(mutate((g) => buyItem(g, item.id)).text)} />
        )}
      </Panel>
      <Grid>
        {SHOP.map((i) => {
          const mine = c.items.includes(i.id);
          return <Tile key={i.id} icon={SHOP_ICONS[i.id] ?? 'pricetag'} color={colors.gold} title={i.label} foot={mine ? 'Owned' : formatMoney(i.price)} selected={i.id === item.id} done={mine} dim={!mine && c.money < i.price} onPress={() => setPick(i.id)} />;
        })}
      </Grid>
    </>
  );
}

// The piece pops in when its case opens.
function Reveal({ children }: { children: ReactNode }) {
  const pop = useState(() => new Animated.Value(0.4))[0];
  useEffect(() => {
    Animated.timing(pop, { toValue: 1, duration: 380, easing: Easing.out(Easing.back(2)), useNativeDriver: false }).start();
  }, [pop]);
  return <Animated.View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, transform: [{ scale: pop }] }}>{children}</Animated.View>;
}

function rarityOdds(odds: Record<string, number>): string {
  return Object.entries(odds)
    .filter(([, v]) => v > 0)
    .map(([k, v]) => `${RARITY[k as keyof typeof RARITY].label} ${v}%`)
    .join('  |  ');
}

// Cases: pick one, open it in the panel, and the piece goes on if it beats
// what you wear.
function CasesTab({ game }: { game: Game }) {
  const mutate = useStore((s) => s.mutate);
  const toast = useStore((s) => s.showToast);
  const [pick, setPick] = useState(CASES[0].id);
  const [last, setLast] = useState<{ item: EquipItem; equipped: boolean; key: number } | null>(null);
  const c = game.career!;
  const cs = CASES.find((x) => x.id === pick) ?? CASES[0];
  const color = CASE_COLORS[cs.id] ?? colors.gold;
  return (
    <>
      <Panel icon="cube" color={color} title={cs.label}>
        {last ? (
          <Reveal key={last.key}>
            <View style={{ width: 44, height: 44, borderRadius: 12, alignItems: 'center', justifyContent: 'center', backgroundColor: alpha(RARITY[last.item.rarity].color, 0.2), borderWidth: 2, borderColor: RARITY[last.item.rarity].color }}>
              <Icon name={SLOTS[last.item.slot].icon as IconName} size={20} color={RARITY[last.item.rarity].color} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={{ fontFamily: fonts.display, fontSize: 17, color: RARITY[last.item.rarity].color }} numberOfLines={1}>
                {last.item.name}
              </Text>
              <T muted style={{ fontSize: 12 }}>
                {ATTR_LABELS[last.item.attr]} +{last.item.bonus}  |  {last.equipped ? 'On now' : 'In your kit bag'}
              </T>
            </View>
          </Reveal>
        ) : (
          <T muted style={{ fontSize: 12.5 }}>
            {rarityOdds(cs.odds)}
          </T>
        )}
        <Button
          label={c.money < cs.price ? `Need ${formatMoney(cs.price)}` : `Open for ${formatMoney(cs.price)}`}
          icon="sparkles"
          small
          variant="gold"
          disabled={c.money < cs.price}
          onPress={() => {
            const r = mutate((g) => openCase(g, cs.id));
            if (!r.ok || !r.item) return toast(r.text);
            haptic('success');
            setLast({ item: r.item, equipped: !!r.equipped, key: Date.now() });
          }}
        />
      </Panel>
      <Grid>
        {CASES.map((x) => (
          <Tile
            key={x.id}
            icon="cube"
            color={CASE_COLORS[x.id] ?? colors.gold}
            title={x.label}
            foot={formatMoney(x.price)}
            selected={x.id === cs.id}
            dim={c.money < x.price}
            onPress={() => {
              setPick(x.id);
              setLast(null);
            }}
          />
        ))}
      </Grid>
    </>
  );
}

// Kit: one tile per slot with what is worn; the panel lists the pieces for
// the chosen slot, to wear or sell.
function KitTab({ game }: { game: Game }) {
  const mutate = useStore((s) => s.mutate);
  const toast = useStore((s) => s.showToast);
  const c = game.career!;
  const worn = c.equipped ?? {};
  const bag = c.equipment ?? [];
  const slots = Object.keys(SLOTS) as Slot[];
  const [pick, setPick] = useState<Slot>(slots[0]);
  const mine = bag.filter((i) => i.slot === pick).sort((a, b) => b.bonus - a.bonus);
  const wornItem = (slot: Slot) => bag.find((i) => i.id === worn[slot]);
  return (
    <>
      <Panel icon={SLOTS[pick].icon as IconName} color={colors.purple} title={SLOTS[pick].label}>
        {mine.length === 0 && (
          <T muted style={{ fontSize: 13 }}>
            Nothing for this slot yet. Cases have it.
          </T>
        )}
        {mine.map((i) => {
          const on = worn[pick] === i.id;
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
                  <Button label="Wear" small variant="secondary" onPress={() => toast(mutate((g) => equip(g, i.id)))} />
                  <Button label={`Sell ${formatMoney(RARITY[i.rarity].sell)}`} small variant="ghost" onPress={() => toast(mutate((g) => sell(g, i.id)))} />
                </Row>
              )}
            </Row>
          );
        })}
      </Panel>
      <Grid>
        {slots.map((slot) => {
          const w = wornItem(slot);
          return <Tile key={slot} icon={SLOTS[slot].icon as IconName} color={w ? RARITY[w.rarity].color : colors.purple} title={SLOTS[slot].label} foot={w ? `${ATTR_LABELS[w.attr]} +${w.bonus}` : 'Empty'} selected={slot === pick} dim={!w} onPress={() => setPick(slot)} />;
        })}
      </Grid>
    </>
  );
}
