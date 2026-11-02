import React from 'react';
import { Text, View } from 'react-native';
import { Redirect, useRouter } from 'expo-router';
import { useGame } from '../../state/store';
import { Button, Card, FadeIn, IconButton, Pill, RatingRing, Row, Screen, StatBar, StatTile, T } from '../../ui/kit';
import { FixtureCard, MatchdayButton } from '../../ui/shared';
import { TeamHero } from '../../ui/hero';
import { colors, fonts } from '../../ui/theme';
import { formatMoney, fullName, overall } from '../../engine/player';
import { squadStatus } from '../../engine/career';
import { xpForLevel } from '../../engine/skills';
import { nationById } from '../../engine/generator';
import { CareerSummary } from '../../ui/careerSummary';
import { Avatar } from '../../ui/avatar';
import { formAverage } from '../../engine/lineup';
import { coachTrust, trustLabel } from '../../engine/relations';
import { upgradeCount } from '../../engine/alerts';
import { FirstRunTips } from '../../ui/firstRunTips';
import { MilestonesPeek, ObjectivesCard, SeasonReview } from '../../ui/progressCards';
import { LadderCard } from '../../ui/ladder';

export default function CareerHub() {
  const game = useGame();
  const router = useRouter();
  if (!game || game.mode !== 'career' || !game.career) return <Redirect href="/" />;
  const c = game.career;
  const world = game.world;
  const p = world.players[c.playerId];
  const club = p.clubId ? world.clubs[p.clubId] : null;
  const nation = nationById(world, p.nationId);
  const inSquad = !!nation && world.nationalTeams[nation.teamId]?.playerIds.includes(p.id);
  const ovr = overall(p);
  const form = formAverage(p);
  const trust = coachTrust(game);
  const upgrades = upgradeCount(game);
  const menu = <IconButton icon="home" label="Menu" onPress={() => router.replace('/')} />;

  if (c.retired) {
    return (
      <Screen title="Career over" back={false} right={menu}>
        <CareerSummary game={game} />
        <Button label="Back to menu" icon="home" onPress={() => router.replace('/')} />
      </Screen>
    );
  }

  return (
    <Screen title="FootMax" back={false} right={menu} nav="career">
      <FadeIn>
        <TeamHero
          club={club}
          kicker={`${p.role ?? p.position}${p.secondaryRole ? `/${p.secondaryRole}` : ''}  |  Age ${p.age}  |  ${nation?.name ?? ''}`}
          title={c.nickname ? `${fullName(p)} "${c.nickname}"` : fullName(p)}
          subtitle={club ? `${club.name}${p.loan ? ' (on loan)' : ''}` : 'Free agent'}
          portrait={c.look ? <Avatar look={c.look} number={c.number} kit={club?.colors ?? ['#2f7bff', '#ffffff']} size={68} /> : undefined}
          right={<RatingRing value={ovr} light />}
        >
          <Row style={{ flexWrap: 'wrap' }} gap={6}>
            <Pill label={squadStatus(game)} icon="people" color="#ffffff" />
            {p.clubId && <Pill label={`Coach: ${trustLabel(trust)}`} icon="person" color="#ffffff" />}
            {form !== null && <Pill label={`Form ${form.toFixed(1)}`} icon="pulse" color="#ffffff" />}
            {inSquad && <Pill label={`${nation!.name} squad`} icon="flag" color={colors.gold} solid />}
            {p.injuryWeeks > 0 && <Pill label={`Injured ${p.injuryWeeks}w`} icon="medkit" color={colors.red} solid />}
          </Row>
          <Row gap={8}>
            <StatTile light label="Bank" value={formatMoney(c.money)} icon="wallet" color={colors.accent} />
            <StatTile light label="Fame" value={String(Math.round(c.fame))} icon="flame" color={colors.pink} />
            <StatTile light label="Level" value={String(c.level)} icon="star" color={colors.gold} />
          </Row>
          <StatBar light label={`XP to level ${c.level + 1}${upgrades ? `  |  ${upgrades} upgrade${upgrades > 1 ? 's' : ''} ready` : ''}`} icon="sparkles" value={c.xp} max={xpForLevel(c.level)} color={colors.gold} right={`${c.xp}/${xpForLevel(c.level)}`} />
        </TeamHero>
      </FadeIn>

      <FirstRunTips />
      <SeasonReview game={game} />

      <FadeIn index={1}>
        <FixtureCard game={game} clubId={p.clubId} />
      </FadeIn>
      {!p.clubId && (
        <Card glow={colors.gold}>
          <Text style={{ fontFamily: fonts.display, fontSize: 18, color: colors.text }}>No club right now</Text>
          <T muted>Offers land in your inbox, or pitch yourself on the Clubs screen. Keep training to stay sharp.</T>
        </Card>
      )}
      <FadeIn index={2}>
        <MatchdayButton game={game} />
      </FadeIn>
      <FadeIn index={3}>
        <LadderCard game={game} />
      </FadeIn>

      <FadeIn index={3}>
        <Card>
          <StatBar label="Energy this week" icon="battery-charging" value={c.energy} color={colors.blue} />
          <StatBar label="Fitness" icon="pulse" value={p.fitness} color={p.fitness < 50 ? colors.red : colors.accent} />
          <StatBar label="Morale" icon="happy" value={p.morale} color={colors.gold} />
          <Row style={{ justifyContent: 'space-between' }}>
            <T muted>Contract</T>
            <T bold>{p.clubId ? `${formatMoney(p.wage)}/wk, ${p.contractYears} yr left` : 'None'}</T>
          </Row>
        </Card>
      </FadeIn>

      <FadeIn index={4}>
        <ObjectivesCard game={game} />
      </FadeIn>
      <FadeIn index={5}>
        <MilestonesPeek game={game} />
      </FadeIn>

      <View style={{ height: 8 }} />
    </Screen>
  );
}
