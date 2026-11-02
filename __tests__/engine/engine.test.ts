import { generateWorld } from '../../src/engine/generator';
import { leagueTable, makeFixtures, SEASON_WEEKS } from '../../src/engine/league';
import { Rng } from '../../src/engine/rng';
import { createMatch, quickSim, resolveMoment, simToEnd, stepMinute } from '../../src/engine/match';
import { newCareerGame, newManagerGame, skipSummer, skipWeek, startUserMatch, finishUserMatch, starterClubs, interruptedMatch, markKickOff, SAVE_VERSION } from '../../src/engine/game';
import { fullName, overall } from '../../src/engine/player';
import { MIGRATIONS, deserialize, loadSave, serialize } from '../../src/engine/save';
import { train, upgradeSkill } from '../../src/engine/career';
import { askingPrice, bidFee, movePlayer, offerContract, searchMarket, startNegotiation } from '../../src/engine/transfers';
import { autoLineup } from '../../src/engine/lineup';
import { tournamentsForSummer } from '../../src/engine/international';
import { exportPack, parsePackText } from '../../src/engine/editor';
import { callUpMessage, respond } from '../../src/engine/offers';
import { addMessage, expireOffers } from '../../src/engine/inbox';
import { Game } from '../../src/engine/types';
import { navBadges, readyUpgrades } from '../../src/engine/alerts';
import { slotMeta } from '../../src/state/slots';
import { compress, decompress } from '../../src/state/compress';

// One shared world keeps the suite fast; tests that change it build their own.
const WORLD = generateWorld(42);

function findPlayer(game: Game, name: string) {
  return Object.values(game.world.players).find((p) => fullName(p) === name)!;
}

describe('fixtures', () => {
  const ids = Array.from({ length: 20 }, (_, i) => `c${i}`);
  let n = 0;
  const fixtures = makeFixtures(ids, new Rng(1), () => `f${n++}`);

  it('has 38 weeks of 10 games for a 20-club league', () => {
    expect(fixtures).toHaveLength(380);
    for (let w = 1; w <= SEASON_WEEKS; w++) expect(fixtures.filter((f) => f.week === w)).toHaveLength(10);
  });

  it('plays every pair once at home and once away', () => {
    const pairs = new Set(fixtures.map((f) => `${f.homeId}-${f.awayId}`));
    expect(pairs.size).toBe(380);
  });

  it('spreads an 18-club league over the season without clashes', () => {
    const ids18 = ids.slice(0, 18);
    const fx = makeFixtures(ids18, new Rng(2), () => `g${n++}`);
    expect(fx).toHaveLength(306);
    for (let w = 1; w <= SEASON_WEEKS; w++) {
      const playing = fx.filter((f) => f.week === w).flatMap((f) => [f.homeId, f.awayId]);
      expect(new Set(playing).size).toBe(playing.length);
    }
  });
});

describe('world from the real database', () => {
  it('builds real leagues with real players', () => {
    const names = WORLD.leagues.map((l) => l.name);
    expect(names).toEqual(expect.arrayContaining(['Premier League', 'LaLiga', 'Serie A', 'Bundesliga', 'Ligue 1']));
    const haaland = Object.values(WORLD.players).find((p) => p.lastName === 'Haaland')!;
    expect(WORLD.clubs[haaland.clubId!].name).toBe('Manchester City');
    expect(haaland.nationId).toBe('NOR');
    expect(overall(haaland)).toBeGreaterThanOrEqual(89);
  });

  it('gives every major nation enough players for a squad', () => {
    for (const n of WORLD.nations.filter((x) => !x.minor)) {
      const count = Object.values(WORLD.players).filter((p) => p.nationId === n.id && p.clubId).length;
      expect(count).toBeGreaterThanOrEqual(26);
    }
  });

  it('is the same from the same seed', () => {
    const a = generateWorld(5);
    const b = generateWorld(5);
    expect(serialize({ world: a } as Game)).toBe(serialize({ world: b } as Game));
  });
});

