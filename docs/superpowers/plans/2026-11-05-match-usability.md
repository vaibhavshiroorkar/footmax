# Match and training usability

This implements the independent presentation requests in the approved
[delivery design](../specs/2026-11-05-engine-consistency-design.md).
Engine action migration remains the highest-priority development track.
These changes do not depend on replacing the legacy interaction physics.

Use `superpowers:executing-plans`. Keep existing save fields compatible.
No dependency additions or navigation replacements are needed.

## Training labels: C15 and C35

- [x] Explain that the attribute grid's green dot marks an attribute important to the player's position.
- [x] Show the full trained attribute names inside the active drill, using the drill's existing `attrs` data.
- [x] Keep those names readable without truncating the list on narrow screens.

Files: `src/app/career/train.tsx`, `src/ui/attributes.tsx` if needed.
Validation: typecheck, lint and rendered mobile-width inspection.
These are low-impact text changes; do not add tests that mirror the strings.

## Interaction labels: C30 and C31

- [x] Remove descriptions beneath interaction choice buttons, including shot shapes.
- [x] Remove the better-option label and its recommendation highlight.
- [x] Preserve useful action names, selection states and accessibility labels.

Files: `src/app/match.tsx`, `src/ui/moments/ShotGame.tsx`, other interaction buttons found by inspection.
Validation: typecheck, lint, source inspection and rendered mobile-width inspection.

## Match reward row: C36

- [x] Put Rating, XP, Fame and Bonus in one horizontal row.
- [x] Show zero Bonus so all four fields remain in the same positions.
- [x] Keep goals, assists and player-of-the-match badges beneath that row.
- [ ] Inspect narrow screens and larger accessibility text on a device. Source inspection found no width conflict.

Files: `src/app/match.tsx`.
Validation: typecheck, lint and rendered mobile-width inspection.

## Completion

- [x] Preserve each completed request verbatim in `ROADMAP.md` and mark it done.
- [x] Document behavior in `GAME.md` and layout in `DESIGN.md`.
- [x] Remove completed requests from `pending.md` in the same commit.
- [x] Review the final diff and run all required checks before integration.

Press behavior, cards, Quick Sim and audio remain separate functional changes.
They need engine or lifecycle checks beyond this presentation batch.

Typecheck, lint and the production web export pass. Independent review found no blocking issue.
Rendered inspection remains pending because browser and native tools are unavailable.
Unused hint fields are deferred to interaction cleanup; they no longer appear in buttons.
