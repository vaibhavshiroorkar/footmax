# Match flow and status

Continue the approved [delivery design](../specs/2026-11-05-engine-consistency-design.md)
using `superpowers:executing-plans`. These requests share the existing match screen.

## Quick Sim results: C9

- [x] Add a failing test for a fully simulated match awaiting the normal result screen's commit.
- [x] Test that committing the same result twice cannot advance another week or duplicate rewards.
- [x] Add `quickUserMatch` in `src/engine/game.ts`; simulate without committing the result.
- [x] Route the hub's Sim button through `setLive` and the existing `/match` result screen.
- [x] Preserve Next week for weeks without a match and existing interrupted-match recovery.

## Cards: C20 and C25

- [x] Show yellow-card badges on live player dots and their match-stat rows.
- [x] Keep sent-off players in match statistics after removal from the pitch.
- [x] Grey out sent-off rows and label the red card so status does not rely on color alone.
- [x] Keep substituted players and unused bench players distinct.

Files: `src/ui/livePitch.tsx` and `src/ui/lineups.tsx`.
Validate against the existing `yellows`, `sentOff`, `usedIds` and `onPitch` fields.

## Press: C41

- [x] Test pressing from farther than the old 22-metre cutoff.
- [x] Move the user's player toward the opponent on the ball while Press is active.
- [x] Preserve restart spacing and goalkeeper behavior.
- [x] Rename the action and pitch tag to Press; keep the stored `track` value compatible with saves.

Files: `src/engine/matchRuntime/pitch.ts`, `src/app/match.tsx`, `src/ui/livePitch.tsx`.

## Validation and documentation

Before final checks, also remove the dedicated long-shot scene (C27) and repair audio (C8 and C22).
All shots use the normal controls, with the existing distance and skill penalties.
Audio needs tests for delayed rewind, duplicate voice requests, rejected playback,
muting during loading and the persisted referee preference.
Free-kick calls must occur once, whether the restart follows a foul or opens directly.

- [x] Run focused match-flow and pitch tests, lint and typecheck.
- [x] Run full regression, match probe and season balance checks after engine changes settle.
- [x] Review changes, preserve completed requests in ROADMAP and remove them from pending.
- [x] Document actual behavior in GAME and presentation rules in DESIGN.

Codex built this plan in `7f268d6`. On 2026-11-09 the full suite passed on that code
(314 tests in 39 suites) and it shipped in v2.5.0. Real-phone review remains open in pending.md.
