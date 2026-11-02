import { Position } from '../engine/types';
import { PlayStep, Spot, toPitch } from '../engine/play';

// A small football simulation for the live pitch. The match engine decides
// what happens (who passes, who shoots, whether it goes in); this moves 22
// players and a ball so it looks like football: everyone runs at their own
// speed toward their own target, the ball travels between feet, defenders
// press and mark, forwards make runs, keepers dive. Units are metres.

export const PW = 68; // touchline to touchline (pitch x)
export const PL = 105; // goal line to goal line (pitch y, home goal at 0)
const GOAL_HALF = 3.66;

export interface BodyInfo {
  id: string;
  side: 'home' | 'away';
  spot: Spot;
  pos: Position;
  // 0..99. Sets top speed.
  pace: number;
  name: string;
}

interface Body extends BodyInfo {
  x: number;
  y: number;
  vx: number;
  vy: number;
  top: number;
  phase: number;
  // An off-ball run: extra depth and width until the run ends.
  runUntil: number;
  runRest: number;
  runDepth: number;
  runLat: number;
  // Seconds left on the floor after a foul or a tackle.
  down: number;
}

interface Flight {
  fx: number;
  fy: number;
  tx: number;
  ty: number;
  t: number;
  dur: number;
  peak: number;
}

export interface Callout {
  text: string;
  sub?: string;
  tone: 'goal' | 'save' | 'miss' | 'stop';
  side?: 'home' | 'away';
  until: number;
}

interface Active {
  step: PlayStep;
  t: number;
  stage: number;
  wait: number;
  // The player who had the ball when the step began.
  from: string | null;
  tx: number;
  ty: number;
  // Shots: the keeper facing it and where his dive takes him.
  keeperId?: string;
  kx?: number;
  ky?: number;
}

// How far a keeper gets across his goal in a dive, in metres.
export const KEEPER_REACH = 2;

export interface SimHooks {
  onGoal?: () => void;
  onMoment?: () => void;
  // Kicks, whistles and the crowd, as they happen.
  onSound?: (name: 'kick' | 'whistle' | 'whistle-end' | 'goal' | 'ooh', volume: number) => void;
}

const dist = (ax: number, ay: number, bx: number, by: number) => Math.hypot(ax - bx, ay - by);
const clamp = (v: number, a: number, b: number) => Math.max(a, Math.min(b, v));
const M = (p: { x: number; y: number }) => ({ x: p.x * PW, y: p.y * PL });

// Real time runs a little fast on a phone screen; this keeps 1x readable.
const TIME = 1.8;

export class PitchSim {
  bodies = new Map<string, Body>();
  ball = { x: PW / 2, y: PL / 2, z: 0, owner: null as string | null, flight: null as Flight | null, vx: 0, vy: 0 };
  queue: PlayStep[] = [];
  act: Active | null = null;
  clock = 0;
  // Side in possession, for team shape.
  attacking: 'home' | 'away' | null = null;
  holding = false;
  layout: 'play' | 'kickoff' = 'kickoff';
  kickoffSide: 'home' | 'away' = 'home';
  celebrate: { until: number; scorer: string | null; side: 'home' | 'away'; cx: number; cy: number } | null = null;
  caption = 'Teams are out. Waiting for kick off.';
  callout: Callout | null = null;
  hooks: SimHooks = {};

  setHooks(h: SimHooks) {
    this.hooks = h;
  }

  // Adds new players (subs come on from the halfway line) and drops those
  // who went off.
  sync(infos: BodyInfo[]) {
    const keep = new Set(infos.map((i) => i.id));
    for (const id of [...this.bodies.keys()]) if (!keep.has(id)) this.bodies.delete(id);
    for (const info of infos) {
      const b = this.bodies.get(info.id);
      if (b) {
        Object.assign(b, info, { top: topSpeed(info) });
        continue;
      }
      const fresh = this.bodies.size === 0 || this.layout === 'kickoff';
      const start = fresh ? this.kickoffSpot(info) : { x: PW + 1, y: PL / 2 };
      this.bodies.set(info.id, {
        ...info,
        ...start,
        vx: 0,
        vy: 0,
        top: topSpeed(info),
        phase: hash(info.id) * 6.28,
        runUntil: 0,
        runRest: 0,
        runDepth: 0,
        runLat: 0,
        down: 0,
      });
    }
  }