describe('matches', () => {
  it('plays the same match from the same seed', () => {
    const a = generateWorld(5);
    const b = generateWorld(5);
    const fa = a.leagues[0].fixtures[0];
    const fb = b.leagues[0].fixtures[0];
    quickSim(a, fa, 99);
    quickSim(b, fb, 99);
    expect([fa.homeGoals, fa.awayGoals]).toEqual([fb.homeGoals, fb.awayGoals]);
  });

  it('averages a realistic number of goals', () => {
    const world = generateWorld(7);
    let goals = 0;
    let games = 0;
    for (const league of world.leagues) {
      for (const f of league.fixtures.filter((x) => x.week <= 6)) {
        quickSim(world, f, games + 1);
        goals += f.homeGoals + f.awayGoals;
        games++;
      }
    }
    expect(goals / games).toBeGreaterThan(2.2);
    expect(goals / games).toBeLessThan(3.3);
  });

  it('sorts the table by points then goal difference', () => {
    const world = generateWorld(3);
    const league = world.leagues[0];
    for (const f of league.fixtures.filter((x) => x.week <= 5)) quickSim(world, f, 11);
    const table = leagueTable(league, world);
    for (let i = 1; i < table.length; i++) {
      const [a, b] = [table[i - 1], table[i]];
      expect(a.points > b.points || (a.points === b.points && a.gd >= b.gd)).toBe(true);
    }
  });

  it('goes to penalties in a level knockout game', () => {
    const world = generateWorld(9);
    const f = { ...world.leagues[0].fixtures[0], stage: 'Final' };
    let shootouts = 0;
    for (let seed = 1; seed < 40; seed++) {
      const s = createMatch(world, { ...f }, {}, seed);
      simToEnd(world, s);
      if (s.home.goals === s.away.goals) {
        expect(s.penaltyWinner).toBeDefined();
        shootouts++;
      }
    }
    expect(shootouts).toBeGreaterThan(0);
  });
});

describe('career', () => {
  it('starts at a club in your own nation', () => {
    const game = newCareerGame({ firstName: 'A', lastName: 'B', nationId: 'ESP', position: 'MID', seed: 2 });
    const p = game.world.players[game.career!.playerId];
    expect(game.world.clubs[p.clubId!].nationId).toBe('ESP');
  });

  it('builds a domestic league for a nation without one', () => {
    const game = newCareerGame({ firstName: 'A', lastName: 'B', nationId: 'GHA', position: 'FWD', seed: 3 });
    const p = game.world.players[game.career!.playerId];
    const club = game.world.clubs[p.clubId!];
    expect(club.nationId).toBe('GHA');
    const league = game.world.leagues.find((l) => l.id === club.leagueId)!;
    expect(league.clubIds.length).toBeGreaterThanOrEqual(8);
    expect(league.fixtures.length).toBeGreaterThan(0);
    expect(starterClubs(game.world, 'GHA')).toContain(club.id);
  });

  it('training raises attributes and earns XP; skills need points and attributes', () => {
    const game = newCareerGame({ firstName: 'A', lastName: 'B', nationId: 'NOR', position: 'MID', seed: 2 });
    const p = game.world.players[game.career!.playerId];
    const before = p.attrs.passing;
    expect(train(game, 'playmaking').ok).toBe(true);
    expect(p.attrs.passing).toBeGreaterThan(before);
    expect(game.career!.xp).toBeGreaterThan(0);
    // Too weak for Playmaker yet.
    expect(upgradeSkill(game, 'playmaker').ok).toBe(false);
    p.attrs.vision = 70;
    expect(upgradeSkill(game, 'playmaker').ok).toBe(true);
    expect(p.skills!.playmaker).toBe(1);
  });

  it('pauses for key moments around the focus player and resolves them', () => {
    const game = newCareerGame({ firstName: 'A', lastName: 'B', nationId: 'ENG', position: 'FWD', seed: 8 });
    const p = game.world.players[game.career!.playerId];
    for (const k of Object.keys(p.attrs) as (keyof typeof p.attrs)[]) p.attrs[k] = 95;
    let moments = 0;
    for (let i = 0; i < 4; i++) {
      const s = startUserMatch(game);
      if (!s) {
        skipWeek(game);
        continue;
      }
      while (!s.finished) {
        if (s.pending) {
          moments++;
          expect([s.pending.actorId, s.pending.assistId]).toContain(p.id);
          resolveMoment(game.world, s, 1, s.pending.options?.[0]?.playerId);
        } else stepMinute(game.world, s);
      }
      finishUserMatch(game, s);
    }
    expect(moments).toBeGreaterThan(0);
  });

  it('runs a season, a summer of tournaments, and rolls over', () => {
    const game = newCareerGame({ firstName: 'A', lastName: 'B', nationId: 'FRA', position: 'DEF', seed: 4 });
    const p = game.world.players[game.career!.playerId];
    while (game.world.phase === 'season') skipWeek(game);
    expect(game.world.tournaments.map((t) => t.name)).toEqual(expect.arrayContaining(['Nations League Finals 2027', 'Africa Cup of Nations 2027']));
    skipSummer(game);
    expect(game.world.season).toBe(2027);
    expect(game.world.week).toBe(1);
    expect(p.age).toBe(17);
    expect(game.world.honours.some((h) => h.title === 'Gold Cup 2027')).toBe(true);
    const eng = game.world.leagues.find((l) => l.id === 'ENG1')!;
    expect(eng.clubIds).toHaveLength(20);
  });
});

