# Engine consistency and backlog delivery

Status: proposed design, awaiting review. No gameplay implementation is complete.

The user asked to implement everything in [pending.md](../../pending.md).
Engine precision is the first priority. This document defines that foundation
and the order for the remaining work. It does not mark any request done.
The implementation choices below are proposals, not prior user decisions.

## Goal

A player must be able to trust what the match shows. A pass goes to the selected
teammate. A keeper saves only through contact. A camera change preserves every
player, the ball, possession and the current action. Returning to the live pitch
continues that action instead of generating a second account of it.

Keep player career, manager mode, old saves, historical starts and skipped matches
working. Keep the current Expo 58, React Native, TypeScript and SVG stack.
Do not introduce a native physics dependency for this work.

## What the code currently does

These are code findings, not reproduced bug verdicts for every reported symptom.

- `src/engine/match.ts` decides match events and creates `PlayStep` sequences.
- `src/ui/pitchSim.ts` owns moving bodies and a separate ball state in metres.
- `src/engine/pace.ts` copies pitch positions into `MatchState.bodies` while watching.
  It folds quiet minutes and constructs bridge passes between displayed moves.
- `MatchScreen.onMomentReady` copies the ball location into a pending moment.
  `MomentGame` captures partial shot geometry from the pitch when it mounts.
- `PitchSim.shotScene` clamps the keeper's horizontal position. `laneDefenders`
  limits its result to five defenders. Neither is a full match-state transfer.
- `HeaderGame` invents its delivery lane, marker and random values locally.
  `ThroughBallScene` also has a separate scene setup.
- `resolveMoment` accepts results such as goal, save or miss. `visualizeMoment`
  then constructs new movements, including receiver positions derived from formation slots.
- Existing continuity tests tolerate ball gaps measured in metres. They do not
  prove complete state equality across both views or after interaction completion.

This split permits different pictures of one event. Patching each camera alone
would leave that ownership problem in place.

## Chosen approach

Move simulation ownership into a pure engine runtime. Both views read the same
state and send commands to the same resolver. Retain useful movement, contact,
formation and rig code while moving responsibilities in small tested steps.

Three approaches were considered:

| Approach | Consequence |
| --- | --- |
| Patch each existing mini-game | Quick local improvements, but independent state and reconstructed outcomes remain |
| Shared engine runtime with view adapters | Preserves the app and most existing systems while removing the inconsistent handoffs |
| Replace the app with a new game engine | Adds platform, rendering and save migration work before addressing the user's bugs |

Use the shared runtime. Renderers must not own outcome-affecting randomness,
physics, possession, player locations or match rules.

## State and time

The runtime owns the following state for one match:

- Stable match, event, player, possession and interaction identifiers.
- Every active player's position, velocity, facing, action phase and role.
- Ball position in three dimensions, velocity, spin, owner and last touch.
- Period, simulation time, displayed match minute, score, cards and substitutions.
- Restart kind, location, taker, wall, eligible participants and legal setup state.
- Current input opportunity, its decision deadline and any action in flight.
- Seeded random state for decisions and physical variation.

Use the existing 68 by 105 metre field. All physical positions use metres internally.
Convert to normalized coordinates only at legacy boundaries during migration.
Camera orientation never changes home/away identities or the physical state.

Proposed physics step: 1/60 second, with swept collision checks for the fast ball.
AI chooses intentions less often than physics, initially every 0.1 simulation second.
Stable player ordering and a seeded RNG make the same inputs repeatable.
These are engineering defaults to measure, not claims of real-world calibration.

Keep display speed independent of simulation rules. Rendering may interpolate
between states. A slow frame must not increase movement distance by changing the
physics step. Pause and app backgrounding stop advancement, without a catch-up burst.
Bound catch-up work per display frame and resume remaining steps on later frames.

