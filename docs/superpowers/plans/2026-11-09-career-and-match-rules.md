# Career and match rules

Continues the [delivery design](../specs/2026-11-05-engine-consistency-design.md)
after the user reverted the v2.6.0 physical shot work (see ROADMAP.md). This plan
takes requests that do not depend on that work. Research is in
[RESEARCH.md](../../RESEARCH.md#awards-retirement-var-and-passing-v250).

## Reconcile what Codex built: C8, C9, C10, C15, C20, C22, C25, C27, C30, C31, C35, C36, C41

- [x] Confirm each request is in the code at `7f268d6` and covered by its tests.
- [x] Run the full suite on that code: 314 tests in 39 suites pass.
- [x] Mark them done in ROADMAP.md, credited to Codex, and remove them from pending.md.

## Award eligibility: C12

- [x] Shortlist only top flights of strength 60 or more, plus Champions League clubs.
- [x] Crown the winner only from Europe's five strongest leagues or the Champions League winner.
- [x] Golden Boy: under 21, in a European top flight.
- [x] Golden Boot: European top flights, goals weighted 2x, 1.5x or 1x; keep the real count.
- [x] Tell a career player on the Awards screen why he cannot win.
- [x] Tests: `__tests__/engine/awards.test.ts`.

## Retirement and summary: C6 and C7

- [x] One `closeCareer` for every ending, so the history and club are always right.
- [x] `retirementAge` from position, body, injuries, level, mood and a fixed personal part, 30 to 41.
- [x] A warning one season before, and the career ends at the limit.
- [x] Keepers in the wider world retire three years later.
- [x] Career summary: clubs with years and numbers, peak overall, award podiums, milestones.
- [x] Tests: `__tests__/engine/retirement.test.ts`.

## VAR suspense: C24

- [x] Name what is checked, then draw lines (offside) or hold an on-field review (foul, handball).
- [x] Send the referee to the monitor only for a review, and sometimes for a goal that stands.
- [x] Keep the scoreboard waiting for the call. Tests: `__tests__/ui/var.test.ts`.

## Ground passes: C39

- [x] Measure lofted passes in `npm run match-probe`: 83% before.
- [x] Lift a pass only for distance, a switch, a long restart or a blocked lane.
- [x] Keep a middle touch when the clock's trimming would leave a pass over 40 m.
- [x] Measure again: 49%, with match length 175 s to 178 s.

## Found by the probes

- [x] The league phase draw threw once too few clubs outside the simulated leagues had
  14 players (a crash in the fifth season). Fill the last places and top up squads.
- [x] A forced career ending left the player on his club's books and out of his history.
- [x] Two overlapping saves could delete each other's chunks. Queue writes per key.

## Left open

- C18 (career progression): the career probe climbs from a rep-34 club to a top-flight
  side by 19 with full training. Its result with weaker training is in HISTORY.md.
  The user's reason for feeling stuck needs their example before changing offers.
- C0 and the rest of batch 3 wait for the user's view of the reverted shot work.
- Phone checks of the new VAR beats and the summary screen.