describe('internationals', () => {
  it('rotates tournaments by year', () => {
    expect(tournamentsForSummer(2030).map((t) => t.name)).toEqual(['World Cup']);
    expect(tournamentsForSummer(2028).map((t) => t.name)).toEqual(['European Championship', 'Copa America']);
  });
});

describe('manager', () => {
  it('negotiates fee then contract for any player in the world', () => {
    const world = generateWorld(10);
    const myId = world.leagues.find((l) => l.id === 'ENG2')!.clubIds[0];
    const game = newManagerGame(world, myId, null, 'Boss');
    const club = world.clubs[myId];
    club.budget = 5e9;
    const star = findPlayer(game, 'Lamine Yamal');
    expect(typeof startNegotiation(game, star.id, 'buy')).toBe('object');
    const ask = askingPrice(world, star);
    expect(bidFee(game, star.id, Math.round(ask * 0.8)).status).toBe('counter');
    expect(bidFee(game, star.id, ask).status).toBe('accepted');
    const n = game.negotiations[star.id];
    expect(offerContract(game, star.id, Math.round(n.askWage * 0.5), n.askYears).status).toBe('rejected');
    expect(offerContract(game, star.id, n.askWage, n.askYears).status).toBe('done');
    expect(star.clubId).toBe(myId);
  });

  it('searches the market across leagues with filters and paging', () => {
    const r = searchMarket(WORLD, null, { position: 'GK', nationId: 'BRA', minOvr: 80 });
    expect(r.rows.length).toBeGreaterThan(0);
    expect(r.rows.every((x) => x.p.position === 'GK' && x.p.nationId === 'BRA')).toBe(true);
    const page2 = searchMarket(WORLD, null, {}, 1, 30);
    expect(page2.rows).toHaveLength(30);
    expect(page2.total).toBeGreaterThan(5000);
  });

  it('half time pauses manager matches', () => {
    const world = generateWorld(12);
    const game = newManagerGame(world, world.leagues[0].clubIds[3], null, 'Boss');
    const s = startUserMatch(game)!;
    while (!s.pausedAtHalf && !s.finished) {
      if (s.pending) resolveMoment(world, s, null);
      else stepMinute(world, s);
    }
    expect(s.pausedAtHalf).toBe(true);
    simToEnd(world, s);
    expect(s.finished).toBe(true);
  });

  it('haggles over an incoming bid', () => {
    const world = generateWorld(13);
    const myId = world.leagues[0].clubIds[0];
    const game = newManagerGame(world, myId, null, 'Boss');
    const p = world.players[world.clubs[myId].playerIds[5]];
    const msg = addMessage(game, 'offer', 'Bid', 'A bid', { type: 'sale-bid', clubId: world.leagues[0].clubIds[1], playerId: p.id, fee: 1_000_000, patience: 2, choices: [] });
    respond(game, msg.id, 'counter', 1_100_000);
    expect(['accepted', undefined, 'rejected']).toContain(msg.action!.resolved);
    if (!msg.action!.resolved) {
      respond(game, msg.id, 'accept');
      expect(p.clubId).toBe(world.leagues[0].clubIds[1]);
    }
  });

  it('auto lineup picks 11 with one keeper', () => {
    const club = Object.values(WORLD.clubs).find((c) => c.leagueId)!;
    const xi = autoLineup(WORLD, club).map((id) => WORLD.players[id]);
    expect(xi).toHaveLength(11);
    expect(xi.filter((p) => p.position === 'GK')).toHaveLength(1);
  });
});