  // Lines up for the kick-off: each side in its own half.
  kickoffSpot(b: Pick<BodyInfo, 'side' | 'spot' | 'pos' | 'id'>): { x: number; y: number } {
    const keeper = b.pos === 'GK';
    const depth = keeper ? 0.03 : Math.min(0.45, 0.07 + b.spot.depth * 0.5);
    return M(toPitch(b.side, { depth, lat: b.spot.lat }));
  }

  halfTime(side: 'home' | 'away') {
    this.queue = [];
    this.act = null;
    this.holding = false;
    this.celebrate = null;
    this.layout = 'kickoff';
    this.kickoffSide = side;
    this.ball = { ...this.ball, x: PW / 2, y: PL / 2, z: 0, owner: null, flight: null, vx: 0, vy: 0 };
    this.caption = 'Half time.';
    this.hooks.onSound?.('whistle-end', 0.8);
  }

  enqueue(steps: PlayStep[]) {
    if (this.holding) {
      // The user played the moment; carry on from here.
      this.holding = false;
      this.act = null;
    }
    this.queue.push(...steps);
  }

  // Nothing left to show: the match can move on to the next minute.
  idle(): boolean {
    return !this.act && !this.queue.length && !this.celebrate && !this.holding;
  }

  private name(id: string | null | undefined) {
    return id ? this.bodies.get(id)?.name ?? '' : '';
  }

  update(rawDt: number) {
    const dt = rawDt * TIME;
    if (dt <= 0) return;
    this.clock += dt;
    if (this.callout && this.clock > this.callout.until) this.callout = null;
    this.runAction(dt);
    this.moveBall(dt);
    this.moveBodies(dt);
  }

  // --- The scripted move -------------------------------------------------