The accelerated match clock remains a game pacing choice. Preserve the current
1x, 2x and 4x controls. Do not shrink celebration durations to achieve a clock target.
Use compressed football time, not 90 minutes of physical simulation played in fast-forward.
Initially advance one football minute per 3.1785 physics seconds during active play,
derived from the current 1.63 display seconds per minute and 1.95 physics speed.
At 1x, consume 1.95 physics seconds per wall-clock second; 2x and 4x multiply that rate.
This gives about 147 display seconds for 90 minutes before stoppages and user decisions.
Tune that single clock ratio against the measured full-match duration before release.
Physics, action deadlines and AI reaction times use physics seconds. Match fatigue
uses elapsed football minutes, with activity modifiers, so a full match has a full
match's fatigue cost. Decision pauses, camera transitions and app pauses stop both
gameplay clocks. Restart setup, VAR and celebrations stop the football clock;
their visible player movements still advance the shared physical state.
Open-play decision deadlines and active-play AI are disabled during these stoppages.
Stoppage-time minutes remain engine decisions, independent of how long someone watches
an animation. Both watched and skipped paths consume the same gameplay clocks.
Remove fabricated bridge passes from continuously visible play as each path migrates.
Time compression can accelerate valid simulation; it cannot silently change possession.

## Interaction lifecycle

Use one explicit sequence: live play, decision, action, continuation.
Restarts add a setup stage before the decision. Period breaks and full time are
separate states. UI booleans cannot independently advance the simulation.

1. The runtime recognizes a legal opportunity from current positions and ball state.
2. A camera transition preserves the same state. Decision input can pause play,
   as current set-piece choices do; a timed action advances the shared runtime.
3. The user submits a command containing the interaction ID and expected state revision.
4. The engine validates the actor, possession, eligibility, target and action.
5. The engine simulates the attempt and emits contacts, possession changes and rule events.
6. Both views render that attempt. Switching back reads the resulting state directly.

Stale input from an earlier interaction is ignored. Repeated callbacks cannot
award two goals or resolve an action twice. Closing or unmounting a view cancels
its UI timers, without changing a resolved match result.

Shots, passes, dribbles, sprints, tackles, interceptions, blocks, clearances,
keeper saves, headers and volleys use this lifecycle. A fight changes discipline
and the restart, without replacing the ball state with an invented sequence.
Shootouts use explicit penalty state and commit the final result exactly once.

Automatic opportunities are part of the runtime: receiving a through ball,
entering a one-on-one, choosing a midfield pass and reacting defensively.
An opportunity has one ID and a cooldown tied to possession and action completion.
Do not reopen it every frame. If input is omitted or auto-play is enabled,
the AI submits a legal command through the same path.

## Physics, AI and views

Ball contact produces saves, blocks, deflections, rebounds and goals. A UI callback
must not force a goal to reconcile a different animation. Sweep from the previous
ball position to the next against moving collision shapes to avoid tunnelling.
Retain the rig solver, but put outcome-relevant contact geometry in engine-owned code.

Player movement respects acceleration, top speed, facing and separation.
AI maintains formation responsibilities, tracks runners, provides passing options
and covers for the player pressing. Attribute and team-quality differences affect
reaction, execution and decisions. Ground passes are the default; aerial passes
need a useful tactical route or target.

The camera projects real world coordinates for every relevant player and the ball.
Use one depth calculation for model size, ball size and visible distance.
Clipping can hide someone outside the view; arbitrary player-count caps cannot.
Player poses derive from their action and facing. The ball rotates with its motion.

The dedicated long-range mini-game goes away. Long shots remain available through
the normal shot system with distance, angle, pressure and attribute penalties.
Higher shooting ability widens the useful timing and power range without making
poor angles or defensive pressure irrelevant.

For aerial play, continue the actual delivery. Header and volley selection depends
on ball height, arrival time, position and player ability. Show all relevant box
players, including competing defenders and the actual keeper. A missed header
leaves a live ball unless it crosses a boundary.

