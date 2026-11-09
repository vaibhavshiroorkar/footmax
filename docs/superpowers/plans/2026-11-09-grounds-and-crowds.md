# Grounds and crowds

Batch 5 of the [delivery design](../specs/2026-11-05-engine-consistency-design.md)
("career climb and competition"), after C12 shipped in v2.5.0. C18 still waits for
the user's example. Research is in
[RESEARCH.md](../../RESEARCH.md#grounds-and-crowds-v260).

## The ground: C14

- [x] `src/engine/ground.ts`: level, capacity, attendance, away fans, stands, grass,
  floodlights and crowd volume from the home club and the competition. Seeded by
  the fixture, read only by the presentation.
- [x] Neutral venues for a European final and summer tournaments, with the fans split.
- [x] `src/ui/stands.tsx`: stands and crowds around the live pitch in the home and
  away colours, a segregated away end from the professional game up, worn or
  striped grass, boards or a rail, floodlights. One dashed line per colour per row.
- [x] Tests: `__tests__/engine/ground.test.ts`.

## The climb you can feel: C13

- [x] Atmosphere: crowd volume follows the attendance.
- [x] Presentation: a matchday card before kick-off with the crowd, away fans and lights.
- [x] Rewards: match XP grows by 0.1x per ladder rung, and 0.2x on big nights.
- [x] Quality: passes leave the foot at 0.9x to 1.1x speed by the passer's passing.
  Player speed already follows pace.
- [x] One set of rung thresholds (`RUNG_MINS`) shared by the ladder and the ground.

## Checks

- [x] Average crowds per league against real figures (Premier League 43,000 against
  40,459; Championship 16,000 against 21,783).
- [x] Browser at 360 px: a local club and a Premier League match, no overflow, no errors.
- [x] Match probe: 178 s a match and 49% lofted passes, as before; no wrong-goal shots.
- [x] Career probe with the XP stage bonus (result in HISTORY.md).
- [ ] Phone: the stands' draw cost and how the crowd reads at that size.
