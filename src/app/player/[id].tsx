import React, { useState } from 'react';
import { Pressable, TextInput, View } from 'react-native';
import { Redirect, useLocalSearchParams, useRouter } from 'expo-router';
import { useGame, useStore } from '../../state/store';
import { Button, Card, H2, Pill, Row, Screen, T, inputStyle } from '../../ui/kit';
import { AttributeList, potentialLabel } from '../../ui/attributes';
import { colors } from '../../ui/theme';
import { avgRating, formatMoney, fullName, marketValue, overall, shortName } from '../../engine/player';
import { MIN_SQUAD, askingPrice, bidFee, interestIn, loanBid, offerContract, releaseCost, releasePlayer, startNegotiation, swapValue } from '../../engine/transfers';
import { HistoryTable } from '../../ui/careerSummary';
import { managerClub } from '../../engine/manager';
import { nationById } from '../../engine/generator';
import { SKILLS, skillLevel } from '../../engine/skills';
import { squad } from '../../engine/lineup';

function Field({ label, value }: { label: string; value: string }) {
  return (
    <Row style={{ justifyContent: 'space-between' }}>
      <T muted>{label}</T>
      <T style={{ flexShrink: 1, textAlign: 'right' }}>{value}</T>
    </Row>
  );
}

export default function PlayerDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const game = useGame();
  const mutate = useStore((s) => s.mutate);
  const router = useRouter();
  const [fee, setFee] = useState('');
  const [wage, setWage] = useState('');
  const [years, setYears] = useState(0);
  const [swapId, setSwapId] = useState<string | null>(null);
  const [result, setResult] = useState<string | null>(null);
  const [confirmRelease, setConfirmRelease] = useState(false);
  if (!game) return <Redirect href="/" />;
  const p = game.world.players[id ?? ''];
  if (!p) return <Redirect href="/" />;
  const world = game.world;
  const ovr = overall(p);
  const club = p.clubId ? world.clubs[p.clubId] : null;
  const myClub = game.mode === 'manager' ? managerClub(game) : null;
  const mine = !!myClub && p.clubId === myClub.id;
  const ask = askingPrice(world, p);
  const n = game.negotiations[p.id];
  const skills = SKILLS.filter((s) => skillLevel(p, s.id));
  const k = (v: number) => String(Math.round(v / 1000));

  const run = (fn: () => { message: string; amount?: number; status: string }) => {
    const r = mutate(fn);
    setResult(r.message);
    if (r.status === 'counter' && r.amount && n?.stage === 'contract') setWage(k(r.amount));
    if (r.status === 'counter' && r.amount && (!n || n.stage === 'fee')) setFee(k(r.amount));
  };

  return (
    <Screen title={fullName(p)}>
      <Card>
        <Row style={{ justifyContent: 'space-between' }}>
          <T muted>
            {p.position}, age {p.age}, {nationById(world, p.nationId)?.name}
          </T>
          <T bold style={{ fontSize: 24 }}>
            {ovr}
          </T>
        </Row>
        <T muted>
          {club ? club.name : 'Free agent'}
          {p.loan ? ` (on loan from ${world.clubs[p.loan.fromClubId]?.name})` : ''}
        </T>
        <Row style={{ flexWrap: 'wrap' }}>
          {p.real && <Pill label="Database player" color={colors.blue} />}
          {p.listed && <Pill label={`Listed for ${p.listed}`} color={colors.gold} />}
        </Row>
        {p.role && <Field label="Position" value={`${p.role}${p.secondaryRole ? ` / ${p.secondaryRole}` : ''}`} />}
        <Field label="Scouts say" value={potentialLabel(p, ovr)} />
        <Field label="Value" value={formatMoney(marketValue(p))} />
        {club && !mine && <Field label="Asking price" value={formatMoney(ask)} />}
        {p.releaseClause && <Field label="Release clause" value={formatMoney(p.releaseClause)} />}
        <Field label="Contract" value={club ? `${formatMoney(p.wage)}/wk, ${p.contractYears} yr` : 'None'} />
        <Field label="This season" value={`${p.stats.apps} apps, ${p.stats.goals} G, ${p.stats.assists} A${p.stats.apps ? `, avg ${avgRating(p.stats).toFixed(1)}` : ''}`} />
        <Field label="International" value={`${p.caps} caps, ${p.intlGoals} goals`} />
      </Card>

      {myClub && !mine && !p.loan && (
        <Card>
          <H2>Transfer</H2>
          <T muted style={{ fontSize: 13 }}>
            Interest in joining {myClub.name}: {interestIn(world, p, myClub)}. Budget {formatMoney(myClub.budget)}.
          </T>
          {!n && (
            <Row>
              <Button label={club ? 'Make a bid' : 'Offer a contract'} style={{ flex: 1 }} onPress={() => {
                const r = mutate((g) => startNegotiation(g, p.id, 'buy'));
                if (typeof r === 'string') setResult(r);
                else {
                  setResult(null);
                  setFee(k(ask));
                  setWage(k(r.askWage));
                  setYears(r.askYears);
                }
              }} />
              {club && (
                <Button label="Ask about a loan" variant="secondary" style={{ flex: 1 }} onPress={() => {
                  const r = mutate((g) => startNegotiation(g, p.id, 'loan'));
                  setResult(typeof r === 'string' ? r : null);
                }} />
              )}
            </Row>
          )}
          {n?.kind === 'buy' && n.stage === 'fee' && club && (
            <View style={{ gap: 8 }}>
              <T bold>Step 1: agree a fee with {club.name}</T>
              <T muted style={{ fontSize: 12 }}>
                Their patience: {n.clubPatience}. Fee in thousands of dollars.
              </T>
              <TextInput style={inputStyle} keyboardType="numeric" value={fee} onChangeText={(t) => setFee(t.replace(/[^0-9]/g, ''))} placeholder="Fee ($K)" placeholderTextColor={colors.faint} />
              <Row style={{ flexWrap: 'wrap' }}>
                <Button label="90%" small variant="secondary" onPress={() => setFee(k(ask * 0.9))} />
                <Button label="Asking" small variant="secondary" onPress={() => setFee(k(ask))} />
                {p.releaseClause && <Button label="Release clause" small variant="secondary" onPress={() => setFee(k(p.releaseClause!))} />}
              </Row>
              <T muted style={{ fontSize: 12 }}>
                Add one of your players to the deal (optional):
              </T>
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
                {squad(world, myClub)
                  .filter((x) => !x.loan)
                  .sort((a, b) => marketValue(b) - marketValue(a))
                  .slice(0, 12)
                  .map((x) => {
                    const worth = swapValue(world, club.id, x);
                    return (
                      <Pressable key={x.id} onPress={() => setSwapId(swapId === x.id ? null : x.id)} style={{ paddingHorizontal: 8, paddingVertical: 5, borderRadius: 999, borderWidth: 1, borderColor: swapId === x.id ? colors.accent : colors.border }}>
                        <T style={{ fontSize: 12, color: worth ? colors.text : colors.faint }}>
                          {shortName(x)} {worth ? `(${formatMoney(worth)})` : '(not wanted)'}
                        </T>
                      </Pressable>
                    );
                  })}
              </View>
              <Button label={`Bid ${formatMoney(Number(fee) * 1000)}${swapId ? ' + swap' : ''}`} disabled={!fee} onPress={() => run(() => bidFee(game, p.id, Number(fee) * 1000, swapId ?? undefined))} />
            </View>
          )}
          {n?.kind === 'buy' && n.stage === 'contract' && (
            <View style={{ gap: 8 }}>
              <T bold>{club ? 'Step 2: ' : ''}agree personal terms</T>
              <T muted style={{ fontSize: 12 }}>
                {fullName(p)} wants about {formatMoney(n.askWage)} a week for {n.askYears} years. Patience: {n.playerPatience}.
              </T>
              <TextInput style={inputStyle} keyboardType="numeric" value={wage} onChangeText={(t) => setWage(t.replace(/[^0-9]/g, ''))} placeholder="Weekly wage ($K)" placeholderTextColor={colors.faint} />
              <Row>
                {[1, 2, 3, 4, 5].map((y) => (
                  <Button key={y} label={`${y} yr`} small variant={(years || n.askYears) === y ? 'primary' : 'secondary'} style={{ flex: 1 }} onPress={() => setYears(y)} />
                ))}
              </Row>
              <Button label={`Offer ${formatMoney(Number(wage) * 1000)}/wk`} disabled={!wage} onPress={() => run(() => offerContract(game, p.id, Number(wage) * 1000, years || n.askYears))} />
            </View>
          )}
          {n?.kind === 'loan' && (
            <View style={{ gap: 8 }}>
              <T bold>Loan until the end of the season</T>
              <T muted style={{ fontSize: 12 }}>
                How much of his {formatMoney(p.wage)} weekly wage will you pay?
              </T>
              <Row>
                {[0.4, 0.6, 0.8, 1].map((s) => (
                  <Button key={s} label={`${s * 100}%`} small variant="secondary" style={{ flex: 1 }} onPress={() => run(() => loanBid(game, p.id, s))} />
                ))}
              </Row>
            </View>
          )}
          {n && <Button label="End talks" small variant="ghost" onPress={() => mutate((g) => delete g.negotiations[p.id])} />}
          {result && <T style={{ color: colors.gold }}>{result}</T>}
        </Card>
      )}

      {mine && myClub && (
        <Card>
          <H2>{p.loan ? 'Loan' : 'Contract'}</H2>
          {!p.loan && (
            <Row style={{ flexWrap: 'wrap' }}>
              <Button label={p.listed === 'transfer' ? 'Remove from transfer list' : 'List for transfer'} small variant="secondary" onPress={() => mutate(() => (p.listed = p.listed === 'transfer' ? undefined : 'transfer'))} />
              <Button label={p.listed === 'loan' ? 'Remove from loan list' : 'List for loan'} small variant="secondary" onPress={() => mutate(() => (p.listed = p.listed === 'loan' ? undefined : 'loan'))} />
            </Row>
          )}
          <T muted style={{ fontSize: 13 }}>
            {p.loan ? 'Send him back to his parent club early.' : `Releasing him costs ${formatMoney(releaseCost(p))} in paid-up wages.`} Squads need at least {MIN_SQUAD} players.
          </T>
          {!confirmRelease ? (
            <Button label={p.loan ? 'End loan' : 'Release player'} variant="danger" small disabled={myClub.playerIds.length <= MIN_SQUAD} onPress={() => setConfirmRelease(true)} />
          ) : (
            <Row>
              <Button label="Keep him" small variant="secondary" style={{ flex: 1 }} onPress={() => setConfirmRelease(false)} />
              <Button
                label="Confirm"
                small
                variant="danger"
                style={{ flex: 1 }}
                onPress={() => {
                  mutate((g) => releasePlayer(g, p.id));
                  router.back();
                }}
              />
            </Row>
          )}
        </Card>
      )}

      {skills.length > 0 && (
        <Card>
          <H2>Skills</H2>
          {skills.map((s) => (
            <Row key={s.id} style={{ justifyContent: 'space-between' }}>
              <T>{s.label}</T>
              <T bold style={{ color: colors.gold }}>
                Level {skillLevel(p, s.id)}
              </T>
            </Row>
          ))}
        </Card>
      )}
      <Card>
        <H2>Attributes</H2>
        <AttributeList p={p} />
      </Card>
      {p.history.length > 0 && (
        <Card>
          <H2>History</H2>
          <HistoryTable game={game} playerId={p.id} />
        </Card>
      )}
      <Button label="Edit in editor" variant="ghost" small onPress={() => router.push(`/editor/player/${p.id}`)} />
    </Screen>
  );
}