Corner setup uses the same ball and players. They move into legal positions during
the stoppage. Taker, short pass, near/far delivery and edge-of-box choices create
ordinary actions. Validate both sides and all paths, including skipped corners.

## Skipping, replay and transitions

Watched and skipped matches use the same rules and random stream. Equal seeds
and equal input commands must produce equal results. User choices may change
results; choosing to watch must not.

Quick Sim advances the runtime without rendering, then opens the normal result
screen. Skipping to half time ends at a period boundary, clears stale interaction
input and lets the second-half kickoff proceed. It must also work from a paused
match, a pending interaction and a set-piece intro.

Do not replay skipped movement when returning to watching. A declared time skip
can cut to the new state. Ordinary camera changes cannot. Kickoff, substitutions,
injuries, red cards and period breaks each have explicit transition rules.

Background league and qualifying simulation must remain affordable. Start with
the shared runtime without rendering, measure season cost, and optimize safe
event scheduling only if differential tests prove identical results.
Do not silently use a different result engine as a performance fallback.

## Migration and boundaries

Proposed module responsibilities, with exact interfaces left to the implementation plan:

| Area | Responsibility |
| --- | --- |
| `src/engine/matchRuntime/` (new) | Authoritative state, clock, commands, transitions and events |
| `src/engine/contact.ts` | Contact rules migrated to world coordinates, with compatibility tests |
| `src/engine/match.ts` | Match rules and statistics, delegated to the runtime in stages |
| `src/engine/play.ts` and `pace.ts` | Legacy adapters during migration, then presentation-only event selection |
| `src/ui/pitchSim.ts` | Becomes a read-only view adapter after movement migrates |
| `src/ui/moments/` | Input and camera presentation for shared runtime actions |
| `src/app/match.tsx` | Match flow, navigation and result display |
| `src/state/` | Save and restore integration, without a second match authority |

Convert one complete action path at a time behind an internal development switch.
Never combine old and new outcome generation for one action. Do not release a
mixed-authority match as the completed C0 feature.

Old career saves must retain players, clubs, money, honours and progression.
Increment `SAVE_VERSION` for persistent changes and test migration from version 4.
The store currently persists `Game`, not `live: MatchState`. It stores a pending
fixture ID, seed and kickoff flag, and reloads with `live: null`.
Preserve this interrupted-match recovery contract in the first runtime release.
Adding mid-match save snapshots is a separate persistence decision, not an assumed requirement.
Development switches are not player-facing options.

## Completion evidence

C0 stays pending until all interaction types use the shared state and these checks pass:

- Camera entry and exit preserve all state fields, with coordinate error below 0.01 m.
- Every open-play displacement respects velocity and acceleration limits.
  The test identifies explicit skips and period resets separately.
- High-speed shots cannot cross a keeper, defender, post or bar without contact checks.
- The selected receiver, displayed receiver and recorded receiver agree.
- Both teams, both attack directions, set pieces, rebounds, substitutions, red cards,
  extra time and shootouts pass transition checks.
- Replaying the same seed and commands at 30, 60 and 120 render fps gives the same events.
- Headless and watched runs with identical commands agree on result and statistics.
- Pause, resume, backgrounding, double taps and stale callbacks cannot deadlock input
  or commit an outcome twice.
- Typecheck, lint, all tests, data checks, balance and career probes pass.
- Production browser checks at 360 px confirm no overflow or shifting layout.
  Headless browser checks remain muted.

Retain the existing targets: roughly 2.6 goals per league match, roughly 22% draws,
late-game saves near 2 MB, 60 fps on a mid-range phone, never below 45,
and script work below 8 ms per frame. Record seeds, sample sizes and measured
before/after results. Browser throttling cannot close the real-phone check.
If runtime costs miss the targets, optimize and remeasure before calling C0 complete.

## Remaining work, in dependency order

This is the delivery order, not a claim that later feature designs are already approved.
Each batch gets a focused implementation plan and checks before changes ship.

