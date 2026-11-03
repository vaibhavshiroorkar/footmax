import React from 'react';
import { Redirect } from 'expo-router';
import { useGame } from '../state/store';
import { Card, H2, Screen, T } from '../ui/kit';
import { colors } from '../ui/theme';
import { Game } from '../engine/types';

export default function Honours() {
  const game = useGame();
  if (!game) return <Redirect href="/" />;
  return (
    <Screen title="Honours">
      <HonoursList game={game} />
    </Screen>
  );
}

// Every trophy and award by season, yours in gold. Also a tab in Awards.
export function HonoursList({ game }: { game: Game }) {
  const seasons = [...new Set(game.world.honours.map((h) => h.season))].sort((a, b) => b - a);
  const mine = new Set([game.career?.playerId, game.manager?.clubId].filter(Boolean) as string[]);

  return (
    <>
      {seasons.length === 0 && <T muted>Awards are handed out at the end of each season.</T>}
      {game.manager && game.manager.trophies.length > 0 && (
        <Card>
          <H2>Your trophies</H2>
          {game.manager.trophies.map((t, i) => (
            <T key={i}>{t}</T>
          ))}
        </Card>
      )}
      {seasons.map((s) => (
        <Card key={s}>
          <H2>{s}</H2>
          {game.world.honours
            .filter((h) => h.season === s)
            .map((h, i) => {
              const isMine = (h.playerId && mine.has(h.playerId)) || (h.clubId && mine.has(h.clubId));
              return (
                <T key={i} style={{ fontSize: 13, color: isMine ? colors.gold : colors.text }}>
                  {h.title}: {h.winner}
                </T>
              );
            })}
        </Card>
      ))}
    </>
  );
}
