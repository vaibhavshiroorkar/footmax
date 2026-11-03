import React, { useState } from 'react';
import { Text, View } from 'react-native';
import { Redirect, useRouter } from 'expo-router';
import { useGame, useStore } from '../../state/store';
import { GrowthChart, MilestonesPeek, ObjectivesCard, SeasonReview } from '../../ui/progressCards';
import { LadderCard } from '../../ui/ladder';
import { ClaimCard } from '../../ui/playHub';
import { retire, squadStatus } from '../../engine/career';
import { formAverage } from '../../engine/lineup';
import { Button, Card, H2, IconButton, IconName, Icon, Pill, Row, Screen, StatBar, T } from '../../ui/kit';
import { potentialLabel } from '../../ui/attributes';
import { HistoryTable } from '../../ui/careerSummary';
import { fullName, marketValue, formatMoney, overall } from '../../engine/player';
import { nationById } from '../../engine/generator';
import { colors, fonts } from '../../ui/theme';

// Me: how you are doing, what to claim, how you have grown, who you are.
// Attributes live on Train; talking to the club lives on Clubs.
export default function Profile() {
  const game = useGame();
  const mutate = useStore((s) => s.mutate);
  const router = useRouter();
  const [confirm, setConfirm] = useState(false);
  if (!game?.career) return <Redirect href="/" />;
  const p = game.world.players[game.career.playerId];
  const ovr = overall(p);
  const honours = game.world.honours.filter((h) => h.playerId === p.id);
  const form = formAverage(p);
  const settings = <IconButton icon="settings-outline" label="Settings" onPress={() => router.push('/settings')} />;

  return (
    <Screen title={fullName(p)} nav="career" right={settings}>
      <LadderCard game={game} />
      <Card>
        <StatBar label="Fitness" icon="pulse" value={p.fitness} color={p.fitness < 50 ? colors.red : colors.green} />
        <StatBar label="Morale" icon="happy" value={p.morale} color={colors.gold} />
        <Row style={{ flexWrap: 'wrap' }} gap={6}>
          <Pill label={squadStatus(game)} icon="people" color={colors.muted} />
          {form !== null && <Pill label={`Form ${form.toFixed(1)}`} icon="pulse" color={form >= 7 ? colors.green : form < 6.2 ? colors.red : colors.gold} />}
          {p.clubId && <Pill label={`${formatMoney(p.wage)}/wk, ${p.contractYears} yr left`} icon="document-text" color={colors.muted} />}
        </Row>
      </Card>
      <ClaimCard game={game} />
      <SeasonReview game={game} />
      <ObjectivesCard game={game} compact />
      <GrowthChart game={game} />
      <Card>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', rowGap: 14 }}>
          <Fact icon="cash" label="Value" value={formatMoney(marketValue(p))} />
          <Fact icon="eye" label="Scouts" value={potentialLabel(p, ovr)} />
          <Fact icon="flag" label="Nation" value={nationById(game.world, p.nationId)?.name ?? '-'} />
          <Fact icon="locate" label="Position" value={`${p.role ?? p.position}${p.secondaryRole ? ` / ${p.secondaryRole}` : ''}`} />
          {p.heightCm ? <Fact icon="body" label="Body" value={`${p.heightCm} cm, ${p.foot === 'L' ? 'left' : 'right'} foot`} /> : null}
          <Fact icon="earth" label="Caps / goals" value={`${p.caps} / ${p.intlGoals}`} />
        </View>
      </Card>
      <MilestonesPeek game={game} />
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

// One fact in the two-column grid: a small label over the value.
function Fact({ icon, label, value }: { icon: IconName; label: string; value: string }) {
  return (
    <View style={{ width: '50%', paddingRight: 8, gap: 2 }}>
      <Row gap={5}>
        <Icon name={icon} size={12} color={colors.muted} />
        <Text style={{ fontFamily: fonts.semibold, fontSize: 10.5, letterSpacing: 1, color: colors.muted }}>{label.toUpperCase()}</Text>
      </Row>
      <Text style={{ fontFamily: fonts.semibold, fontSize: 14, color: colors.text }} numberOfLines={1}>
        {value}
      </Text>
    </View>
  );
}