  private begin(step: PlayStep) {
    const target = M(step);
    const owner = this.ball.owner;
    this.act = { step, t: 0, stage: 0, wait: 0, from: owner, tx: target.x, ty: target.y };
    const who = this.name(step.carrier);
    switch (step.act) {
      case 'start':
        if (step.restart) {
          this.ball = { ...this.ball, owner: null, flight: null, vx: 0, vy: 0, z: 0, x: target.x, y: target.y };
          if (step.restart === 'kickoff') {
            this.layout = 'kickoff';
            this.kickoffSide = step.side;
          }
          this.caption = { kickoff: 'Kick off', throw: `Throw-in, ${who} takes it`, corner: `Corner, ${who} to take`, goalkick: 'Goal kick', freekick: `Free kick, ${who} over the ball` }[step.restart];
        } else if (owner !== step.carrier) this.caption = `${who} picks it up`;
        break;
      case 'run':
        this.caption = `${who} drives forward`;
        break;
      case 'pass':
      case 'cross':
      case 'out':
      case 'offside': {
        const from = this.ball.owner ? this.bodies.get(this.ball.owner) : undefined;
        const fx = this.ball.x;
        const fy = this.ball.y;
        let tx = target.x;
        let ty = target.y;
        if (step.act === 'out') {
          tx = clamp(tx, -2, PW + 2);
          ty = clamp(ty, -2, PL + 2);
        }
        // Play it where the receiver can get to while the ball travels: into
        // his feet if he is close, into space ahead of him if he is running.
        const runner = this.bodies.get((step.act === 'offside' ? step.other : step.carrier) ?? '');
        if (runner && step.act !== 'out') {
          const guess = dist(fx, fy, tx, ty) / 16;
          const reach = runner.top * 0.85 * guess * TIME + 1;
          const gap = dist(runner.x, runner.y, tx, ty);
          if (gap > reach) {
            tx = runner.x + ((tx - runner.x) * reach) / gap;
            ty = runner.y + ((ty - runner.y) * reach) / gap;
          }
          this.act!.tx = tx;
          this.act!.ty = ty;
        }
        const d = dist(fx, fy, tx, ty);
        const speed = step.act === 'cross' ? 15 : d > 30 ? 19 : 15;
        const peak = step.act === 'cross' ? 4 : d > 30 ? 3 : d > 18 ? 0.8 : 0;
        this.ball.owner = null;
        this.ball.flight = { fx, fy, tx, ty, t: 0, dur: Math.max(0.45, d / speed), peak };
        this.hooks.onSound?.('kick', step.act === 'cross' || d > 30 ? 0.8 : 0.5);
        const to = step.act === 'offside' ? step.other : step.carrier;
        this.caption =
          step.act === 'cross'
            ? `${this.name(from?.id)} crosses for ${who}`
            : step.act === 'out'
              ? `${this.name(from?.id)} plays it`
              : step.act === 'offside'
                ? `${this.name(from?.id)} looks for ${this.name(to)}`
                : `${this.name(from?.id)}  ->  ${who}`;
        if (from) this.attacking = from.side;
        break;
      }
      case 'win': {
        this.caption = `${who} steps in and wins it`;
        // An interception: the ball is cut out on its way to the winner,
        // instead of him chasing the man across the pitch.
        const w = step.carrier ? this.bodies.get(step.carrier) : undefined;
        if (w && dist(w.x, w.y, this.ball.x, this.ball.y) > 4) {
          const tx = w.x + (this.ball.x - w.x) * 0.15;
          const ty = w.y + (this.ball.y - w.y) * 0.15;
          const d = dist(this.ball.x, this.ball.y, tx, ty);
          this.ball.owner = null;
          this.ball.flight = { fx: this.ball.x, fy: this.ball.y, tx, ty, t: 0, dur: Math.max(0.35, d / 15), peak: 0 };
          this.act!.tx = tx;
          this.act!.ty = ty;
        }
        break;
      }
      case 'tackle':
        this.caption = `Great tackle by ${who}`;
        break;
      case 'foul':
        this.caption = `${this.name(step.other)} is brought down`;
        break;
      case 'goal':
      case 'save':
      case 'miss': {
        const shooter = owner ? this.bodies.get(owner) : undefined;
        // The keeper facing the shot decides where the ball can go, so the
        // picture always matches the result: a save goes where he can get
        // to, a goal goes beyond his dive, a miss goes wide of the posts.
        const defSide = step.act === 'goal' ? (step.side === 'home' ? 'away' : 'home') : step.side;
        const keeper = [...this.bodies.values()].find((b) => b.pos === 'GK' && b.side === defSide);
        const lineY = defSide === 'home' ? 0 : PL;
        const inward = defSide === 'home' ? 1 : -1;
        const kx = keeper?.x ?? PW / 2;
        const lo = PW / 2 - GOAL_HALF + 0.35;
        const hi = PW / 2 + GOAL_HALF - 0.35;
        let tx: number;
        let toward: number;
        let dive: number;
        if (step.act === 'save') {
          tx = clamp(kx + clamp(target.x - kx, -KEEPER_REACH * 0.8, KEEPER_REACH * 0.8), lo, hi);
          toward = lineY + inward * 0.9;
          dive = tx;
        } else if (step.act === 'goal') {
          const side = kx < PW / 2 - 0.3 ? 1 : kx > PW / 2 + 0.3 ? -1 : target.x < 0.5 ? -1 : 1;
          tx = clamp(PW / 2 + side * (GOAL_HALF - 0.45 - Math.random() * 0.6), lo, hi);
          if (Math.abs(tx - kx) < KEEPER_REACH + 1) tx = clamp(kx + side * (KEEPER_REACH + 1.2), lo, hi);
          toward = lineY - inward * 1.6;
          dive = kx + clamp(tx - kx, -KEEPER_REACH, KEEPER_REACH);
        } else {
          const side = target.x < 0.5 ? -1 : 1;
          tx = PW / 2 + side * (GOAL_HALF + 1 + Math.random() * 3);
          toward = lineY - inward * 2;
          dive = kx + clamp(tx - kx, -0.8, 0.8);
        }
        this.act.keeperId = keeper?.id;
        this.act.kx = dive;
        this.act.ky = lineY + inward * 0.7;
        const fx = this.ball.x;
        const fy = this.ball.y;
        const d = dist(fx, fy, tx, toward);
        this.ball.owner = null;
        this.ball.flight = { fx, fy, tx, ty: toward, t: 0, dur: Math.max(0.3, d / (step.header ? 17 : 27)), peak: step.header ? 0.6 : step.act === 'miss' && Math.random() < 0.4 ? 3.2 : 1.2 };
        this.hooks.onSound?.('kick', 1);
        this.caption = step.header ? `${this.name(shooter?.id)} goes for the header!` : `${this.name(shooter?.id)} shoots!`;
        this.act.from = shooter?.id ?? null;
        break;
      }
      case 'moment':
        this.caption = 'Your moment!';
        break;
    }
  }

