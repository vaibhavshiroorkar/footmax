# Match flow and status

Continue the approved [delivery design](../specs/2026-11-05-engine-consistency-design.md)
using `superpowers:executing-plans`. These requests share the existing match screen.

## Quick Sim results: C9

- [ ] Add a failing test for a fully simulated match awaiting the normal result screen's commit.
- [ ] Test that committing the same result twice cannot advance another week or duplicate rewards.
- [ ] Add `quickUserMatch` in `src/engine/game.ts`; simulate without committing the result.
- [ ] Route the hub's Sim button through `setLive` and the existing `/match` result screen.
- [ ] Preserve Next week for weeks without a match and existing interrupted-match recovery.

## Cards: C20 and C25

- [ ] Show yellow-card badges on live player dots and their match-stat rows.
- [ ] Keep sent-off players in match statistics after removal from the pitch.
- [ ] Grey out sent-off rows and label the red card so status does not rely on color alone.
- [ ] Keep substituted players and unused bench players distinct.

Files: `src/ui/livePitch.tsx` and `src/ui/lineups.tsx`.
Validate against the existing `yellows`, `sentOff`, `usedIds` and `onPitch` fields.

## Press: C41

- [ ] Test pressing from farther than the old 22-metre cutoff.
- [ ] Move the user's player toward the opponent on the ball while Press is active.
- [ ] Preserve restart spacing and goalkeeper behavior.
- [ ] Rename the action and pitch tag to Press; keep the stored `track` value compatible with saves.

Files: `src/engine/matchRuntime/pitch.ts`, `src/app/match.tsx`, `src/ui/livePitch.tsx`.

## Validation and documentation

Before final checks, also remove the dedicated long-shot scene (C27) and repair audio (C8 and C22).
All shots use the normal controls, with the existing distance and skill penalties.
Audio needs tests for delayed rewind, duplicate voice requests, rejected playback,
muting during loading and the persisted referee preference.
Free-kick calls must occur once, whether the restart follows a foul or opens directly.

- [ ] Run focused match-flow and pitch tests, lint and typecheck.
- [ ] Run full regression, match probe and season balance checks after engine changes settle.
- [ ] Review changes, preserve completed requests in ROADMAP and remove them from pending.
- [ ] Document actual behavior in GAME and presentation rules in DESIGN.

Browser and native preview tools are unavailable in this session.
Web compilation is available; real-phone review remains open in pending.md.