describe('saves and data packs', () => {
  it('round-trips through serialize', () => {
    const game = newCareerGame({ firstName: 'A', lastName: 'B', nationId: 'ENG', position: 'FWD', seed: 1 });
    const back = deserialize(serialize(game))!;
    expect(back.career!.playerId).toBe(game.career!.playerId);
    const p = game.world.players[game.career!.playerId];
    expect(overall(back.world.players[p.id])).toBe(overall(p));
  });

  it('rejects junk', () => {
    expect(deserialize('not json')).toBeNull();
    expect(deserialize('{"version":999}')).toBeNull();
  });

  it('exports a pack that imports and rebuilds the same clubs', () => {
    const pack = exportPack(WORLD, 'Test pack');
    const { pack: back, error } = parsePackText(JSON.stringify(pack));
    expect(error).toBeUndefined();
    const rebuilt = generateWorld(1, back!);
    expect(rebuilt.leagues.map((l) => l.id)).toEqual(WORLD.leagues.map((l) => l.id));
    const yamal = Object.values(rebuilt.players).find((p) => p.lastName === 'Yamal')!;
    expect(rebuilt.clubs[yamal.clubId!].name).toBe('Barcelona');
  });

  it('reports a broken pack', () => {
    expect(parsePackText('{"format":"nope"}').error).toBeTruthy();
  });
});

describe('player creation and roles', () => {
  const { STYLE_PRESETS, STAT_POINTS, applyAllocation, autoAllocate, pointsSpent, validateAllocation } = require('../../src/engine/creation');
  const { ROLE_LIST, ROLES } = require('../../src/engine/roles');
  const body = { heightCm: 180, build: 'athletic' };

  it('every preset spends the whole pool and lands a sensible start', () => {
    for (const r of ROLE_LIST) {
      for (const s of STYLE_PRESETS[r]) {
        const a = autoAllocate(r, s.weights, STAT_POINTS);
        expect(pointsSpent(a, 2)).toBe(STAT_POINTS);
        const ovr = overall({ attrs: applyAllocation(r, body, a, 2), position: ROLES[r].broad, role: r });
        expect(ovr).toBeGreaterThanOrEqual(40);
        expect(ovr).toBeLessThanOrEqual(53);
      }
    }
  });

  it('rejects over-budget and over-cap allocations', () => {
    expect(validateAllocation('ST', { shooting: 16 }, 2)).toBeTruthy();
    expect(validateAllocation('ST', { shooting: 15, pace: 15, dribbling: 15 }, 2)).toBeTruthy();
    expect(validateAllocation('ST', { shooting: 15, pace: 15 }, 5)).toBeTruthy();
    expect(validateAllocation('ST', { goalkeeping: 5 }, 2)).toBeTruthy();
    expect(validateAllocation('ST', { shooting: 15, pace: 15, dribbling: 10 }, 2)).toBeNull();
  });

  it('builds a career player from the chosen role and stats', () => {
    const game = newCareerGame({ firstName: 'A', lastName: 'B', nationId: 'ENG', role: 'LW', heightCm: 170, build: 'lean', weakFoot: 4, seed: 21 });
    const p = game.world.players[game.career!.playerId];
    expect(p.role).toBe('LW');
    expect(p.position).toBe('FWD');
    expect(p.weakFoot).toBe(4);
    expect(overall(p)).toBeGreaterThanOrEqual(40);
  });

  it('keeps database ratings unchanged (no role set)', () => {
    const haaland = Object.values(WORLD.players).find((p) => p.lastName === 'Haaland')!;
    expect(haaland.role).toBeUndefined();
    expect(overall(haaland)).toBeGreaterThanOrEqual(89);
  });

  it('parses exact roles in packed data', () => {
    const { parsePlayers } = require('../../src/data/pack');
    const [p] = parsePlayers('Bukayo Saka RW ENG 01 88');
    expect(p.pos).toBe('FWD');
    expect(p.role).toBe('RW');
  });
});

