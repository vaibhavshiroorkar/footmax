import { Position } from '../engine/types';
import { PlayStep, Restart, Spot, defendingSide, toPitch } from '../engine/play';
import { CELEBRATIONS, celebrationText } from '../engine/creation';

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
  // Subbed off, sent off or injured: walks to the touchline, then goes.
  leaving?: boolean;
}

interface Flight {
  fx: number;
  fy: number;
  tx: number;
  ty: number;
  t: number;
  dur: number;
  peak: number;
  // Sideways bend at the middle of the flight, in metres (+ to the left of
  // the line of travel). It starts and ends where it was going, so a curl
  // never changes where the ball lands.
  curl?: number;
}

export interface Callout {
  text: string;
  sub?: string;
  tone: 'goal' | 'save' | 'miss' | 'stop' | 'yellow' | 'red';
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
// The match clock is separate: see pace.ts.
const TIME = 1.95;
// Goals keep their moment: the celebration lasts as long in real time as
// it did when play ran at 1.8.
const HOLD = TIME / 1.8;
// How long a VAR check holds play, in pitch seconds.
const VAR_HOLD = 3.4 * HOLD;

export class PitchSim {
  bodies = new Map<string, Body>();
  // rot: how far the ball has turned (degrees), so it spins as it rolls.
  ball = { x: PW / 2, y: PL / 2, z: 0, rot: 0, owner: null as string | null, flight: null as Flight | null, vx: 0, vy: 0 };
  queue: PlayStep[] = [];
  act: Active | null = null;
  clock = 0;
  // Side in possession, for team shape.
  attacking: 'home' | 'away' | null = null;
  holding = false;
  layout: 'play' | 'kickoff' = 'kickoff';
  kickoffSide: 'home' | 'away' = 'home';
  // A goal celebration: the scorer runs to the corner and does his thing
  // (style, see CELEBRATIONS); team-mates pile in after him.
  celebrate: { at: number; until: number; scorer: string | null; side: 'home' | 'away'; cx: number; cy: number; style: string; told?: boolean } | null = null;
  // Each player's own celebration, when he has one (the career player).
  celebrations: Record<string, string> = {};
  // A VAR check in progress: when it started and where the monitor stands.
  varCheck: { at: number; x: number; y: number } | null = null;
  caption = 'Teams are out. Waiting for kick off.';
  callout: Callout | null = null;
  hooks: SimHooks = {};
  // The user's player: where he plays and his current call. He moves on
  // them: higher or deeper by zone, in behind on a run, short to the ball
  // when calling for it, goal-side and pressing when tracking back.
  focus: { id: string; zone: 'defend' | 'middle' | 'attack'; shout: 'call' | 'run' | 'track' | null } | null = null;
  // The referee: keeps up with play from a diagonal, runs over to book.
  ref = { x: PW / 2 + 10, y: PL / 2 - 4, vx: 0, vy: 0 };
  // A dead-ball restart being set up: who takes it, where, and (free kicks
  // near goal) who stands in the wall.
  setPiece: { kind: Restart; side: 'home' | 'away'; x: number; y: number; wall: string[] } | null = null;
  private prevStep: PlayStep | null = null;
  // Each side's offside line this frame (depth in metres from its own goal).
  offsideLine = { home: PL, away: PL };

  setCelebration(id: string, style: string) {
    this.celebrations[id] = style;
  }

  setHooks(h: SimHooks) {
    this.hooks = h;
  }

