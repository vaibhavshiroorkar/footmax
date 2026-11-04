# FootMax history

The story of the project from the first commit, kept so no decision or
lesson is lost. `GAME.md` says how things work now. This file says how they
got there and why. Add a stage whenever a version ships. Git holds the exact
changes, so this file keeps only what git cannot explain.

## What the project is for

On 2026-11-01 the user asked for a game like Football Rising Star, with a
player career and a club manager mode. It is mobile first and tested in the
browser. Matches are simulated with moments you play yourself, and you can
skip to text and stats. The user named a genre, not a clone, so all names,
rules and art stay original.

The user tests the live site on a phone and judges by feel. When what they
see differs from what counts, it reads as broken.

## Stages

### 1. Foundations (2026-11-01 to 11-02)

`ced0649` to `34557f1`.

- Built the first game: career, manager, world data and a text match.
- Hosted on GitHub Pages first, then moved to Vercel so `main` deploys to
  footmax.vercel.app and every branch gets a preview.
- An audit found serious bugs. Saves were made safe, and save migrations
  were added so old saves keep loading.
- Added Supabase: accounts, cloud saves, leaderboards and public profiles.
  Guest play needs no account.

### 2. Start at the bottom, real matches (2026-11-02)

`2d8a8dc` to `db336a2`.

- Careers now start at a random small club in the weakest leagues of your
  confederation. The climb is the game.
- The match was rebuilt as a live pitch of 22 moving players with sound.
- The look was rebuilt twice. A green-black and orange recolour was rejected
  because it was done without research. The floodlit navy and softened lime
  in `DESIGN.md` came from researching dark-mode colour.
- A declutter pass set the rule of one job per screen.
- First glitch list: replayed moves, a jumping score, a keeper "saving"
  without blocking, and aim that did not match the pitch. These set the rule
  that every visual follows the engine's result, backed by tests.

### 3. Laws and moments (2026-11-03)

`247f9be` to `e7b27ae`. Tagged v1.0.0 and v1.1.0.

- Added the zone slider, defending moments, the laws on the pitch (kick-offs,
  offside line, restarts, cards), the power bar, pass scenes, shot shapes and
  human figures in the moment games.
- Calls were put in their order: Track back, Call for it, Make a run.
- Moments moved onto the main screen in the pitch's place. The user does not
  want pop-ups, cards below the pitch or anything that pushes the page.
- Feed lines now come from the same shot facts as the pitch, so they cannot
  disagree.

### 4. Depth, one version at a time (2026-11-04)

v1.2.0 to v1.10.0. Details are in `CHANGELOG.md`.

- v1.2.0: money and fame on the main screen, clubs need fame and agent fees.
- v1.3.0: abilities became a skill tree per position.
- v1.4.0: chain dribbles: shoot, pass or take on the next man.
- v1.5.0: stars dominate. Team strength became a cubed mean, and a 95 side
  beats a 75 side about 97% of the time.
- v1.6.0: VAR checks some goals.
- v1.7.0: shop tabs, cases and equipment by rarity.
- v1.8.0: life events with real consequences.
- v1.9.0: Life replaced More on the bottom bar. The season picker arrived.
- v1.10.0: World Cup qualifying for every nation, with era tournament formats.

### 5. Past seasons paused (2026-11-04)

`f2ca06e` is a safe point. 2006/07 is part done: England, Spain, Germany and
France are in, while Italy, Portugal, the Netherlands and other clubs are
stubs. It is not registered, so the picker keeps it locked. Progress lives in
`PLAN-2026-11-04.md`.

### 6. The 41-point request (2026-11-04)

The user sent 41 requests after playing v1.10.0, mostly about making the
match real. All of them are in `ROADMAP.md`, in their own words, with the
version each one ships in. The research behind the plan is in `RESEARCH.md`.

### 7. v1.11.0: fix and tidy (2026-11-04)

The first version of the roadmap. The wrong-goal shot was the big fix: 17% of
finishes flew at the wrong goal, and the probe now shows none. Added
`scripts/matchProbe.ts` so each match version can compare numbers, and a dev
hook (`window.__footmaxDev`) so a browser check can start a game.

