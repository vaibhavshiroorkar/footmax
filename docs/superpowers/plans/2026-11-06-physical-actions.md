# Shared physical actions

Implement the next part of the approved
[engine design](../specs/2026-11-05-engine-consistency-design.md)
using `superpowers:executing-plans`.

The foundation shares positions and freezes decisions. Legacy interaction scenes
still choose outcomes that the pitch reconstructs. C0 remains open until that split is removed.

## Collision geometry

- [x] Add swept sphere against capsule contact in world metres, without rendering dependencies.
- [x] Test fast shots crossing a defender between frames, near misses, initial overlap and stationary balls.
- [x] Cover vertical posts, the horizontal crossbar, degenerate capsules and mirrored attack directions.
- [x] Select the earliest contact across all colliders with deterministic ties.

Files: new `src/engine/matchRuntime/geometry.ts` and `__tests__/engine/runtimeGeometry.test.ts`.
Interface: `sweepSphereCapsule(from, to, radius, capsule): Contact | null`.
Contact includes the fraction of the step, world centre at contact and surface normal.
The ball touches a surface at that fraction; it cannot tunnel to the endpoint first.

## Physical shot action

- [x] Derive shot velocity from the actual ball, goal, aim, power, timing and player attributes.
- [x] Advance the ball with gravity and contact checks using the runtime's fixed clock.
- [ ] Move the keeper from the current position within speed, reaction and reach limits.
- [x] Resolve blocks, saves, woodwork, wide balls and goals from actual contact and boundary crossing.
- [x] Test both goals, an off-centre keeper, a moving blocker and identical seeded replay.

Files: new engine action module, runtime types and action tests.
Inputs describe attempts. Neither input controls nor cameras supply a forced result.

## Shot integration

- [ ] Have shot controls submit input against the active capture revision.
- [ ] Draw the action from runtime state in both the live pitch and shot camera.
- [ ] Apply match statistics once after the physical outcome resolves.
- [ ] Skip legacy shot reconstruction for actions already played by the runtime.
- [ ] Preserve actual positions, ball velocity and ownership at the handoff.
- [ ] Test goals, saves, rebounds, blocks, skipped decisions and stale callbacks.

## Remaining interactions

After shots, migrate passing, aerial challenges, sprinting, dribbling and defending
through the same action contract. Restart placement, AI and automatic triggers
must use the same state. Write their focused implementation steps after the shot interface settles.

## Validation

- [ ] Run focused action tests, the full suite, lint, typecheck and match probes.
- [ ] Obtain an independent review before integration.
- [ ] Document behavior with the implementation. Keep C0 pending until every handoff is migrated.

Phone visuals and timings remain a separate pending review. Do not treat a passing
geometry test as proof that every camera or interaction already uses the new runtime.

The isolated shot resolver now has deterministic launch inputs, gravity, moving-body
contact, goal-frame collision and whole-ball boundary checks. It retains rebound velocity.
Keeper motion is bounded from its actual position. Hand reaches and catching remain
for integration; current keeper contact uses the body capsule. No gameplay camera
uses this resolver yet. Legacy action reconstruction remains active.

Runtime submission now validates the capture token, actor ownership, proximity and finite inputs.
The fixed clock advances accepted shots and copies their positions into pitch state.
Snapshots detach the full action. Resolution preserves ball velocity and accepts one acknowledgement.
Takeover and legacy enqueue requests cannot interrupt an accepted shot.
The independent core review found an orphaned-token takeover bug; its regression now passes.
This review covers the engine core only. Camera and statistics integration still need review.
