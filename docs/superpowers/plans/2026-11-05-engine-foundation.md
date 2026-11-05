# Engine Foundation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox syntax for tracking.

**Goal:** Establish tested engine-owned physical state and reliable interaction handoffs before migrating individual actions.

**Architecture:** Extract the pure pitch simulation into the engine without changing its public callers. Add immutable complete snapshots, seeded motion and revision-checked interaction transitions. Preserve the existing renderer through a compatibility export until its callers migrate.

**Tech Stack:** Expo 58, React Native, TypeScript, SVG, Jest. No new dependencies.

**Spec:** [Approved design](../specs/2026-11-05-engine-consistency-design.md).

## Global Constraints

- Preserve all existing game data and interrupted-match recovery.
- Use the existing 68 by 105 metre field.
- C0 stays open until every interaction uses the shared state.
- Keep displayed football time separate from physical simulation time.
- Renderers do not choose outcome-affecting positions or random values.
- Keep the live pitch's numbered dots and existing layout.
- Run typecheck, lint and the whole test suite before claiming completion.
- Remove a pending item only after its behavior is finished and documented.

## Review Focus

- An interaction callback after a time skip must not alter the new state (Task 4).
- Snapshot mutation must not affect a running match (Task 3).
- Both attack directions must preserve world coordinates (Task 3).
- A slow frame must not move a player farther than equivalent small steps (Task 5).
- A halftime skip from a held interaction must release input (Task 4).

## Task 1: Establish the test baseline

**Files:** Existing `__tests__/engine/audit.test.ts` and any source identified by reproduction.
**Interfaces:** Existing Jest scripts and public simulation functions.

- [x] Isolate the long-running baseline by test name. Compare the same seeded operation outside Jest.
- [x] If a production loop stalls, add a bounded regression that reproduces the same state before fixing its source.
- [x] Run `npm test -- --runInBand`. Expected: all suites finish, with actual failures reported.
- [x] Record lasting test or engine fixes in `docs/HISTORY.md`; commit fixes with their tests.

## Task 2: Move physical simulation ownership into the engine

**Files:** Move `src/ui/pitchSim.ts` to `src/engine/matchRuntime/pitch.ts`; retain `src/ui/pitchSim.ts` as a compatibility export.
**Interfaces:** Preserve `PitchSim`, `PW`, `PL`, `BodyInfo`, `Callout`, `RefCall`, `SimHooks`, `KEEPER_REACH` and existing exported geometry helpers.

- [x] Run the existing pitch, continuity, set-piece and rules tests as characterization checks.
- [x] Move the pure implementation and update internal import paths. Do not change match outcomes in this step.
- [x] Run the same tests and typecheck. Expected: unchanged observable behavior.
- [x] Document engine ownership in `docs/GAME.md` and commit the extraction.

## Task 3: Complete snapshots and deterministic movement

**Files:** `src/engine/matchRuntime/pitch.ts`, new `snapshot.ts`, and `__tests__/ui/continuity.test.ts`.
**Interfaces:** `PitchSim.snapshot(): PitchSnapshot`; `PitchSnapshot` contains revision, time, active player identities and full motion, ball position/velocity/ownership/flight, restart and phase. `PitchSim` accepts a seed with a backward-compatible default.

- [x] Test that changing nested snapshot data does not mutate the match, including ball flight and restart wall membership.
- [x] Test that all players retain their IDs and world coordinates in both attack directions, including more than five defenders.
- [x] Test that identical seeds and commands produce identical movement while different seeds can produce different optional runs.
- [x] Implement snapshot copies and replace simulation `Math.random` with the instance RNG. Cosmetic render randomness may remain outside physics.
- [x] Run continuity, pitch and rules tests. Expected: equal seeded runs, independent snapshot copies and no dropped players.
- [x] Document the contract and commit with tests.

## Task 4: Interaction and period transition lifecycle

**Files:** `src/engine/matchRuntime/pitch.ts`, `src/app/match.tsx`, `src/ui/livePitch.tsx`, new `__tests__/ui/matchTransitions.test.ts`.
**Interfaces:** `beginInteraction(id: string): PitchSnapshot | null`, `endInteraction(id: string, revision: number): boolean`, and `resetForPeriod(side: 'home' | 'away'): void`. The engine owns the active interaction ID and revision. A revision rejects stale callbacks even when a label is reused. Existing halfTime delegates to period reset.

- [x] Test a stale completion after a skip: old ID returns false and leaves the new snapshot unchanged.
- [x] Test repeated completion: only the first succeeds.
- [x] Test period reset clears queued actions, holding, flight, restart, VAR and callouts before kickoff.
- [x] Reproduce skip-to-half with a pending interaction, then resume and confirm new inputs are accepted.
- [x] Implement lifecycle methods and wire match-screen skip/resume paths. Use the shared ID instead of timer-driven ownership.
- [x] Run transition, knockout, continuity and pitch tests plus typecheck and lint.
- [x] Update the roadmap and game docs for completed behavior; keep C0 open. Commit.

## Task 5: Fixed-step advancement

**Files:** New `src/engine/matchRuntime/clock.ts`, `src/engine/matchRuntime/pitch.ts`, `src/ui/livePitch.tsx`, new `__tests__/engine/runtimeClock.test.ts`.
**Interfaces:** `FixedClock.advance(seconds: number, tick: (dt: number) => void): number`; `reset(): void`. Steps are 1/60 second, with up to 32 per call. Unconsumed time remains queued. Decisions, pauses and period resets discard the remainder.

- [x] Test equal physical advancement at 30, 60 and 120 display fps with the same seed.
- [x] Test that a long frame has bounded work and retains its remainder for later calls.
- [x] Test pause/resume discards elapsed background time without moving the match.
- [x] Implement the clock and route rendering through it without changing 1x/2x/4x meanings.
- [x] Run the full suite, typecheck, lint and match probe. Expected: all pass; record any changed measurements.
- [x] Request a fresh code review, address substantive findings, and commit the foundation.

## Continuation

This foundation is the first implementation plan, not completion of the backlog.
Next plans migrate physical action resolution and every interaction camera, then
the remaining batches in the approved design. Do not release the new runtime as
completed C0 while legacy interactions still reconstruct outcomes.

Execution uses this worktree and native implementation. Approval of the design
and the request to do all pending work authorize continuing between tasks.

Validation: all 301 tests in 34 suites pass. Typecheck and lint pass, with one existing unused-variable warning.
The 12-match probe and three-season balance check complete. Independent review found no blocking issue.
No baseline loop fix was needed; world generation made the original test run slow.