  private runAction(dt: number) {
    if (this.celebrate) {
      if (this.clock > this.celebrate.until) this.celebrate = null;
      return;
    }
    if (!this.act) {
      const next = this.queue.shift();
      if (!next) return;
      this.begin(next);
    }
    const a = this.act!;
    a.t += dt;
    const step = a.step;
    if (a.wait > 0) {
      a.wait -= dt;
      if (a.wait <= 0) this.act = null;
      return;
    }
    const carrier = step.carrier ? this.bodies.get(step.carrier) : undefined;
    const done = () => (this.act = null);
    const pause = (s: number) => (a.wait = s);

    switch (step.act) {
      case 'start': {
        if (step.restart === 'kickoff') {
          // Wait for both teams to take their places, then the taker plays it.
          const settled = [...this.bodies.values()].every((b) => dist(b.x, b.y, ...xy(this.targetFor(b))) < 2.5);
          if (!carrier) return done();
          if ((settled || a.t > 3.5) && dist(carrier.x, carrier.y, this.ball.x, this.ball.y) < 2) {
            this.hooks.onSound?.('whistle', 0.8);
            this.ball.owner = carrier.id;
            this.attacking = carrier.side;
            this.layout = 'play';
            return done();
          }
          return;
        }
        if (!carrier) return done();
        if (this.ball.owner === carrier.id) {
          this.attacking = carrier.side;
          return done();
        }
        if (dist(carrier.x, carrier.y, this.ball.x, this.ball.y) < 1.8 || a.t > 2.5) {
          this.ball.owner = carrier.id;
          this.ball.flight = null;
          this.attacking = carrier.side;
          this.layout = 'play';
          // Set pieces take a moment to set up.
          return step.restart ? pause(0.6) : done();
        }
        return;
      }
      case 'run': {
        if (!carrier) return done();
        if (this.ball.owner !== carrier.id) {
          if (dist(carrier.x, carrier.y, this.ball.x, this.ball.y) < 1.5) this.ball.owner = carrier.id;
          else if (a.t > 3) this.ball.owner = carrier.id;
          return;
        }
        this.attacking = carrier.side;
        const limit = dist(carrier.x, carrier.y, a.tx, a.ty) / (carrier.top * 0.8) + 1.2;
        if (dist(carrier.x, carrier.y, a.tx, a.ty) < 1.6 || a.t > Math.max(limit, 2.5)) done();
        return;
      }
      case 'pass':
      case 'cross': {
        if (this.ball.flight) return;
        if (!carrier) return done();
        if (dist(carrier.x, carrier.y, this.ball.x, this.ball.y) < 2.6 || a.t > 2.5) {
          this.ball.owner = carrier.id;
          this.attacking = carrier.side;
          if (step.act === 'cross' && !step.header) this.caption = `${carrier.name} controls it in the box`;
          return done();
        }
        return;
      }
      case 'win':
      case 'tackle':
      case 'foul': {
        if (!carrier) return done();
        if (this.ball.flight) return;
        const loser = step.other ? this.bodies.get(step.other) : undefined;
        if (dist(carrier.x, carrier.y, this.ball.x, this.ball.y) < 2 || a.t > 2.2) {
          if (step.act === 'foul') {
            if (loser) loser.down = 1.4;
            this.ball.owner = null;
            this.ball.vx = 0;
            this.ball.vy = 0;
            this.callout = { text: 'FOUL', tone: 'stop', until: this.clock + 1.3 };
            this.hooks.onSound?.('whistle', 0.8);
            this.caption = `Foul by ${carrier.name}. Free kick.`;
            return pause(1.0);
          }
          if (loser && step.act === 'tackle') loser.down = 0.7;
          this.ball.owner = carrier.id;
          this.ball.flight = null;
          this.attacking = carrier.side;
          return done();
        }
        return;
      }
      case 'out': {
        if (this.ball.flight) return;
        if (!a.stage) {
          a.stage = 1;
          const r = step.restart;
          this.callout = { text: r === 'corner' ? 'CORNER' : r === 'goalkick' ? 'GOAL KICK' : 'THROW-IN', tone: 'stop', until: this.clock + 1.1 };
          this.caption = r === 'corner' ? 'Out for a corner' : r === 'goalkick' ? 'Out for a goal kick' : 'Out for a throw-in';
          return pause(0.8);
        }
        return done();
      }
      case 'offside': {
        if (this.ball.flight) return;
        if (!a.stage) {
          a.stage = 1;
          this.ball.vx = 0;
          this.ball.vy = 0;
          this.callout = { text: 'OFFSIDE', tone: 'stop', until: this.clock + 1.2 };
          this.hooks.onSound?.('whistle', 0.7);
          this.caption = `Flag up: ${this.name(step.other)} is offside`;
          return pause(0.9);
        }
        return done();
      }
      case 'goal':
      case 'save':
      case 'miss': {
        if (this.ball.flight) return;
        if (a.stage === 0) {
          a.stage = 1;
          const shooter = this.name(a.from);
          if (step.act === 'goal') {
            this.callout = { text: 'GOAL!', sub: shooter, tone: 'goal', side: step.side, until: this.clock + 3 };
            this.caption = `GOAL! ${shooter}`;
            this.hooks.onGoal?.();
            this.hooks.onSound?.('goal', 1);
            const scorer = a.from ? this.bodies.get(a.from) : undefined;
            const cy = step.side === 'home' ? PL - 6 : 6;
            const cx = (scorer?.x ?? PW / 2) < PW / 2 ? 4 : PW - 4;
            this.celebrate = { until: this.clock + 3.2, scorer: a.from, side: step.side, cx, cy };
            this.ball.owner = null;
            this.ball.vx = 0;
            this.ball.vy = 0;
            return done();
          }
          if (step.act === 'save') {
            // Half the time the keeper holds it; otherwise he parries it out
            // and gathers it a moment later.
            if (Math.random() < 0.5 && carrier) {
              const out = carrier.side === 'home' ? 1 : -1;
              const px = clamp(this.ball.x + (Math.random() < 0.5 ? -1 : 1) * (5 + Math.random() * 5), 4, PW - 4);
              const py = clamp(this.ball.y + out * (5 + Math.random() * 4), 2, PL - 2);
              this.ball.flight = { fx: this.ball.x, fy: this.ball.y, tx: px, ty: py, t: 0, dur: 0.45, peak: 1.2 };
              this.ball.owner = null;
            } else this.ball.owner = step.carrier;
            if (carrier) this.attacking = carrier.side;
            this.callout = { text: 'SAVED!', sub: carrier?.name, tone: 'save', until: this.clock + 1.3 };
            this.hooks.onSound?.('ooh', 0.8);
            this.caption = `${shooter} shoots... saved by ${carrier?.name ?? 'the keeper'}`;
            return pause(1.2);
          }
          this.callout = { text: step.header ? 'OVER!' : 'WIDE!', tone: 'miss', until: this.clock + 1.2 };
          this.hooks.onSound?.('ooh', 0.7);
          this.caption = `${shooter} misses the target`;
          return pause(1.2);
        }
        return done();
      }
      case 'moment': {
        if (!carrier) return done();
        if (this.ball.owner !== carrier.id && dist(carrier.x, carrier.y, this.ball.x, this.ball.y) < 2.5) this.ball.owner = carrier.id;
        if (!this.holding) {
          this.holding = true;
          this.hooks.onMoment?.();
        }
        return;
      }
    }
  }