### 8. v1.12.0: match pace (2026-11-04)

Split the clock from the pitch. The engine still plays every minute with the same
random stream, and `stepWatched` only decides what the pitch shows, so a test can
prove results match a plain run. A true 2x clock at 0.75x play did not fit: it
stopped at 1.78x rather than strip chances of all build-up.

### 9. v1.13.0: one pitch (2026-11-04)

Moments stopped inventing their own world. The shot game reads the real keeper,
wall, defenders and mates, and the pitch freezes while you play. Found on the way:
keepers stood up to 8 m outside their posts, and the shot view was a dice roll that
could disagree with the pitch. Live positions reach the move builder through
`s.bodies`, which only visuals may read.

### 10. v1.14.0: bodies (2026-11-04)

One jointed rig for every person, solved with two-bone IK. SVG passed the frame
test, so Skia stayed out. The lesson from measuring: dev builds read far slower than
production, so judge performance on a production build.

### 11. v1.15.0: real contact (2026-11-04)

The old shot game decided a save from a reach band, then drew it. Now `contact.ts`
plays the shot forward against the keeper's body, so a save needs a touch by
construction, and a test proves it. Rebounds added a little scoring, so their boost
was held down to keep league goals near 2.6.

### 12. v1.16.0: laws (2026-11-04)

Cards had been random and penalties existed only for the user. Everything now goes
through `laws.ts`, tuned to real rates, and rules follow the season. Second yellows
ran far too high until booked players backed off, as real ones do.

### 13. v1.17.0: the stage (2026-11-04)

Scenes reuse the callout layer, which already sat over the pitch, so layout never
changes. The "no pop-up after goals" rule gave way to the user's request for the
scorer in the middle of the screen. The voice clips are checked by waveform only.

### 14. v1.18.0: set pieces (2026-11-04)

One flow for all three: the stoppage, a scene, the setup by the laws, then the
user's decision with no clock. The header became three parts in two inputs, where
one tap both times the jump and aims it, to keep it quick on a phone.

### 15. v1.19.0: long shots and tempers (2026-11-04)

Distance difficulty uses one exponential curve for both the chance and the stray. The
side-on scene exists because a keeper's position is what makes a halfway shot worth
trying. Flare-ups ran hot at first and pushed reds to 0.47 a match; the rate came down.

### 16. v1.20.0: tactics (2026-11-04)

The shape in a match moved onto the match itself, so half-time changes cannot rewrite
a club. New games spread clubs across the shapes; old saves keep theirs.

### 17. v1.21.0: ability tree (2026-11-04)

The tree became data with its own screen. Skills and techniques carried over from old
saves untouched; `secondaryRole` moved to the `roles` list (save version 4). Every new
technique was wired to a real effect, because a node that changes nothing is clutter.
Energy stays out of 100, so physical cuts the cost of a session, not the cap.

### 18. v1.22.0: Champions League (2026-11-04)

The biggest calendar change: a week can now hold two user matches, so finishing a
European game no longer advances the week. Old saves join the next season rather than
drawing a tournament mid-season, and no save migration was needed.

### 19. v1.23.0: club page (2026-11-04)

One long scroll became three tabs, one job each. The roadmap planned a review with the
user first, but the user said to go ahead, so this is a first cut to judge on the phone.

### 20. v2.0.0: full audit (2026-11-04)

Replayed the tracker, played whole seasons in both modes, and measured a production
build. The audit caught what per-version tests had not: skipping a halfway-line shot
scored 16% of the time, because the skip path bypassed the new curve. Every way of
playing a moment now has a test. A code review across all versions then found ten more
bugs tests had missed, among them: most Champions League draws double-booked clubs
(fixed with a proper edge colouring), a "both booked" row sent the fouler off, and
Poacher did nothing on shots the user played, because a played shot ignores the
sim's odds. Anything that should help a played shot has to reach `contact.ts`.

### 21. v2.1.0: the pitch feels right (2026-11-04)