| Batch | Requests | Delivery |
| --- | --- | --- |
| 1. Shared match state | C0, C17, C23 | Runtime, camera continuity, exact action handoffs and deterministic replay |
| 2. Match flow and sound | C8, C9, C10, C22, C24 | Result and halftime flow, voice event deduplication, free-kick audio, VAR timing |
| 3. Actions and AI | C11, C16, C19, C21, C26, C27, C28, C29, C32, C33, C34, C37, C38, C39, C40, C41 | Real contextual actions, aerial play, ground passing, smarter movement and Press |
| 4. Match and training presentation | C15, C20, C25, C30, C31, C35, C36 | Clear training state, card indicators, concise controls and one reward row |
| 5. Career climb and competition | C12, C13, C14, C18 | Award eligibility, worthwhile offers, tier differences, grounds and team-colour crowds |
| 6. Academy and rival | C1, C2, C3, C4 | Easy structured opening, required win, recurring rival and profile |
| 7. Career ending and rebirth | C5, C6, C7 | Retirement circumstances, lasting career summary and stronger academy opportunities on replay |
| 8. Historical data | Older season checklist | Complete 2006/07, then remaining seasons through 2025/26, with verified squads |
| 9. Legends | Older Legends checklist | Named players, career/prime modes and the chosen unlock model |
| 10. Competition and evidence gaps | Remaining older checklist | Historical AFCON timing, access lists, draw constraints, research and phone reviews |

Batch 3 can move individual action paths into the runtime during batch 1 development.
C0 cannot close ahead of that migration merely because its base modules exist.

## Decisions for later batches

Do not block engine work on these. Resolve each before its dependent implementation.

- Academy losses need a retry flow that preserves the required tutorial win.
  Proposed default: retry the academy fixture without destroying the created player.
- The rival cannot stay one league above the world's highest tier indefinitely.
  Proposed default: one prestige tier ahead until the ceiling, then a stronger rival
  club in the same elite tier. This requires a stated exception to the user's rule.
- Proposed rebirth default: preserve the previous career summary and unlock stronger
  academy scouting opportunities. Do not carry maximum attributes into a new teenager.
- Retirement must record the career before removing any player data. Exact age,
  injury and career circumstances need balance work for the requested 30 to 40 range.
- Legends needs a purchase model and price. Keep checkout locked until those are
  chosen; a test unlock must be explicitly labelled and must not grant paid entitlements.
- Legends outside the available seasons need additional packs. Do not invent historical
  squads or silently replace the requested full career with an unrelated season.
- Other continental cups and Europa League need defined competition scope before building.
- Phone feel, referee listening and app-store publication checks need actual evidence
  or user review. Mark them pending until that evidence exists.

## Documentation and release policy

Add the user's execution request to the roadmap. Keep all unfinished entries in
pending. For completed work, preserve the request in the roadmap, mark it done,
update the relevant game, research, design and release documents, then remove it
from pending in that same change. Never mark the entire batch done based on one fix.

The user previously requested versioned releases pushed to main. Run the required
checks before each release. A proposed design is not a shipped game release and
does not get a game version bump or a completion claim.

## Sources and limits

- [Box2D simulation documentation](https://box2d.org/documentation/md_simulation.html)
  recommends fixed steps and describes swept collision detection. These principles
  inform the proposed runtime; this design does not add Box2D.
- [Expo SDK 58](https://docs.expo.dev/versions/v58.0.0/) matches the installed Expo major.
- [Expo audio for SDK 58](https://docs.expo.dev/versions/v58.0.0/sdk/audio/)
  is the API reference for the later voice fixes. Their cause still needs reproduction.
- [Existing research](../../RESEARCH.md) contains balance targets and unresolved
  football evidence. Numeric tuning must not be presented as sourced fact without evidence.

This design specifies game consistency. It does not claim a physically exact
reproduction of professional football or completed historical data research.

Before implementation, isolate the baseline Jest run that produced no suite results
after several minutes and was interrupted. Do not treat an interrupted run as passing.