  // --- Ball --------------------------------------------------------------

  private moveBall(dt: number) {
    const b = this.ball;
    if (b.flight) {
      const f = b.flight;
      f.t += dt;
      const k = Math.min(1, f.t / f.dur);
      // Ground passes slow as they arrive; balls in the air keep their pace.
      const e = f.peak > 1.5 ? k : 1 - Math.pow(1 - k, 1.6);
      b.x = f.fx + (f.tx - f.fx) * e;
      b.y = f.fy + (f.ty - f.fy) * e;
      b.z = 4 * f.peak * k * (1 - k);
      if (k >= 1) {
        b.flight = null;
        b.z = 0;
      }
      return;
    }
    const owner = b.owner ? this.bodies.get(b.owner) : undefined;
    if (owner) {
      // At the feet, a stride ahead in the direction of travel.
      const sp = Math.hypot(owner.vx, owner.vy);
      const towardGoal = owner.side === 'home' ? 1 : -1;
      const dx = sp > 0.4 ? owner.vx / sp : 0;
      const dy = sp > 0.4 ? owner.vy / sp : towardGoal;
      b.x += (owner.x + dx * 0.9 - b.x) * Math.min(1, dt * 14);
      b.y += (owner.y + dy * 0.9 - b.y) * Math.min(1, dt * 14);
      b.z = 0;
      return;
    }
    b.x += b.vx * dt;
    b.y += b.vy * dt;
    b.vx *= Math.max(0, 1 - dt * 2.5);
    b.vy *= Math.max(0, 1 - dt * 2.5);
  }