  // Adds new players (subs come on from the halfway line) and drops those
  // who went off.
  sync(infos: BodyInfo[]) {
    const keep = new Set(infos.map((i) => i.id));
    for (const [id, b] of [...this.bodies]) {
      if (keep.has(id)) continue;
      if (this.layout === 'kickoff' && !this.act) this.bodies.delete(id);
      else b.leaving = true;
    }
    for (const info of infos) {
      const b = this.bodies.get(info.id);
      if (b) {
        Object.assign(b, info, { top: topSpeed(info), leaving: false });
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
    let p = M(toPitch(b.side, { depth, lat: b.spot.lat }));
    // Players sharing a slot (two strikers up top) stand apart.
    if (!keeper) p.x = clamp(p.x + (hash(b.id) - 0.5) * 7, 3, PW - 3);
    if (!keeper && b.side !== this.kickoffSide) {
      const d = dist(p.x, p.y, PW / 2, PL / 2);
      if (d < CIRCLE + 0.6) {
        const ux = d > 0.01 ? (p.x - PW / 2) / d : 0;
        const uy = d > 0.01 ? (p.y - PL / 2) / d : b.side === 'home' ? -1 : 1;
        p = { x: PW / 2 + ux * (CIRCLE + 0.6), y: PL / 2 + uy * (CIRCLE + 0.6) };
      }
    }
    // Nobody over the halfway line.
    p.y = b.side === 'home' ? Math.min(p.y, PL / 2 - 0.6) : Math.max(p.y, PL / 2 + 0.6);
    return p;
  }

  // Players still in the game (not walking off).
  active(): Body[] {
    return [...this.bodies.values()].filter((b) => !b.leaving);
  }

  // Opponents standing between a shooter and the goal he faces, so the shot
  // game can draw the same men the pitch shows. x is where each one sits
  // across the goal from the shooter's view (as PlayStep.aim). half is how
  // much of the goal's width his body hides either side: a man close to the
  // shooter hides more. near is 1 right at the shooter, 0 on the goal line.
  laneDefenders(shooterId: string): { id: string; x: number; half: number; near: number }[] {
    const s = this.bodies.get(shooterId);
    if (!s) return [];
    const defSide = s.side === 'home' ? 'away' : 'home';
    const lineY = defSide === 'home' ? 0 : PL;
    const toGoal = lineY - s.y;
    if (Math.abs(toGoal) < 2) return [];
    const flip = defSide === 'away' ? 1 : -1;
    const out: { id: string; x: number; half: number; near: number; d: number }[] = [];
    for (const b of this.active()) {
      if (b.side !== defSide || b.pos === 'GK' || b.down > 0) continue;
      const ahead = (b.y - s.y) / toGoal;
      const d = dist(b.x, b.y, s.x, s.y);
      if (ahead <= 0.03 || ahead >= 0.95 || d > 30) continue;
      const gx = s.x + (b.x - s.x) / ahead;
      const x = 0.5 + ((gx - PW / 2) / (2 * GOAL_HALF)) * flip;
      if (x < -0.2 || x > 1.2) continue;
      // About 0.45 m of body each side of him, seen from the shooter.
      const half = clamp(0.45 / ahead / (2 * GOAL_HALF), 0.04, 0.12);
      out.push({ id: b.id, x, half, near: 1 - ahead, d });
    }
    return out
      .sort((a, b) => a.d - b.d)
      .slice(0, 5)
      .map(({ id, x, half, near }) => ({ id, x, half, near }));
  }

  // The goal as the shooter sees it at this moment, for the shot game: where
  // the keeper really stands across it (as PlayStep.aim), how far off his line
  // he is, the middle of any wall, and team-mates ahead of the shooter.
  shotScene(shooterId: string): { keeper: number; out: number; wall?: number; mates: { id: string; x: number; near: number }[] } {
    const s = this.bodies.get(shooterId);
    if (!s) return { keeper: 0.5, out: 0, mates: [] };
    const defSide = s.side === 'home' ? 'away' : 'home';
    const lineY = defSide === 'home' ? 0 : PL;
    const flip = defSide === 'away' ? 1 : -1;
    const toGoal = lineY - s.y;
    // Where a body lands on the goal line, seen from the shooter.
    const across = (b: { x: number; y: number }) => {
      const ahead = (b.y - s.y) / toGoal;
      const gx = ahead > 0.02 ? s.x + (b.x - s.x) / ahead : b.x;
      return 0.5 + ((gx - PW / 2) / (2 * GOAL_HALF)) * flip;
    };
    const k = this.active().find((b) => b.pos === 'GK' && b.side === defSide);
    const wall = this.setPiece?.wall.map((id) => this.bodies.get(id)).filter((b): b is Body => !!b) ?? [];
    return {
      keeper: k ? clamp(across(k), 0.12, 0.88) : 0.5,
      out: k ? Math.abs(k.y - lineY) : 0,
      wall: wall.length ? wall.reduce((n, b) => n + across(b), 0) / wall.length : undefined,
      mates: this.active()
        .filter((b) => b.side === s.side && b.id !== s.id && b.pos !== 'GK' && (b.y - s.y) / toGoal > 0.03 && (b.y - s.y) / toGoal < 0.95 && dist(b.x, b.y, s.x, s.y) < 30)
        .map((b) => ({ id: b.id, x: across(b), near: 1 - (b.y - s.y) / toGoal }))
        .filter((m) => m.x > -0.4 && m.x < 1.4)
        .slice(0, 4),
    };
  }

  // Where a shooter stands across the goal he faces, from his own view:
  // -1 well out to his left, 0 straight in front, 1 well out to his right.
  shotAngle(shooterId: string): number {
    const s = this.bodies.get(shooterId);
    if (!s) return 0;
    const flip = s.side === 'home' ? 1 : -1;
    return clamp(((s.x - PW / 2) * flip) / 16, -1, 1);
  }

  // Is this player still part of the move on screen or the one queued?
  private referenced(id: string): boolean {
    const a = this.act?.step;
    if (a && (a.carrier === id || a.other === id)) return true;
    return this.queue.some((st) => st.carrier === id || st.other === id);
  }

  // Are the other side far enough away for the restart to be taken?
  restartClear(step: PlayStep): boolean {
    const opp = this.active().filter((b) => b.side !== step.side && b.pos !== 'GK' && b.down <= 0);
    if (step.restart === 'goalkick') return opp.every((b) => !inBox(b, step.side));
    const need = step.restart === 'throw' ? 2 : FK_DISTANCE - 0.3;
    return opp.every((b) => dist(b.x, b.y, this.ball.x, this.ball.y) >= need);
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

  // Is the rest of this move quiet (no shot or key moment coming)? Only then
  // may the user take over: a move heading for a shot already has a result.
  quietAhead(): boolean {
    const busy = (a: PlayStep['act']) => a === 'goal' || a === 'save' || a === 'miss' || a === 'moment' || a === 'cross';
    if (this.act && busy(this.act.step.act)) return false;
    return !this.queue.some((st) => busy(st.act));
  }

  // The user acts on the ball: drop the rest of the move and hold play
  // around him while he decides.
  takeOver(playerId: string) {
    const b = this.bodies.get(playerId);
    if (!b) return;
    this.queue = [];
    this.ball.owner = playerId;
    this.ball.flight = null;
    this.attacking = b.side;
    this.act = { step: { x: this.ball.x / PW, y: this.ball.y / PL, carrier: playerId, side: b.side, act: 'moment' }, t: 0, stage: 0, wait: 0, from: playerId, tx: b.x, ty: b.y };
    this.holding = true;
    this.caption = 'Your call!';
  }

  // Nothing left to show: the match can move on to the next minute.
  idle(): boolean {
    return !this.act && !this.queue.length && !this.celebrate && !this.holding;
  }

  private name(id: string | null | undefined) {
    return id ? this.bodies.get(id)?.name ?? '' : '';
  }

  // Everyone's place, as shares of the pitch (see stepWatched).
  positions(): Record<string, { x: number; y: number }> {
    const out: Record<string, { x: number; y: number }> = {};
    for (const b of this.bodies.values()) out[b.id] = { x: b.x / PW, y: b.y / PL };
    return out;
  }

  // How long the pitch has played, in seconds at 1x.
  pitchSeconds(): number {
    return this.clock / TIME;
  }

  update(rawDt: number) {
    const dt = rawDt * TIME;
    if (dt <= 0) return;
    this.clock += dt;
    if (this.callout && this.clock > this.callout.until) this.callout = null;
    this.runAction(dt);
    this.moveBall(dt);
    this.moveBodies(dt);
    this.moveRef(dt);
  }

  private moveRef(dt: number) {
    const r = this.ref;
    const ball = this.ball;
    const a = this.act?.step;
    let tx: number;
    let ty: number;
    const booked = a?.act === 'card' && a.carrier ? this.bodies.get(a.carrier) : undefined;
    if (this.varCheck) {
      // Over to the monitor at the touchline.
      tx = this.varCheck.x + 1.2;
      ty = this.varCheck.y;
    } else if (booked) {
      tx = booked.x + 1.6;
      ty = booked.y + 0.8;
    } else if (this.layout === 'kickoff') {
      tx = PW / 2 + 12;
      ty = PL / 2 - 3;
    } else {
      // Behind play and off to one side, so he sees it without being in it.
      const dir = this.attacking === 'away' ? -1 : 1;
      tx = clamp(ball.x + (ball.x < PW / 2 ? 11 : -11), 5, PW - 5);
      ty = clamp(ball.y - dir * 9, 6, PL - 6);
    }
    const dx = tx - r.x;
    const dy = ty - r.y;
    const d = Math.hypot(dx, dy);
    const want = Math.min(booked ? 7.5 : 6.5, d * 1.4);
    const wx = d > 0.01 ? (dx / d) * want : 0;
    const wy = d > 0.01 ? (dy / d) * want : 0;
    const k = Math.min(1, dt * 3.5);
    r.vx += (wx - r.vx) * k;
    r.vy += (wy - r.vy) * k;
    r.x = clamp(r.x + r.vx * dt, 0.5, PW - 0.5);
    r.y = clamp(r.y + r.vy * dt, 0.5, PL - 0.5);
  }

  // --- The scripted move -------------------------------------------------

  private begin(step: PlayStep) {
    const target = M(step);
    const owner = this.ball.owner;
    const prev = this.prevStep;
    this.prevStep = step;
    this.act = { step, t: 0, stage: 0, wait: 0, from: owner, tx: target.x, ty: target.y };
    const who = this.name(step.carrier);
    // A restart's shape lasts through the ball being put back in play.
    if (step.act === 'start' && step.restart && step.restart !== 'kickoff') {
      const defSide = step.side === 'home' ? 'away' : 'home';
      const goal = { x: PW / 2, y: defSide === 'home' ? 0 : PL };
      const wall =
        step.restart === 'freekick' && dist(target.x, target.y, goal.x, goal.y) < 36
          ? this.active()
              .filter((b) => b.side === defSide && b.pos !== 'GK')
              .sort((p, q) => dist(p.x, p.y, target.x, target.y) - dist(q.x, q.y, target.x, target.y))
              .slice(0, 4)
              .map((b) => b.id)
          : [];
      this.setPiece = { kind: step.restart, side: step.side, x: target.x, y: target.y, wall };
    } else if (step.act !== 'start' && !(prev?.act === 'start' && prev.restart)) this.setPiece = null;
    switch (step.act) {
      case 'start':
        if (step.restart) {
          if (dist(this.ball.x, this.ball.y, target.x, target.y) > 3) {
            // Fetched back to where the restart is taken.
            const d = dist(this.ball.x, this.ball.y, target.x, target.y);
            this.ball = { ...this.ball, owner: null, vx: 0, vy: 0, flight: { fx: this.ball.x, fy: this.ball.y, tx: target.x, ty: target.y, t: 0, dur: Math.min(1.2, d / 22), peak: 1 } };
          } else this.ball = { ...this.ball, owner: null, flight: null, vx: 0, vy: 0, z: 0, x: target.x, y: target.y };
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
        // A throw-in leaves the hands: a short, looping ball.
        const thrown = prev?.act === 'start' && prev.restart === 'throw';
        const speed = thrown ? 12 : step.act === 'cross' ? 15 : d > 30 ? 19 : 15;
        const peak = thrown ? 1.6 : step.act === 'cross' ? 4 : d > 30 ? 3 : d > 18 ? 0.8 : 0;
        // Crosses are whipped in and bend; long balls drift; short ones run
        // almost straight.
        const bend = thrown ? 0 : step.act === 'cross' ? 2.4 + Math.random() * 1.6 : d > 30 ? 1 + Math.random() : d > 18 ? 0.5 : 0.15;
        this.ball.owner = null;
        this.ball.flight = { fx, fy, tx, ty, t: 0, dur: Math.max(0.45, d / speed), peak, curl: bend * (Math.random() < 0.5 ? -1 : 1) };
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
        const defSide = defendingSide(step);
        const keeper = this.active().find((b) => b.pos === 'GK' && b.side === defSide);
        const lineY = defSide === 'home' ? 0 : PL;
        const inward = defSide === 'home' ? 1 : -1;
        const kx = keeper?.x ?? PW / 2;
        const lo = PW / 2 - GOAL_HALF + 0.35;
        const hi = PW / 2 + GOAL_HALF - 0.35;
        let tx: number;
        let toward: number;
        let dive: number;
        // The shooter faces the defending goal: for the home side (attacking
        // up the pitch) his left post is at low x, for the away side at high x.
        const aimX = step.aim === undefined ? undefined : PW / 2 + (step.aim - 0.5) * 2 * GOAL_HALF * (defSide === 'away' ? 1 : -1);
        if (aimX !== undefined) {
          tx = aimX;
          if (step.act === 'save') {
            // He gets to it: that is what a save is.
            toward = lineY + inward * 0.9;
            dive = tx;
          } else if (step.act === 'goal') {
            toward = lineY - inward * 1.6;
            // Full stretch, a little short.
            const gap = Math.abs(tx - kx);
            dive = kx + Math.sign(tx - kx) * Math.max(0, gap - 1.4);
          } else {
            toward = lineY - inward * 2;
            dive = kx + clamp(tx - kx, -0.8, 0.8);
          }
        } else if (step.act === 'save') {
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
        // Blocked: the ball hits the defender the shot game showed in the
        // way, or (for 'lane' and 'wall') whoever stands in the way here.
        let blocker = step.blocker ? this.bodies.get(step.blocker) : undefined;
        if (step.blocker && !blocker && shooter) {
          const lane = this.laneDefenders(shooter.id).sort((p, q) => Math.abs(p.x - (step.aim ?? 0.5)) - Math.abs(q.x - (step.aim ?? 0.5)))[0];
          blocker = lane ? this.bodies.get(lane.id) : undefined;
          if (blocker) step.blocker = blocker.id;
        }
        if (step.blocker) {
          // Nobody near enough: it hits the first man a few metres out.
          tx = blocker ? blocker.x : clamp(this.ball.x + (tx - this.ball.x) * 0.25, 2, PW - 2);
          toward = blocker ? blocker.y : this.ball.y + (toward - this.ball.y) * 0.25;
          dive = kx;
        }
        this.act.keeperId = keeper?.id;
        this.act.kx = dive;
        this.act.ky = lineY + inward * 0.7;
        const fx = this.ball.x;
        const fy = this.ball.y;
        const d = dist(fx, fy, tx, toward);
        this.ball.owner = null;
        // A touch of pace variety, so no two shots fly the same.
        let dur = Math.max(0.3, d / (step.header ? 17 : 27)) * (0.9 + Math.random() * 0.2);
        // A save means he gets there, so the ball never beats his dive.
        if (step.act === 'save' && keeper) dur = Math.max(dur, (dist(keeper.x, keeper.y, tx, lineY + inward * 0.7) / (keeper.top * 1.5)) * 1.25 + 0.1);
        // How it was struck: the user's choice, or a mix for everyone else.
        const shape = step.shape ?? (step.header ? 'driven' : Math.random() < 0.3 ? 'curl' : Math.random() < 0.3 ? 'low' : 'driven');
        // Over the bar when the match says so; otherwise each kind of strike
        // has its own height, with some spread.
        const r = Math.random();
        const over = step.act === 'miss' && !step.blocker && (step.over ?? (step.aim === undefined && Math.random() < 0.4));
        const peak = over ? 3 + r * 0.8 : step.header ? 0.5 + r * 0.3 : shape === 'low' ? 0.08 + r * 0.1 : shape === 'curl' ? 1.1 + r * 0.8 : 0.4 + r * 0.6;
        // A curler starts outside its target and bends back in: the bend
        // points away from the middle of the goal. Driven and low shots
        // swerve a little either way.
        const len = Math.max(0.1, dist(fx, fy, tx, toward));
        const perpX = -(toward - fy) / len;
        let curl = (Math.random() - 0.5) * (shape === 'low' ? 0.6 : 1.4);
        if (shape === 'curl' && !step.blocker) {
          const out = Math.sign(tx - PW / 2) || (Math.random() < 0.5 ? -1 : 1);
          curl = (1.6 + Math.random() * 1.8) * (Math.sign(perpX * out) || 1);
        }
        this.ball.flight = { fx, fy, tx, ty: toward, t: 0, dur: shape === 'low' ? dur * 0.92 : dur, peak, curl };
        this.hooks.onSound?.('kick', 1);
        this.caption = step.header
          ? `${this.name(shooter?.id)} goes for the header!`
          : shape === 'curl'
            ? `${this.name(shooter?.id)} tries to curl one in!`
            : shape === 'low'
              ? `${this.name(shooter?.id)} drills it low!`
              : `${this.name(shooter?.id)} shoots!`;
        this.act.from = shooter?.id ?? null;
        break;
      }
      case 'moment':
        this.caption = 'Your moment!';
        break;
      case 'card':
        this.ball = { ...this.ball, owner: null, vx: 0, vy: 0 };
        this.caption = step.card === 'red' ? `Red card! ${who} is sent off` : `${who} is booked`;
        break;
      case 'injury': {
        const hurt = step.carrier ? this.bodies.get(step.carrier) : undefined;
        if (hurt) hurt.down = 3.5;
        this.ball = { ...this.ball, owner: null, vx: 0, vy: 0 };
        this.callout = { text: 'INJURY', sub: who, tone: 'stop', until: this.clock + 1.8 };
        this.hooks.onSound?.('whistle', 0.7);
        this.caption = `${who} is down injured`;
        break;
      }
    }
  }

  private runAction(dt: number) {
    if (this.celebrate) {
      const c = this.celebrate;
      // Once he is away, the caption says what he does.
      if (!c.told && this.clock > c.at + 1.1 * HOLD) {
        c.told = true;
        this.caption = `${this.name(c.scorer).replace(/^#\d* /, '')} ${celebrationText(c.style)}`;
      }
      if (this.clock > c.until) this.celebrate = null;
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
          // Lined up by the law: everyone in his own half, the other side
          // outside the circle, and roughly in place.
          const settled = this.active().every((b) => {
            if (b.id === carrier?.id) return true;
            const own = b.side === 'home' ? b.y <= PL / 2 - 0.3 : b.y >= PL / 2 + 0.3;
            const circle = b.side === this.kickoffSide || dist(b.x, b.y, PW / 2, PL / 2) >= CIRCLE;
            return own && circle && dist(b.x, b.y, ...xy(this.targetFor(b))) < 4;
          });
          if (!carrier) return done();
          // Both sides must be in their own half first; the referee waits.
          if ((settled || a.t > 14) && dist(carrier.x, carrier.y, this.ball.x, this.ball.y) < 2) {
            this.hooks.onSound?.('whistle', 0.8);
            this.ball.owner = carrier.id;
            this.attacking = carrier.side;
            this.layout = 'play';
            return done();
          }
          return;
        }
        if (!carrier) return done();
        if (a.stage === 0) {
          if (this.ball.flight) return;
          if (this.ball.owner === carrier.id || dist(carrier.x, carrier.y, this.ball.x, this.ball.y) < 1.8 || a.t > 6) {
            this.ball.owner = carrier.id;
            this.ball.flight = null;
            this.attacking = carrier.side;
            this.layout = 'play';
            if (!step.restart) return done();
            a.stage = 1;
            a.t = 0;
          }
          return;
        }
        // A set piece: taken once the other side has backed off.
        if (a.t > 0.7 && (this.restartClear(step) || a.t > 5)) {
          if (step.restart === 'freekick' || step.restart === 'corner') this.hooks.onSound?.('whistle', 0.45);
          return done();
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
        // He has to get there: a tackle from afar waits for him to arrive.
        if (dist(carrier.x, carrier.y, this.ball.x, this.ball.y) < 2 || a.t > 3.6) {
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
        // VAR: hold play while the referee checks the monitor, then call it.
        if (step.act === 'goal' && step.var && a.stage === 0) {
          a.stage = 5;
          this.varCheck = { at: this.clock, x: 0.8, y: PL / 2 };
          this.callout = { text: 'VAR CHECK', sub: 'Checking the goal', tone: 'stop', until: this.clock + VAR_HOLD };
          this.caption = 'VAR is checking the goal...';
          this.hooks.onSound?.('whistle', 0.6);
          this.ball.owner = null;
          return;
        }
        if (a.stage === 5) {
          if (this.clock < (this.varCheck?.at ?? 0) + VAR_HOLD) return;
          this.varCheck = null;
          if (step.var === 'overturned') {
            a.stage = 1;
            this.callout = { text: 'NO GOAL', sub: step.varReason, tone: 'stop', until: this.clock + 1.6 * HOLD };
            this.caption = `VAR: no goal. ${step.varReason ?? ''}`;
            this.hooks.onSound?.('whistle', 0.9);
            return pause(1.4);
          }
          a.stage = 0;
          step.var = undefined;
        }
        if (a.stage === 0) {
          a.stage = 1;
          const shooter = this.name(a.from);
          if (step.act === 'goal') {
            this.callout = { text: 'GOAL!', sub: shooter, tone: 'goal', side: step.side, until: this.clock + 3 * HOLD };
            this.caption = `GOAL! ${shooter}`;
            this.hooks.onGoal?.();
            this.hooks.onSound?.('goal', 1);
            const scorer = a.from ? this.bodies.get(a.from) : undefined;
            const cy = step.side === 'home' ? PL - 6 : 6;
            const cx = (scorer?.x ?? PW / 2) < PW / 2 ? 4 : PW - 4;
            const style = (a.from && this.celebrations[a.from]) || CELEBRATIONS[Math.floor(Math.random() * CELEBRATIONS.length)].id;
            this.celebrate = { at: this.clock, until: this.clock + 4.2 * HOLD, scorer: a.from, side: step.side, cx, cy, style };
            this.ball.owner = null;
            this.ball.vx = 0;
            this.ball.vy = 0;
            return done();
          }
          if (step.act === 'save') {
            // Half the time the keeper holds it; otherwise he parries it out
            // and gathers it a moment later.
            if (step.restart === 'corner') {
              // Tipped round the post: out behind the goal line.
              const lineY = step.side === 'home' ? PL : 0;
              const out = step.side === 'home' ? 1 : -1;
              this.ball.flight = { fx: this.ball.x, fy: this.ball.y, tx: clamp(this.ball.x + (this.ball.x < PW / 2 ? -5 : 5), 2, PW - 2), ty: lineY + out * 1.5, t: 0, dur: 0.5, peak: 1.4 };
              this.ball.owner = null;
              this.callout = { text: 'SAVED!', sub: 'Tipped behind. Corner.', tone: 'save', until: this.clock + 1.5 };
              this.hooks.onSound?.('ooh', 0.8);
              this.caption = `${shooter} shoots... tipped behind by ${carrier?.name ?? 'the keeper'}`;
              return pause(1.4);
            }
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
          if (step.blocker) {
            // Off his body and behind the goal line: a corner.
            const lineY = step.side === 'home' ? PL : 0;
            const out = step.side === 'home' ? 1 : -1;
            this.ball.flight = { fx: this.ball.x, fy: this.ball.y, tx: clamp(this.ball.x + (this.ball.x < PW / 2 ? -6 : 6), 2, PW - 2), ty: lineY + out * 1.5, t: 0, dur: 0.6, peak: 1.6 };
            const by = this.name(step.blocker);
            this.callout = { text: 'BLOCKED!', sub: by ? `${by}. Corner.` : 'Corner.', tone: 'stop', until: this.clock + 1.4 };
            this.hooks.onSound?.('ooh', 0.7);
            this.caption = by ? `${shooter} shoots... blocked by ${by}` : `${shooter} shoots... blocked`;
            return pause(1.4);
          }
          const overBar = step.over ?? (step.aim === undefined ? !!step.header : step.aim >= 0 && step.aim <= 1);
          this.callout = { text: overBar ? 'OVER!' : 'WIDE!', sub: step.restart === 'corner' ? 'Off a defender. Corner.' : undefined, tone: 'miss', until: this.clock + 1.2 };
          this.hooks.onSound?.('ooh', 0.7);
          this.caption = `${shooter} misses the target`;
          return pause(1.2);
        }
        return done();
      }
      case 'card': {
        // The referee runs over, then out comes the card.
        if (a.stage === 0) {
          const near = !carrier || dist(this.ref.x, this.ref.y, carrier.x, carrier.y) < 3;
          if (!near && a.t < 2.5) return;
          a.stage = 1;
          const red = step.card === 'red';
          this.callout = { text: red ? 'RED CARD' : 'YELLOW CARD', sub: carrier?.name, tone: red ? 'red' : 'yellow', until: this.clock + 1.8 };
          this.hooks.onSound?.('whistle', 0.6);
          if (red && carrier) carrier.leaving = true;
          return pause(1.6);
        }
        return done();
      }
      case 'injury': {
        if (a.t < 2.2) return;
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
      const len = Math.max(0.1, dist(f.fx, f.fy, f.tx, f.ty));
      const bend = (f.curl ?? 0) * 4 * e * (1 - e);
      const px = b.x;
      const py = b.y;
      b.x = f.fx + (f.tx - f.fx) * e + (-(f.ty - f.fy) / len) * bend;
      b.y = f.fy + (f.ty - f.fy) * e + ((f.tx - f.fx) / len) * bend;
      b.z = 4 * f.peak * k * (1 - k);
      b.rot = (b.rot + dist(px, py, b.x, b.y) * 85) % 360;
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
      const px = b.x;
      const py = b.y;
      // Eases to his feet, and glides rather than jumps if he is far from it.
      const gx = owner.x + dx * 0.9 - b.x;
      const gy = owner.y + dy * 0.9 - b.y;
      const gap = Math.hypot(gx, gy);
      const move = Math.min(gap * Math.min(1, dt * 14), BALL_GLIDE * dt);
      if (gap > 0.001) {
        b.x += (gx / gap) * move;
        b.y += (gy / gap) * move;
      }
      b.rot = (b.rot + dist(px, py, b.x, b.y) * 85) % 360;
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
      // Team-mates chase him, then crowd round him; the keeper claps from
      // his box.
      const near = this.clock > c.at + 1.4 * HOLD ? 1.6 : 4;
      if (b.side === c.side && b.pos !== 'GK') return { x: c.cx + Math.sin(b.phase) * near, y: c.cy + Math.cos(b.phase) * near + (c.side === 'home' ? -1.5 : 1.5) };
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
    const sp = this.setPiece;
    if (sp && !this.celebrate && b.pos !== 'GK') {
      const spot = this.setPieceSpot(b, sp);
      if (spot) return spot;
    }
    if (ball.owner === b.id) {
      // Nothing to do yet: carry it on toward goal.
      if (!a && this.layout === 'play' && b.pos !== 'GK') return { x: b.x + (PW / 2 - b.x) * 0.08, y: clamp(b.y + (b.side === 'home' ? 1.5 : -1.5), 4, PL - 4) };
      return { x: b.x + b.vx * 0.3, y: b.y + b.vy * 0.3 };
    }
    const inPossession = this.attacking === b.side;
    return this.shapeSpot(b, 1, inPossession);
  }

  // Where players stand for a corner or a free kick near goal: attackers
  // in the box, defenders marking in it, and a wall 9.15 metres off the ball.
  private setPieceSpot(b: Body, sp: NonNullable<PitchSim['setPiece']>): { x: number; y: number } | null {
    const attackingSide = sp.side;
    const defSide = attackingSide === 'home' ? 'away' : 'home';
    const goalY = defSide === 'home' ? 0 : PL;
    const inward = defSide === 'home' ? 1 : -1;
    const h = hash(b.id);
    if (sp.kind === 'corner') {
      if (b.side === attackingSide && b.pos !== 'DEF') return { x: PW / 2 + (h - 0.5) * 22, y: goalY + inward * (6 + ((h * 7) % 1) * 7) };
      if (b.side === defSide) return { x: PW / 2 + (h - 0.5) * 26, y: goalY + inward * (2.5 + ((h * 5) % 1) * 9) };
      return null;
    }
    if (sp.kind === 'freekick' && sp.wall.length) {
      const i = sp.wall.indexOf(b.id);
      if (i >= 0) {
        // On the line from the ball to the middle of the goal.
        const gx = PW / 2 - sp.x;
        const gy = goalY - sp.y;
        const gd = Math.hypot(gx, gy) || 1;
        const ux = gx / gd;
        const uy = gy / gd;
        const off = (i - (sp.wall.length - 1) / 2) * 0.85;
        return { x: sp.x + ux * FK_DISTANCE - uy * off, y: sp.y + uy * FK_DISTANCE + ux * off };
      }
      if (b.side === attackingSide && b.pos === 'FWD') return { x: PW / 2 + (h - 0.5) * 18, y: goalY + inward * (8 + h * 5) };
    }
    return null;
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
      // Across his goal with the ball, and never outside his posts.
      lat = 0.5 + (bl - 0.5) * 0.1;
      // They have it near his goal: off his line to narrow the angle.
      if (!inPossession && this.ball.owner && bd < 0.34) {
        depth = Math.max(depth, bd * 0.5);
        lat = 0.5 + (bl - 0.5) * 0.6;
      }
      // Never out of his own penalty area in open play.
      depth = Math.min(depth, BOX_DEPTH / PL - 0.01);
      lat = clamp(lat, 0.5 - BOX_HALF / PW + 0.01, 0.5 + BOX_HALF / PW - 0.01);
      const target = M(toPitch(b.side, { depth: clamp(depth, 0.01, 0.2), lat }));
      if (weight >= 1) return target;
      return { x: b.x + (target.x - b.x) * weight, y: b.y + (target.y - b.y) * weight };
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
      // A block that moves as one: a back line ahead of the ball's run to
      // goal, the lines in front of it, the whole shape sliding to the ball.
      const back = clamp(bd - LINE_BEHIND, 0.09, 0.44);
      const rank = clamp((b.spot.depth - 0.2) / 0.56, 0, 1);
      depth = back + rank * BLOCK_DEPTH;
      // It narrows to the width of the box as the ball gets near goal.
      const width = BLOCK_WIDTH * clamp(0.5 + bd * 1.4, 0.55, 1);
      lat = 0.5 + (bl - 0.5) * 0.55 + (b.spot.lat - 0.5) * width;
      // Defenders stay goal-side of the ball.
      if (b.pos === 'DEF') depth = Math.min(depth, Math.max(0.05, bd - 0.03));
    }
    const f = this.focus;
    if (f && f.id === b.id) {
      // About 15 metres up or back, so the choice is plain to see.
      depth += (f.zone === 'attack' ? 0.15 : f.zone === 'defend' ? -0.15 : 0) * (inPossession ? 1 : 0.8);
      if (f.zone === 'attack') depth = Math.max(depth, Math.min(0.85, bd + 0.08));
      if (f.zone === 'defend') depth = Math.min(depth, Math.max(0.12, bd - 0.12));
      if (f.zone === 'middle') {
        // The middle of the park, near the ball.
        depth = depth * 0.5 + (bd + 0.02) * 0.5;
        lat = lat * 0.5 + bl * 0.3 + 0.1;
      }
      if (f.shout === 'run') {
        // In behind the ball, toward the middle; he stays high when it is lost.
        // Into the box; the offside line holds him level until the ball comes.
        if (inPossession) {
          depth = Math.max(depth, 0.86);
          lat = lat * 0.4 + 0.3;
        } else depth += 0.08;
      } else if (f.shout === 'call' && inPossession) {
        // Short, to one side of the ball, showing for it.
        depth = depth * 0.4 + (bd - 0.06) * 0.6;
        lat = bl + (lat < bl ? -0.13 : 0.13);
      } else if (f.shout === 'track' && !inPossession) {
        // Goal-side of the ball.
        depth = Math.min(depth - 0.08, bd - 0.05);
        lat = lat * 0.5 + bl * 0.5;
      }
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
    const live = list.filter((b) => !b.leaving);
    const pressing = new Map<string, number>();
    const cover = new Map<string, { x: number; y: number }>();
    const sp = this.setPiece;
    const restarting = !!sp && this.act?.step.act === 'start';
    // The offside line for each attacking side, as a depth in metres from
    // its own goal: the second-last defender, the ball, or halfway.
    const line = { home: PL, away: PL };
    for (const side of ['home', 'away'] as const) {
      const defs = live.filter((x) => x.side !== side).map((x) => (side === 'home' ? x.y : PL - x.y)).sort((p, q) => q - p);
      const ballD = side === 'home' ? ball.y : PL - ball.y;
      line[side] = Math.max(defs[1] ?? PL, ballD, PL / 2);
    }
    this.offsideLine = line;
    // Without the ball, the two nearest close it down (not at a restart).
    if (this.layout === 'play' && !this.celebrate && ball.owner && !restarting) {
      const defending = live.filter((b) => b.side !== this.attacking && b.pos !== 'GK' && b.down <= 0);
      // The nearest man presses. The next stands in the way, on the ball's
      // line to goal, and in the last third a third man does too, deeper.
      const goal = { x: PW / 2, y: this.attacking === 'home' ? PL : 0 };
      const toGoal = dist(ball.x, ball.y, goal.x, goal.y);
      const ranked = defending.map((b) => ({ b, d: dist(b.x, b.y, ball.x, ball.y) })).sort((p, q) => p.d - q.d);
      if (ranked[0]) pressing.set(ranked[0].b.id, 0.85);
      const covers = toGoal < 38 ? [COVER_NEAR, COVER_FAR] : [COVER_NEAR];
      covers.forEach((off, i) => {
        const man = ranked[i + 1]?.b;
        if (!man || toGoal <= off + 1) return;
        cover.set(man.id, { x: ball.x + ((goal.x - ball.x) / toGoal) * off, y: ball.y + ((goal.y - ball.y) / toGoal) * off });
      });
      // A man the move is about to name: he is on his way already, so he is
      // really there when he wins it.
      const named = this.queue.find((st) => st.act === 'win' || st.act === 'tackle' || st.act === 'foul')?.carrier;
      if (named) {
        pressing.set(named, 0.92);
        cover.delete(named);
      }
      // Tracking back: the user's player hunts the ball too.
      const f = this.focus;
      const me = f?.shout === 'track' ? this.bodies.get(f.id) : undefined;
      if (me && me.side !== this.attacking && dist(me.x, me.y, ball.x, ball.y) < 22) pressing.set(me.id, Math.max(pressing.get(me.id) ?? 0, 0.7));
    }
    const attackers = live.filter((b) => b.side === this.attacking);
    for (const b of list) {
      if (b.leaving && !this.referenced(b.id)) {
        // Off the pitch at the nearest touchline, at a walk.
        const tx = b.x < PW / 2 ? -4 : PW + 4;
        const dx = tx - b.x;
        b.vx += (Math.sign(dx) * 2.2 - b.vx) * Math.min(1, dt * 3);
        b.vy *= 0.9;
        b.x += b.vx * dt;
        b.y += b.vy * dt;
        if (b.x < -3 || b.x > PW + 3) this.bodies.delete(b.id);
        continue;
      }
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
      // The side without the ball sprints back into shape.
      else if (this.layout === 'play' && this.attacking && b.side !== this.attacking) urgency = 0.85;
      // Back to the kick-off spots: a jog, quicker from far away.
      if (this.layout === 'kickoff') urgency = Math.min(1, 0.5 + dist(b.x, b.y, t.x, t.y) / 25);
      const covering = cover.get(b.id);
      if (covering && !job) {
        t = covering;
        urgency = 0.85;
      }
      const press = pressing.get(b.id);
      if (press && !job) {
        // Stop a yard short of the man on the ball.
        const dx = ball.x - t.x;
        const dy = ball.y - t.y;
        t = { x: t.x + dx * press, y: t.y + dy * press };
        urgency = 0.85;
      } else if (!job && !covering && this.layout === 'play' && b.side !== this.attacking && b.pos === 'DEF' && attackers.length) {
        // Defenders pick up the nearest attacker, goal-side of him.
        const mark = attackers.reduce((best, x) => (dist(x.x, x.y, t.x, t.y) < dist(best.x, best.y, t.x, t.y) ? x : best), attackers[0]);
        if (dist(mark.x, mark.y, t.x, t.y) < 14) {
          const goalY = b.side === 'home' ? 0 : PL;
          const gy = mark.y + (goalY > mark.y ? 2 : -2);
          t = { x: t.x * 0.5 + mark.x * 0.5, y: t.y * 0.5 + gy * 0.5 };
        }
      }
      // The laws: at a restart the other side stand off the ball (9.15 m
      // at free kicks and corners, out of the box at goal kicks).
      if (restarting && sp && b.side !== sp.side && !job && b.pos !== 'GK') {
        if (sp.kind === 'goalkick') t = outOfBox(t, sp.side);
        else t = pushOut(t, ball, sp.kind === 'throw' ? 2.5 : FK_DISTANCE + 0.4);
        // Too close: hurry back so the kick can be taken.
        if (dist(b.x, b.y, ball.x, ball.y) < FK_DISTANCE + 0.4 || (sp.kind === 'goalkick' && inBox(b, sp.side))) urgency = 0.9;
      }
      // Offside: off the ball, attackers stay level with the line. Not at a
      // corner, where nobody can be offside.
      if (this.layout === 'play' && !this.celebrate && this.attacking === b.side && !job && ball.owner !== b.id && b.pos !== 'GK' && !(sp && sp.kind === 'corner')) {
        const lim = line[b.side] - 0.6;
        const d = b.side === 'home' ? t.y : PL - t.y;
        if (d > lim) t = { x: t.x, y: b.side === 'home' ? lim : PL - lim };
      }
      // A call is a sprint, not a stroll.
      if (!job && this.focus?.id === b.id && this.focus.shout && this.layout === 'play') urgency = Math.max(urgency, 0.92);
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
      if (b.leaving) continue;
      b.x = clamp(b.x, -1.5, PW + 1.5);
      b.y = clamp(b.y, -1, PL + 1);
    }
  }
}

// The laws' distances, in metres.
const CIRCLE = 9.15;
const FK_DISTANCE = 9.15;
// The fastest a ball at someone's feet can move, in metres a pitch second.
const BALL_GLIDE = 24;
// The defending block, from coaching guides: about 30 to 35 m from back to
// front, and about 35 to 40 m wide. As shares of the pitch.
const BLOCK_DEPTH = 0.31;
const BLOCK_WIDTH = 0.95;
// How far ahead of the ball the back line sits, and how far the cover men
// stand off the ball on its way to goal, in metres.
const LINE_BEHIND = 0.2;
const COVER_NEAR = 7;
const COVER_FAR = 13;
const BOX_DEPTH = 16.5;
const BOX_HALF = 20.16;

// Inside the penalty area of the side that defends it.
export function inBox(p: { x: number; y: number }, side: 'home' | 'away'): boolean {
  if (Math.abs(p.x - PW / 2) > BOX_HALF) return false;
  return side === 'home' ? p.y < BOX_DEPTH : p.y > PL - BOX_DEPTH;
}

function outOfBox(p: { x: number; y: number }, side: 'home' | 'away'): { x: number; y: number } {
  if (!inBox(p, side)) return p;
  return { x: p.x, y: side === 'home' ? BOX_DEPTH + 1 : PL - BOX_DEPTH - 1 };
}

function pushOut(p: { x: number; y: number }, c: { x: number; y: number }, r: number): { x: number; y: number } {
  const d = dist(p.x, p.y, c.x, c.y);
  if (d >= r) return p;
  const ux = d > 0.01 ? (p.x - c.x) / d : 0;
  const uy = d > 0.01 ? (p.y - c.y) / d : 1;
  return { x: clamp(c.x + ux * r, 0, PW), y: clamp(c.y + uy * r, 0, PL) };
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
