import React from 'react';
import { Redirect } from 'expo-router';
import { useGame } from '../state/store';
import { Card, H2, Pill, Row, Screen, T } from '../ui/kit';
import { colors } from '../ui/theme';
import { Europe, europeStage, europeTable } from '../engine/europe';
import { teamById } from '../engine/lineup';
import { userTeamId } from '../engine/game';
import { Fixture, Game } from '../engine/types';

function TableRows({ game, ids, cut, top }: { game: Game; ids?: string[]; cut: number[]; top?: number }) {
  const world = game.world;
  const mine = userTeamId(game);
  const rows = europeTable(world, ids);
  const at = rows.findIndex((r) => r.clubId === mine);
  // A long table shows the top and the rows round your club.
  const shown = top && rows.length > top ? rows.filter((_, i) => i < top || (at >= 0 && Math.abs(i - at) <= 2)) : rows;
  return (
    <>
      {shown.map((r) => {
        const i = rows.indexOf(r);
        return (
          <Row key={r.clubId} style={{ paddingVertical: 2 }}>
            <T style={{ width: 26, fontSize: 13, color: i < cut[0] ? colors.accent : i < cut[1] ? colors.gold : colors.text }}>{i + 1}</T>
            <T style={{ flex: 1, fontSize: 13 }} bold={r.clubId === mine}>
              {teamById(world, r.clubId).name}
            </T>
            <T muted style={{ width: 60, fontSize: 12, textAlign: 'right' }}>
              {r.won}-{r.drawn}-{r.lost}
            </T>
            <T muted style={{ width: 36, fontSize: 12, textAlign: 'right' }}>
              {r.gd > 0 ? `+${r.gd}` : r.gd}
            </T>
            <T bold style={{ width: 30, fontSize: 13, textAlign: 'right' }}>
              {r.points}
            </T>
          </Row>
        );
      })}
    </>
  );
}

function Results({ game, fixtures }: { game: Game; fixtures: Fixture[] }) {
  const mine = userTeamId(game);
  const name = (id: string) => teamById(game.world, id).name;
  return (
    <>
      {fixtures.map((f) => (
        <Row key={f.id} style={{ paddingVertical: 2 }}>
          <T style={{ flex: 1, textAlign: 'right', fontSize: 13 }} bold={f.homeId === mine}>
            {name(f.homeId)}
          </T>
          <T bold style={{ width: 64, textAlign: 'center', fontSize: 13 }}>
            {f.played ? `${f.homeGoals}-${f.awayGoals}${f.penaltyWinner ? ' p' : ''}` : `Wk ${f.week}`}
          </T>
          <T style={{ flex: 1, fontSize: 13 }} bold={f.awayId === mine}>
            {name(f.awayId)}
          </T>
        </Row>
      ))}
    </>
  );
}

function status(game: Game, e: Europe): string {
  const mine = userTeamId(game);
  if (e.winner) return `Won by ${teamById(game.world, e.winner).name}`;
  if (!mine || !e.clubs.includes(mine)) return 'Your club is not in it this season';
  return europeStage(e.round);
}

export default function EuropeScreen() {
  const game = useGame();
  if (!game) return <Redirect href="/" />;
  const world = game.world;
  const e = world.europe;
  const mine = userTeamId(game);
  const past = world.honours.filter((h) => h.title === 'Champions League winners').reverse();
  if (!e) {
    return (
      <Screen title="Champions League">
        <Card>
          <H2>The draw comes in week 1</H2>
          <T muted>Clubs get in on last season&apos;s league table.</T>
        </Card>
      </Screen>
    );
  }
  const knockouts = ['Final', 'Semi-final', 'Quarter-final', 'Round of 16', 'Play-off', 'Qualifying'].filter((s) => e.fixtures.some((f) => f.stage === s));
  const myGames = e.fixtures.filter((f) => (f.homeId === mine || f.awayId === mine) && (f.stage === 'League phase' || f.stage === 'Group stage'));
  return (
    <Screen title="Champions League">
      <Card>
        <Row style={{ justifyContent: 'space-between' }}>
          <H2>
            {e.season}/{String(e.season + 1).slice(2)}
          </H2>
          <Pill label={status(game, e)} color={e.winner ? colors.gold : colors.accent} />
        </Row>
        <T muted style={{ fontSize: 13 }}>
          {e.format === 'league' ? '36 clubs in one table, eight games each. The top 8 go through, 9th to 24th play off.' : '32 clubs in eight groups. The top two go through.'}
        </T>
      </Card>
      {knockouts.map((stage) => (
        <Card key={stage}>
          <H2>{stage}</H2>
          <Results game={game} fixtures={e.fixtures.filter((f) => f.stage === stage)} />
        </Card>
      ))}
      {myGames.length > 0 && (
        <Card>
          <H2>Your games</H2>
          <Results game={game} fixtures={myGames} />
        </Card>
      )}
      {e.format === 'league' ? (
        <Card>
          <H2>League phase</H2>
          <TableRows game={game} cut={[8, 24]} top={12} />
        </Card>
      ) : (
        e.groups.map((g, i) => (
          <Card key={i}>
            <H2>Group {String.fromCharCode(65 + i)}</H2>
            <TableRows game={game} ids={g} cut={[2, 2]} />
          </Card>
        ))
      )}
      <Card>
        <H2>Past winners</H2>
        {past.length === 0 && <T muted>None yet in this save.</T>}
        {past.map((h) => (
          <T key={h.season} style={{ color: h.clubId === mine ? colors.gold : colors.text }}>
            {h.season}/{String(h.season + 1).slice(2)}: {h.winner}
          </T>
        ))}
      </Card>
    </Screen>
  );
}
