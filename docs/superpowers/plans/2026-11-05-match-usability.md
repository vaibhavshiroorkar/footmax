# Match and training usability

This implements the independent presentation requests in the approved
[delivery design](../specs/2026-11-05-engine-consistency-design.md).
Engine action migration remains the highest-priority development track.
These changes do not depend on replacing the legacy interaction physics.

Use `superpowers:executing-plans`. Keep existing save fields compatible.
No dependency additions or navigation replacements are needed.

## Training labels: C15 and C35

- [ ] Explain that the attribute grid's green dot marks an attribute important to the player's position.
- [ ] Show the full trained attribute names inside the active drill, using the drill's existing `attrs` data.
- [ ] Keep those names readable without truncating the list on narrow screens.

Files: `src/app/career/train.tsx`, `src/ui/attributes.tsx` if needed.
Validation: typecheck, lint and rendered mobile-width inspection.
These are low-impact text changes; do not add tests that mirror the strings.

## Interaction labels: C30 and C31

- [ ] Remove descriptions beneath interaction choice buttons, including shot shapes.
- [ ] Remove the better-option label and its recommendation highlight.
- [ ] Preserve useful action names, selection states and accessibility labels.

Files: `src/app/match.tsx`, `src/ui/moments/ShotGame.tsx`, other interaction buttons found by inspection.
Validation: typecheck, lint, source inspection and rendered mobile-width inspection.

## Match reward row: C36

- [ ] Put Rating, XP, Fame and Bonus in one horizontal row.
- [ ] Show zero Bonus so all four fields remain in the same positions.
- [ ] Keep goals, assists and player-of-the-match badges beneath that row.
- [ ] Check narrow screens and large reward values.

Files: `src/app/match.tsx`.
Validation: typecheck, lint and rendered mobile-width inspection.

## Completion

- [ ] Preserve each completed request verbatim in `ROADMAP.md` and mark it done.
- [ ] Document behavior in `GAME.md` and layout in `DESIGN.md`.
- [ ] Remove completed requests from `pending.md` in the same commit.
- [ ] Review the final diff and run all required checks before integration.

Press behavior, cards, Quick Sim and audio remain separate functional changes.
They need engine or lifecycle checks beyond this presentation batch.