  // --- Players -----------------------------------------------------------

  // Where a player wants to be right now.
  targetFor(b: Body): { x: number; y: number } {
    const ball = this.ball;
    const a = this.act;
    if (this.layout === 'kickoff') {
      const kickoffTaker = a?.step.act === 'start' && a.step.restart === 'kickoff' ? a.step.carrier : null;
      if (b.id === kickoffTaker) return { x: PW / 2, y: PL / 2 + (b.side === 'home' ? -0.8 : 0.8) };
      return this.kickoffSpot(b);
    }
    if (this.celebrate) {
      const c = this.celebrate;
      if (b.id === c.scorer) return { x: c.cx, y: c.cy };
      if (b.side === c.side && b.pos !== 'GK') return { x: c.cx + Math.sin(b.phase) * 3, y: c.cy + Math.cos(b.phase) * 3 + (c.side === 'home' ? -3 : 3) };
      return this.shapeSpot(b, 0.35, false);
    }
    // Players with a job in the current step.
    if (a) {
      const s = a.step;
      if (b.id === s.carrier) {
        if (s.act === 'pass' || s.act === 'cross') return { x: a.tx, y: a.ty };
        if (s.act === 'run' && ball.owner === b.id) return { x: a.tx, y: a.ty };
        if (s.act === 'start' || s.act === 'win' || s.act === 'tackle' || s.act === 'foul' || (s.act === 'run' && ball.owner !== b.id)) return { x: ball.x, y: ball.y };
      }
      if (s.act === 'offside' && b.id === s.other) return { x: a.tx, y: a.ty };
      if ((s.act === 'goal' || s.act === 'save' || s.act === 'miss') && b.id === a.keeperId && a.kx !== undefined && a.ky !== undefined) {
        // The keeper dives as far as he can get, and no further.
        return { x: a.kx, y: a.ky };
      }
    }
    if (ball.owner === b.id) return { x: b.x + b.vx * 0.3, y: b.y + b.vy * 0.3 };
    const inPossession = this.attacking === b.side;
    return this.shapeSpot(b, 1, inPossession);
  }