The second list began with bugs seen on a phone. Each was measured before it was
fixed: the ball's gap at a moment, dead-ball stretches by cause. "Ball through the keeper"
came from a misread sending his body to the ball's spot, so a beaten keeper now stays
clear of it. Restarts now keep the ball with the side taking them.

### 22. v2.2.0: the shot and pass scene (2026-11-04)

The floating defenders were men sliding sideways with no legs moving, so they run
now. The view shows everyone ahead, not only the lane. A shot became an aim and a hold,
and a pass a pick and a hold, so power is felt, not timed. On through balls and crosses
the hold counts for 30% and the timing for the rest, so a plain tap still gets there.

Trap: free kicks got no shot angle at all, so the wall would always have stood left.
Trap: `setPieceSpot` skips keepers unless the caller lets them in. Two flaky tests went
too: the arrest test rolled `Math.random`, and free kicks were taken with men still 5 m
off the ball because the wait stopped at 2.2 s (now 3.2 s).

### 23. v2.3.0: the game around it (2026-11-04)

Extra time and a shoot-out with the user's own kick, match history, moves that need
learning, passing that pays, and morale and fitness with real consequences. That ends
the second request list.

Trap: a shoot-out can end on the user's kick. Nothing ticks after that, so the result
was never saved until an effect took over from the minute tick. The history page being
empty is what showed it. `committed` stops a double save.

## Decisions that still hold

| Decision | Why |
| --- | --- |
| Original names, rules and art; real player names under a fan game notice; never real faces | The user named a genre, not a clone. Likeness is the legal risk |
| Every career starts at the bottom | The climb is the reward |
| Results never depend on watching | Skipping must not change a match. Pitch visuals use their own random stream (`playSeed`) |
| Every visual follows the engine, with a test for it | Any gap between sight and result reads as broken |
| Screens do not shift; space is reserved or overlaid | The user reads a shifting layout as broken |
| Moments open in the pitch's place, results are top toasts | The user rejected modals and cards below the pitch |
| Notifications only when the player must act or can upgrade | The user dislikes noise |
| Research before restyling, and keep the night-match navy and lime | The user rejected an unresearched recolour, and rejected Inter, neon and glow as looking AI-made |
| "Make it faster" means play speed, never shorter celebrations | Stated by the user |
| Push every finished change to `main` | The user checks it live on a phone |
| Each release gets a version bump, a tag and a changelog entry | Keeps what is live easy to trace |

Human figures were once for moment games only, and goals had no pop-up. Requests 8,
17 and 31 changed both: see "Rules changed by the 41-point request" in `ROADMAP.md`.

## Traps already hit

- The Expo web dev server here stops seeing edits. Use
  `npx expo export --platform web --dev`, then a static server. The `--dev`
  build keeps the `window.__footmax` store hook.
- Headless Chrome plays sound. Always pass `--mute-audio`.
- A new ticker phase once read the old phase's clock, which made the power
  bar read full and shoot by itself. `useTicker` now stores the clock with
  its key.
- A call or card adds events without a new move. The pitch keys each move by
  the identity of the array, so it never replays one.
- `step.side` means different things on different steps: for a stoppage it
  is the side that restarts. Reading it as "the defending side" sent tipped
  saves and deflected shots at the wrong goal (see `RESEARCH.md`).
- A shot-related rule must cover every path: played, skipped and simmed. They
  are separate code, so test all three.
- `pause()` in `PitchSim` ends the step when it runs out. A step with more stages
  must count on `a.t` instead.
- A set piece left on `sim.setPiece` affects the next restart: it must be cleared
  at kick-off, or the taker is pushed off the ball.
- The pitch uses `Math.random`, so a test on it needs a margin, or several seeds. A
  single seed breaks when anything changes the random stream.
- Never ship past a red test. A gate that stops the push on any failure caught
  three real problems across these versions.
- In GNU sed, a backslash before a backtick means the start of the buffer. Use a
  script for edits with backticks.
- Save data is large, so floats are rounded and attributes stored as arrays.
  Any new save field needs a migration and `SAVE_VERSION` raised.
