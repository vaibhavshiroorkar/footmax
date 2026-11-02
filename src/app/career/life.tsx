import React, { useState } from 'react';
import { Redirect } from 'expo-router';
import { useGame, useStore } from '../../state/store';
import { Button, Card, H2, Pill, Row, Screen, StatBar, T } from '../../ui/kit';
import { colors } from '../../ui/theme';
import { LIFE_ACTIONS, SHOP, buyItem, lifeAction } from '../../engine/career';
import { formatMoney } from '../../engine/player';

export default function Life() {
  const game = useGame();
  const mutate = useStore((s) => s.mutate);
  const [msg, setMsg] = useState<string | null>(null);
  if (!game?.career) return <Redirect href="/" />;
  const c = game.career;

  return (
    <Screen title="Life">
      <Card>
        <StatBar label="Energy" value={c.energy} color={colors.blue} />
        <Row style={{ justifyContent: 'space-between' }}>
          <T muted>Bank</T>
          <T bold>{formatMoney(c.money)}</T>
        </Row>
        {msg ? <T style={{ color: colors.accent }}>{msg}</T> : null}
      </Card>

      <H2>This week</H2>
      {LIFE_ACTIONS.map((a) => (
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

      <H2>Shop</H2>
      {SHOP.map((item) => {
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
            {!owned && <Button label="Buy" small variant="secondary" disabled={c.money < item.price} onPress={() => setMsg(mutate((g) => buyItem(g, item.id)).text)} />}
          </Card>
        );
      })}
    </Screen>
  );
}