  // The team shape around the ball, with each player's own runs and drift.
  shapeSpot(b: Body, weight: number, inPossession: boolean): { x: number; y: number } {
    const home = b.side === 'home';
    const bd = home ? this.ball.y / PL : 1 - this.ball.y / PL;
    const bl = home ? this.ball.x / PW : 1 - this.ball.x / PW;
    let depth: number;
    let lat: number;
    if (b.pos === 'GK') {
      depth = 0.025 + clamp(bd, 0, 0.6) * 0.09;
      lat = 0.5 + (bl - 0.5) * 0.3;
    } else if (inPossession) {
      depth = b.spot.depth + (bd - 0.4) * 0.55 + 0.04;
      lat = b.spot.lat + (bl - 0.5) * 0.2;
      if (b.pos === 'FWD') depth = Math.max(depth, Math.min(0.86, bd + 0.1));
      if (b.spot.lat < 0.3 || b.spot.lat > 0.7) lat += b.spot.lat < 0.5 ? -0.05 : 0.05;
      if (this.clock < b.runUntil) {
        depth += b.runDepth;
        lat += b.runLat;
      }
    } else {
      depth = b.spot.depth * 0.82 + (bd - 0.5) * 0.42 + 0.02;
      lat = 0.5 + (b.spot.lat - 0.5) * 0.72 + (bl - 0.5) * 0.32;
    }
    depth += Math.cos(this.clock * 0.45 + b.phase * 1.3) * 0.012;
    lat += Math.sin(this.clock * 0.6 + b.phase) * 0.014;
    const target = M(toPitch(b.side, { depth: clamp(depth, 0.015, 0.95), lat: clamp(lat, 0.04, 0.96) }));
    if (weight >= 1) return target;
    return { x: b.x + (target.x - b.x) * weight, y: b.y + (target.y - b.y) * weight };
  }