describe('defensive moments and second positions', () => {
  const play = (game: Game, matches: number, kinds: Set<string>) => {
    for (let i = 0; i < matches; i++) {
      const s = startUserMatch(game);
      if (!s) {
        skipWeek(game);
        continue;
      }
      while (!s.finished) {
        if (s.pending) {
          kinds.add(s.pending.kind);
          resolveMoment(game.world, s, 0.8);
        } else stepMinute(game.world, s);
      }
      finishUserMatch(game, s);
    }
  };
  const boost = (game: Game) => {
    const p = game.world.players[game.career!.playerId];
    for (const k of Object.keys(p.attrs) as (keyof typeof p.attrs)[]) p.attrs[k] = 92;
  };

  it('a keeper career gets save moments', () => {
    const game = newCareerGame({ firstName: 'A', lastName: 'B', nationId: 'ENG', role: 'GK', seed: 31 });
    boost(game);
    const kinds = new Set<string>();
    play(game, 4, kinds);
    expect(kinds.has('save')).toBe(true);
  });

  it('a centre-back career gets tackle moments', () => {
    const game = newCareerGame({ firstName: 'A', lastName: 'B', nationId: 'ENG', role: 'CB', seed: 32 });
    boost(game);
    const kinds = new Set<string>();
    play(game, 4, kinds);
    expect(kinds.has('tackle')).toBe(true);
  });

  it('a second position unlocks at level 6 and widens selection', () => {
    const { learnSecondary } = require('../../src/engine/career');
    const { ratingAt } = require('../../src/engine/lineup');
    const game = newCareerGame({ firstName: 'A', lastName: 'B', nationId: 'ENG', role: 'CDM', seed: 33 });
    const p = game.world.players[game.career!.playerId];
    game.career!.skillPoints = 5;
    expect(learnSecondary(game, 'CB').ok).toBe(false);
    game.career!.level = 6;
    expect(learnSecondary(game, 'ST').ok).toBe(false);
    expect(learnSecondary(game, 'CB').ok).toBe(true);
    expect(ratingAt(p, 'DEF')).toBeGreaterThan(0);
    expect(ratingAt(p, 'FWD')).toBe(-1);
  });
});

describe('form, relations and awards', () => {
  it('poor form drops a player down the pecking order', () => {
    const { formFactor } = require('../../src/engine/lineup');
    const p = { ...Object.values(WORLD.players)[0] };
    p.form = [5.2, 5.5, 5.4];
    expect(formFactor(p)).toBeLessThan(1);
    p.form = [8, 7.8, 8.2];
    expect(formFactor(p)).toBeGreaterThan(1);
  });

  it('offering yourself respects cooldowns and windows', () => {
    const { offerSelf, interestedClubs } = require('../../src/engine/relations');
    const game = newCareerGame({ firstName: 'A', lastName: 'B', nationId: 'ENG', role: 'ST', seed: 41 });
    const target = interestedClubs(game, 5)[0].clubId;
    const first = offerSelf(game, target);
    expect(typeof first).toBe('string');
    expect(offerSelf(game, target)).toMatch(/weeks?/);
  });

  it("hands out a Ballon d'Or at the end of the league season", () => {
    const game = newCareerGame({ firstName: 'A', lastName: 'B', nationId: 'ENG', role: 'ST', seed: 42 });
    while (game.world.phase === 'season') skipWeek(game);
    const a = game.world.awards![0];
    expect(a.ballonDor.length).toBeGreaterThan(10);
    expect(game.world.honours.some((h) => h.title === "Ballon d'Or")).toBe(true);
  });
});

