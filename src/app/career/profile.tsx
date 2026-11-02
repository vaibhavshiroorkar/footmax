import React, { useState } from 'react';
import { Redirect, useRouter } from 'expo-router';
import { useGame, useStore } from '../../state/store';
import { GrowthChart, MilestonesPeek, ObjectivesCard } from '../../ui/progressCards';
import { LadderCard } from '../../ui/ladder';
import { retire, squadStatus } from '../../engine/career';
import { coachTrust, trustLabel } from '../../engine/relations';
import { formAverage } from '../../engine/lineup';
import { Button, Card, ConfirmButton, H2, Pill, Row, Screen, StatBar, T } from '../../ui/kit';
import { AttributeList, potentialLabel } from '../../ui/attributes';
import { HistoryTable } from '../../ui/careerSummary';
import { avgRating, fullName, marketValue, formatMoney, overall } from '../../engine/player';
import { careerRequest } from '../../engine/offers';
import { nationById } from '../../engine/generator';
import { colors } from '../../ui/theme';

export default function Profile() {
  const game = useGame();
  const mutate = useStore((s) => s.mutate);
  const router = useRouter();
  const [confirm, setConfirm] = useState(false);
  const [reply, setReply] = useState<string | null>(null);
  if (!game?.career) return <Redirect href="/" />;
  const p = game.world.players[game.career.playerId];
  const ovr = overall(p);
  const honours = game.world.honours.filter((h) => h.playerId === p.id);
  const form = formAverage(p);

  return (
    <Screen title={fullName(p)} nav="career">
      <LadderCard game={game} />
      <Card>
        <StatBar label="Fitness" icon="pulse" value={p.fitness} color={p.fitness < 50 ? colors.red : colors.green} />
        <StatBar label="Morale" icon="happy" value={p.morale} color={colors.gold} />
        <Row style={{ flexWrap: 'wrap' }} gap={6}>
          <Pill label={squadStatus(game)} icon="people" color={colors.muted} />
          {p.clubId && <Pill label={`Coach: ${trustLabel(coachTrust(game))}`} icon="person" color={colors.muted} />}
          {form !== null && <Pill label={`Form ${form.toFixed(1)}`} icon="pulse" color={form >= 7 ? colors.green : form < 6.2 ? colors.red : colors.gold} />}
          {p.clubId && <Pill label={`${formatMoney(p.wage)}/wk, ${p.contractYears} yr left`} icon="document-text" color={colors.muted} />}
          <Pill label={`Bank ${formatMoney(game.career.money)}`} icon="wallet" color={colors.green} />
          <Pill label={`Fame ${Math.round(game.career.fame)}`} icon="flame" color={colors.pink} />
        </Row>
      </Card>
      <ObjectivesCard game={game} />
      <MilestonesPeek game={game} />
      <GrowthChart game={game} />
      <Card>
        <Row style={{ justifyContent: 'space-between' }}>
          <T muted>Overall</T>
          <T bold>{ovr}</T>
        </Row>
        <Row style={{ justifyContent: 'space-between' }}>
          <T muted>Scouts say</T>
          <T bold>{potentialLabel(p, ovr)}</T>
        </Row>
        <Row style={{ justifyContent: 'space-between' }}>
          <T muted>Market value</T>
          <T bold>{formatMoney(marketValue(p))}</T>
        </Row>
        <Row style={{ justifyContent: 'space-between' }}>
          <T muted>Nation</T>
          <T bold>{nationById(game.world, p.nationId)?.name}</T>
        </Row>
        <Row style={{ justifyContent: 'space-between' }}>
          <T muted>Position</T>
          <T bold>
            {p.role ?? p.position}
            {p.secondaryRole ? ` / ${p.secondaryRole}` : ''}
            {p.style ? `, ${p.style.replace(/-/g, ' ')}` : ''}
          </T>
        </Row>
        {p.heightCm && (
          <Row style={{ justifyContent: 'space-between' }}>
            <T muted>Body</T>
            <T bold>
              {p.heightCm} cm, {p.build}, {p.foot === 'L' ? 'left' : 'right'} foot, weak foot {p.weakFoot ?? 2}/5
            </T>
          </Row>
        )}
        <Row style={{ justifyContent: 'space-between' }}>
          <T muted>International caps / goals</T>
          <T bold>
            {p.caps} / {p.intlGoals}
          </T>
        </Row>
      </Card>
      {p.clubId && (
        <Card>
          <H2>Talk to the club</H2>
          <T muted style={{ fontSize: 13 }}>
            One request every 6 weeks.
          </T>
          <Row style={{ flexWrap: 'wrap' }}>
            <Button label="Ask for a raise" small variant="secondary" onPress={() => setReply(mutate((g) => careerRequest(g, 'raise')))} />
            <ConfirmButton label="Ask to leave" confirmLabel="Sure? Tap again" small variant="secondary" onPress={() => setReply(mutate((g) => careerRequest(g, 'move')))} />
            <Button label="Ask for a loan" small variant="secondary" onPress={() => setReply(mutate((g) => careerRequest(g, 'loan')))} />
          </Row>
          {reply && <T style={{ color: colors.gold }}>{reply}</T>}
        </Card>
      )}
      <Card>
        <H2>Attributes</H2>
        <AttributeList p={p} />
      </Card>
      <Card>
        <H2>This season</H2>
        <T>
          {p.stats.apps} games, {p.stats.goals} goals, {p.stats.assists} assists, average rating {p.stats.apps ? avgRating(p.stats).toFixed(2) : '-'}
        </T>
      </Card>
      <Card>
        <H2>Career</H2>
        <HistoryTable game={game} playerId={p.id} />
      </Card>
      {honours.length > 0 && (
        <Card>
          <H2>Awards</H2>
          {honours.map((h, i) => (
            <T key={i}>
              {h.season}: {h.title}
            </T>
          ))}
        </Card>
      )}
      {p.age >= 30 && !confirm && <Button label="Retire" variant="danger" onPress={() => setConfirm(true)} />}
      {confirm && (
        <Card>
          <T>Hang up your boots? This ends the career.</T>
          <Row>
            <Button label="Not yet" variant="secondary" style={{ flex: 1 }} onPress={() => setConfirm(false)} />
            <Button
              label="Retire"
              variant="danger"
              style={{ flex: 1 }}
              onPress={() => {
                mutate((g) => retire(g));
                router.replace('/career');
              }}
            />
          </Row>
        </Card>
      )}
    </Screen>
  );
}