  private moveBodies(dt: number) {
    const ball = this.ball;
    const list = [...this.bodies.values()];
    const pressing = new Map<string, number>();
    // Without the ball, the two nearest close it down.
    if (this.layout === 'play' && !this.celebrate && ball.owner) {
      const defending = list.filter((b) => b.side !== this.attacking && b.pos !== 'GK' && b.down <= 0);
      defending
        .map((b) => ({ b, d: dist(b.x, b.y, ball.x, ball.y) }))
        .sort((p, q) => p.d - q.d)
        .slice(0, 2)
        .forEach(({ b }, i) => pressing.set(b.id, i === 0 ? 0.85 : 0.45));
    }
    const attackers = list.filter((b) => b.side === this.attacking);
    for (const b of list) {
      if (b.down > 0) {
        b.down -= dt;
        b.vx *= 0.8;
        b.vy *= 0.8;
        continue;
      }
      // Off-ball runs for attackers, now and then.
      if (this.attacking === b.side && (b.pos === 'FWD' || b.pos === 'MID') && this.clock > b.runUntil + b.runRest && Math.random() < dt * 0.35) {
        b.runUntil = this.clock + 1.4 + Math.random() * 1.6;
        b.runRest = 1.5 + Math.random() * 3;
        b.runDepth = 0.05 + Math.random() * 0.1;
        b.runLat = (Math.random() - 0.5) * 0.16;
      }
      let t = this.targetFor(b);
      let urgency = 0.55;
      const job = this.act && (this.act.step.carrier === b.id || this.act.step.other === b.id);
      if (job || ball.owner === b.id) urgency = 0.95;
      if (this.layout === 'kickoff') urgency = 0.5;
      const press = pressing.get(b.id);
      if (press && !job) {
        // Stop a yard short of the man on the ball.
        const dx = ball.x - t.x;
        const dy = ball.y - t.y;
        t = { x: t.x + dx * press, y: t.y + dy * press };
        urgency = 0.85;
      } else if (!job && this.layout === 'play' && b.side !== this.attacking && b.pos === 'DEF' && attackers.length) {
        // Defenders pick up the nearest attacker, goal-side of him.
        const mark = attackers.reduce((best, x) => (dist(x.x, x.y, t.x, t.y) < dist(best.x, best.y, t.x, t.y) ? x : best), attackers[0]);
        if (dist(mark.x, mark.y, t.x, t.y) < 14) {
          const goalY = b.side === 'home' ? 0 : PL;
          const gy = mark.y + (goalY > mark.y ? 2 : -2);
          t = { x: t.x * 0.5 + mark.x * 0.5, y: t.y * 0.5 + gy * 0.5 };
        }
      }
      if (this.celebrate && b.side !== this.celebrate.side) urgency = 0.3;
      if (this.holding) urgency *= 0.6;
      const dx = t.x - b.x;
      const dy = t.y - b.y;
      const d = Math.hypot(dx, dy);
      const keeperDive = b.pos === 'GK' && this.act && (this.act.step.act === 'goal' || this.act.step.act === 'save' || this.act.step.act === 'miss') && !!ball.flight;
      const top = b.top * (keeperDive ? 1.5 : urgency);
      const want = Math.min(top, d * 1.8);
      const wx = d > 0.01 ? (dx / d) * want : 0;
      const wy = d > 0.01 ? (dy / d) * want : 0;
      const k = Math.min(1, dt * (keeperDive ? 9 : 4));
      b.vx += (wx - b.vx) * k;
      b.vy += (wy - b.vy) * k;
      b.x += b.vx * dt;
      b.y += b.vy * dt;
    }
    // Nobody stands inside anybody else. The player with a job (on the ball,
    // receiving, tackling) has right of way: others step aside, sideways
    // as well as back, so two players never lock head to head.
    const busy = new Set([ball.owner, this.act?.step.carrier, this.act?.step.other].filter(Boolean) as string[]);
    for (let i = 0; i < list.length; i++) {
      for (let j = i + 1; j < list.length; j++) {
        const p = list[i];
        const q = list[j];
        const d = dist(p.x, p.y, q.x, q.y);
        if (d < 1.7 && d > 0.001) {
          const push = ((1.7 - d) / 2) * 0.5;
          const ux = (p.x - q.x) / d;
          const uy = (p.y - q.y) / d;
          const pk = busy.has(p.id) ? 0 : busy.has(q.id) ? 2 : 1;
          const qk = busy.has(q.id) ? 0 : busy.has(p.id) ? 2 : 1;
          p.x += (ux - uy * 0.5) * push * pk;
          p.y += (uy + ux * 0.5) * push * pk;
          q.x -= (ux - uy * 0.5) * push * qk;
          q.y -= (uy + ux * 0.5) * push * qk;
        }
      }
    }
    for (const b of list) {
      b.x = clamp(b.x, -1.5, PW + 1.5);
      b.y = clamp(b.y, -1, PL + 1);
    }
  }
}

function xy(p: { x: number; y: number }): [number, number] {
  return [p.x, p.y];
}

// Top speed in metres per second: 6.2 for the slowest, 8.6 for the quickest.
function topSpeed(info: BodyInfo): number {
  return (info.pos === 'GK' ? 5.4 : 6.2) + (clamp(info.pace, 20, 99) - 20) * 0.03;
}

function hash(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0;
  return (h % 1000) / 1000;
}