describe('progression', () => {
  const { progressOf, MILESTONES } = require('../../src/engine/progress');
  const { train } = require('../../src/engine/career');

  it('a new career starts with coach objectives', () => {
    const game = newCareerGame({ firstName: 'A', lastName: 'B', nationId: 'ENG', role: 'ST', seed: 51 });
    const pr = progressOf(game);
    expect(pr.objectives.length).toBeGreaterThanOrEqual(3);
    expect(pr.objectives.some((o: { kind: string }) => o.kind === 'goals')).toBe(true);
  });

  it('a better mini-game score gives bigger training gains', () => {
    const a = newCareerGame({ firstName: 'A', lastName: 'B', nationId: 'ENG', role: 'ST', seed: 52 });
    const b = newCareerGame({ firstName: 'A', lastName: 'B', nationId: 'ENG', role: 'ST', seed: 52 });
    const low = train(a, 'finishing', 0).gains.shooting;
    const high = train(b, 'finishing', 1).gains.shooting;
    expect(high).toBeGreaterThan(low * 1.8);
  });

  it('unlocks the debut milestone and queues a reward', () => {
    const game = newCareerGame({ firstName: 'A', lastName: 'B', nationId: 'ENG', role: 'ST', seed: 53 });
    const p = game.world.players[game.career!.playerId];
    for (const k of Object.keys(p.attrs) as (keyof typeof p.attrs)[]) p.attrs[k] = 90;
    for (let i = 0; i < 3; i++) skipWeek(game);
    const pr = progressOf(game);
    expect(pr.milestones).toContain('debut');
    expect(MILESTONES.length).toBeGreaterThan(15);
  });

  it('records a season review at the rollover', () => {
    const game = newCareerGame({ firstName: 'A', lastName: 'B', nationId: 'ENG', role: 'ST', seed: 54 });
    while (game.world.phase === 'season') skipWeek(game);
    skipSummer(game);
    const pr = progressOf(game);
    expect(pr.review).toBeDefined();
    expect(pr.ovrHistory.length).toBe(2);
  });
});

describe('alerts and save slots', () => {
  it('badges count only open answers and upgrades you can buy now', () => {
    const game = newCareerGame({ firstName: 'A', lastName: 'B', nationId: 'ENG', role: 'ST', seed: 61 });
    const c = game.career!;
    const p = game.world.players[c.playerId];
    game.inbox = [];
    addMessage(game, 'news', 'Just news', 'Nothing to do.');
    expect(navBadges(game)['/inbox']).toBe(0);
    addMessage(game, 'media', 'Interview', 'How do you play it?', { type: 'media', choices: [{ id: 'humble', label: 'Humble' }] });
    expect(navBadges(game)['/inbox']).toBe(1);

    c.skillPoints = 0;
    p.attrs.shooting = 90;
    expect(readyUpgrades(game)).toHaveLength(0);
    c.skillPoints = 1;
    expect(readyUpgrades(game).map((s) => s.id)).toContain('finisher');
    expect(navBadges(game)['/career/skills']).toBe(readyUpgrades(game).length);
  });

  it('describes a save slot without loading the game', () => {
    const game = newCareerGame({ firstName: 'Kai', lastName: 'Mendez', nationId: 'ENG', role: 'ST', seed: 62 });
    const meta = slotMeta('s1', game, 'My run');
    expect(meta).toMatchObject({ id: 's1', name: 'My run', mode: 'career', title: 'Kai Mendez' });
    expect(meta.rating).toBe(overall(game.world.players[game.career!.playerId]));
    expect(JSON.stringify(meta).length).toBeLessThan(1000);
  });
});

describe('save compression', () => {
  it('round-trips a save and shrinks it', () => {
    const game = newCareerGame({ firstName: 'A', lastName: 'B', nationId: 'ENG', role: 'ST', seed: 71 });
    const text = serialize(game);
    const packed = compress(text);
    expect(packed.length).toBeLessThan(text.length / 3);
    expect(decompress(packed)).toBe(text);
    // Saves written before compression load unchanged.
    expect(decompress(text)).toBe(text);
  });
});

