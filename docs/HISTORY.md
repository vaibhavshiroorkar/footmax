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

The rule that human figures appear only in moment games changed on
2026-11-04: see "Rules changed by the 41-point request" in `ROADMAP.md`.

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
- Save data is large, so floats are rounded and attributes stored as arrays.
  Any new save field needs a migration and `SAVE_VERSION` raised.
