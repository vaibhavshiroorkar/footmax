import React from 'react';
import { View } from 'react-native';
import { Game } from '../engine/types';
import { avgRating, formatMoney, fullName } from '../engine/player';
import { Card, H2, Row, T } from './kit';
import { careerStory, careerTotals } from '../engine/totals';

export function HistoryTable({ game, playerId }: { game: Game; playerId: string }) {
  const p = game.world.players[playerId];
  const rows = [...p.history];
  if (p.stats.apps) rows.push({ season: game.world.season, clubId: p.clubId ?? '', ...p.stats });
  if (!rows.length) return <T muted>No first-team games yet.</T>;
  return (
    <View>
      <Row style={{ paddingVertical: 4 }}>
        <T muted style={{ width: 48, fontSize: 12 }}>Year</T>
        <T muted style={{ flex: 1, fontSize: 12 }}>Club</T>
        <T muted style={{ width: 36, fontSize: 12, textAlign: 'right' }}>Apps</T>
        <T muted style={{ width: 36, fontSize: 12, textAlign: 'right' }}>Gls</T>
        <T muted style={{ width: 36, fontSize: 12, textAlign: 'right' }}>Ast</T>
        <T muted style={{ width: 40, fontSize: 12, textAlign: 'right' }}>Avg</T>
      </Row>
      {rows.map((h, i) => (
        <Row key={i} style={{ paddingVertical: 3 }}>
          <T style={{ width: 48, fontSize: 13 }}>{h.season}</T>
          <T style={{ flex: 1, fontSize: 13 }} >{game.world.clubs[h.clubId]?.name ?? '-'}</T>
          <T style={{ width: 36, fontSize: 13, textAlign: 'right' }}>{h.apps}</T>
          <T style={{ width: 36, fontSize: 13, textAlign: 'right' }}>{h.goals}</T>
          <T style={{ width: 36, fontSize: 13, textAlign: 'right' }}>{h.assists}</T>
          <T style={{ width: 40, fontSize: 13, textAlign: 'right' }}>{avgRating(h).toFixed(1)}</T>
        </Row>
      ))}
    </View>
  );
}

const ORDINAL = ['', '1st', '2nd', '3rd'];

export function CareerSummary({ game }: { game: Game }) {
  const c = game.career!;
  const p = game.world.players[c.playerId];
  const totals = careerTotals(game);
  const story = careerStory(game);
  const honours = game.world.honours.filter((h) => h.playerId === p.id);
  const clubTitles = game.world.honours.filter(
    (h) => h.clubId && h.title.endsWith('champions') && p.history.some((s) => s.season === h.season && s.clubId === h.clubId),
  );
  const span = (a: number, b: number) => (a === b ? `${a}` : `${a}-${String(b).slice(2)}`);
  return (
    <>
      <Card>
        <H2>{fullName(p)}</H2>
        <T muted>
          Retired at {p.age} after {totals.seasons} season{totals.seasons === 1 ? '' : 's'}. Peak level {totals.peakOvr}.
        </T>
        <T>
          {totals.apps} games, {totals.goals} goals, {totals.assists} assists. Average rating {story.avgRating.toFixed(2)}.
        </T>
        <T>
          {p.caps} international caps, {story.intlGoals} goals.
        </T>
        <T>Career earnings banked: {formatMoney(c.money)}.</T>
      </Card>
      <Card>
        <H2>Clubs</H2>
        {story.clubs.length === 0 && <T muted>No first-team games.</T>}
        {story.clubs.map((s, i) => (
          <Row key={i} style={{ paddingVertical: 3 }}>
            <T style={{ width: 64, fontSize: 13 }}>{span(s.from, s.to)}</T>
            <T style={{ flex: 1, fontSize: 13 }}>{s.name}</T>
            <T muted style={{ fontSize: 13 }}>
              {s.apps} games, {s.goals} goals
            </T>
          </Row>
        ))}
      </Card>
      <Card>
        <H2>Trophies and awards</H2>
        {clubTitles.length + honours.length + story.podiums.length === 0 ? <T muted>None this time. There is always the next career.</T> : null}
        {clubTitles.map((h, i) => (
          <T key={`c${i}`}>
            {h.season}: {h.title} with {h.winner}
          </T>
        ))}
        {honours.map((h, i) => (
          <T key={`h${i}`}>
            {h.season}: {h.title}
          </T>
        ))}
        {story.podiums
          .filter((x) => x.place > 1)
          .map((x, i) => (
            <T key={`p${i}`} muted>
              {x.season}: {x.award}, {ORDINAL[x.place]}
            </T>
          ))}
      </Card>
      {story.milestones.length > 0 && (
        <Card>
          <H2>Milestones</H2>
          <T>{story.milestones.join(', ')}.</T>
        </Card>
      )}
      <Card>
        <H2>Season by season</H2>
        <HistoryTable game={game} playerId={p.id} />
      </Card>
    </>
  );
}