describe('save migrations', () => {
  it('upgrades an older save step by step and refuses newer ones', () => {
    const game = newCareerGame({ firstName: 'A', lastName: 'B', nationId: 'ENG', role: 'ST', seed: 81 });
    const text = serialize(game);
    const old = JSON.parse(text);
    old.version = SAVE_VERSION - 1;
    MIGRATIONS[SAVE_VERSION - 1] = (g) => {
      (g as { migrated?: boolean }).migrated = true;
    };
    try {
      const r = loadSave(JSON.stringify(old));
      expect(r.ok).toBe(true);
      if (r.ok) expect((r.game as unknown as { migrated: boolean }).migrated).toBe(true);
    } finally {
      delete MIGRATIONS[SAVE_VERSION - 1];
    }
    old.version = SAVE_VERSION + 1;
    expect(loadSave(JSON.stringify(old))).toEqual({ ok: false, error: 'too-new' });
    expect(loadSave('not json')).toEqual({ ok: false, error: 'corrupt' });
  });
});

describe('audit fixes', () => {
  it('a restarted match keeps its seed, and an interrupted one is detected', () => {
    const game = newCareerGame({ firstName: 'A', lastName: 'B', nationId: 'ENG', role: 'ST', seed: 82 });
    const a = startUserMatch(game)!;
    const b = startUserMatch(game)!;
    expect(JSON.stringify(b)).toBe(JSON.stringify(a));
    expect(game.world.pendingMatch?.fixtureId).toBe(a.fixtureId);
    expect(interruptedMatch(game)).toBe(false);
    markKickOff(game);
    expect(interruptedMatch(game)).toBe(true);
    finishUserMatch(game, b);
    expect(game.world.pendingMatch).toBeUndefined();
  });

  it('a call-up can still be answered the week it arrives', () => {
    const game = newCareerGame({ firstName: 'A', lastName: 'B', nationId: 'ENG', role: 'ST', seed: 83 });
    callUpMessage(game);
    expireOffers(game);
    const msg = game.inbox.find((m) => m.action?.type === 'callup')!;
    expect(msg.action!.resolved).toBeUndefined();
    const caps = game.world.players[game.career!.playerId].caps;
    respond(game, msg.id, 'accept');
    expect(game.world.players[game.career!.playerId].caps).toBeGreaterThan(caps);
  });

  it('a sacked manager keeps getting job offers', () => {
    const world = generateWorld(84);
    const game = newManagerGame(world, world.leagues[0].clubIds[0], null, 'Boss');
    game.manager!.clubId = null;
    game.inbox = [];
    for (let i = 0; i < 15; i++) skipWeek(game);
    expect(game.inbox.some((m) => m.action?.type === 'job')).toBe(true);
  });

  it('an old renewal cannot pull the player back after a move', () => {
    const game = newCareerGame({ firstName: 'A', lastName: 'B', nationId: 'ENG', role: 'ST', seed: 85 });
    const p = game.world.players[game.career!.playerId];
    const oldClub = p.clubId!;
    const msg = addMessage(game, 'offer', 'Stay', 'Stay with us', { type: 'renewal', clubId: oldClub, wage: 1000, years: 3, weeksLeft: 30, choices: [{ id: 'accept', label: 'Accept' }] });
    const other = Object.values(game.world.clubs).find((c) => c.id !== oldClub && c.leagueId)!;
    movePlayer(game.world, p, other.id, 2000, 2);
    respond(game, msg.id, 'accept');
    expect(p.clubId).toBe(other.id);
    expect(msg.action!.resolved).toBe('expired');
  });

  it('transfer talks end if the player signs elsewhere first', () => {
    const world = generateWorld(86);
    const myId = world.leagues[0].clubIds[0];
    const game = newManagerGame(world, myId, null, 'Boss');
    const target = Object.values(game.world.players).find((x) => x.clubId && x.clubId !== myId && !x.loan)!;
    game.world.week = 2;
    const n = startNegotiation(game, target.id, 'buy');
    expect(typeof n).toBe('object');
    const elsewhere = Object.values(game.world.clubs).find((c) => c.id !== myId && c.id !== target.clubId && c.leagueId)!;
    movePlayer(game.world, target, elsewhere.id);
    const r = bidFee(game, target.id, 1_000_000);
    expect(r.status).toBe('walked');
    expect(game.negotiations[target.id]).toBeUndefined();
  });
});
