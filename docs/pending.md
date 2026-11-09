# Pending work

This is the maintained checklist of unfinished FootMax work. Update it alongside
[ROADMAP.md](ROADMAP.md). Release numbers for the work below are unassigned.
When an item is finished, document its outcome in the relevant project documents,
then remove it from this list in the same change. Do not keep completed checkboxes here.

Sources include all repository Markdown documents, three locally stored project
chats, their summaries, and project memory notes. Chat references use session IDs
so they can be found in local history. Chats stored only elsewhere were unavailable.
Later releases and requests take precedence over earlier unfinished lists.

## Complete Football Game Update List

Source: the user's update list of 2026-11-05 and follow-up. 24 entries remain open,
with release versions unassigned. C0 is in implementation; the others are `todo`.
C0 is the highest priority. See the approved
[engine and delivery design](superpowers/specs/2026-11-05-engine-consistency-design.md).
The supplied list numbers both the engine and opening rival as 1.
C0 identifies the engine request; C1 through C40 preserve the remaining numbers.
C41 records the follow-up request.
The request text below is preserved, including overlapping corner and consistency requests.

- [ ] **C0. Match Engine Precision and Live Pitch Consistency (Highest Priority):** Plan and develop the best possible approach to make the match engine precise, accurate, realistic, and consistent. The live pitch and interaction system must be completely synchronized. Player positions, ball positions, movement, animations, and match situations must remain consistent when transitioning between live gameplay and interactions. Interactions should use the actual match state rather than predefined or static positions. Every action taken during an interaction should accurately affect the live match. There should be no teleportation, unrealistic repositioning, or sudden changes in the match state. The engine must account for player attributes, positioning, timing, physics, AI decision-making, and match context. The most important requirement is that what happens during interactions accurately reflects what is happening on the live pitch, and vice versa.

- [ ] **C1. Opening Rival System:** The opening phase will feature a rival. Both you and your rival will participate in a youth academy match with randomized teammates. You must defeat your rival's team during the tutorial.

- [ ] **C2. Linear Opening Tutorial:** The opening match should be a linear, structured tutorial that gradually introduces the player to the game's mechanics, controls, interactions, and tactical decisions.

- [ ] **C3. Recurring Rival:** Your rival should appear throughout your career between matches and will always be one league ahead of you. Give the rival a unique personality, appearance, identity, and a profile that players can visit to track their career.

- [ ] **C4. Youth Academy Difficulty:** The opening match should be relatively easy because all players are youth academy prospects competing for a chance to join a small professional club.

- [ ] **C5. New Game Plus (Rebirth):** In New Game Plus, players should have the opportunity to join bigger clubs directly from the youth academy instead of always starting at the lowest level.

- [ ] **C11. Defensive Actions and Tutorial:** Make defensive contributions such as tracking back, pressing, marking, and positioning equally important as attacking actions. Emphasize these mechanics during the tutorial.

- [ ] **C13. Noticeable Career Progression:** Make the difference between local leagues and higher-tier football clearly noticeable through gameplay quality, player abilities, match intensity, stadium atmosphere, rewards, and overall presentation.

- [ ] **C14. Dynamic Pitches and Crowds:** Change pitches and stadium appearances based on the club, league, and competition. Audiences should reflect the participating teams' colors, with appropriate differences between home and away supporters.

- [ ] **C16. Corner Kick Interaction Glitches:** Fix the glitchy corner kick interactions and ensure they function smoothly.

- [ ] **C17. Prevent Player Teleportation:** Stop players from randomly teleporting or snapping into completely different positions during matches, interactions, and animations.

- [ ] **C18. Fix Career Progression:** Players should not remain stuck in local clubs indefinitely. Make progression through clubs and leagues more achievable, visible, rewarding, and exciting.

- [ ] **C19. Volley Animations:** Add dedicated volley animations, including volley attempts from the edge of the penalty area following corners or loose balls.

- [ ] **C21. Realistic Shooting and Ball Physics:** Improve shooting animations and ball movement. The ball should visually scale down as it travels farther from the camera, rotate naturally, and follow believable trajectories rather than simply moving across the screen.

- [ ] **C23. Dynamic Interaction Animations:** Interaction animations should adapt to the actual pitch situation instead of using fixed player positions and static animations. Player movement, orientation, spacing, and positioning must reflect the current match state.

- [ ] **C26. Fix Corner Kick System:** Fix the corner kick system, which is currently bugged, and ensure corners behave consistently across different match situations.

- [ ] **C28. Rework Heading Interaction:** Redesign the heading interaction to make aerial challenges more realistic, engaging, and dependent on player positioning, timing, and heading ability.

- [ ] **C29. Show All Players During Headers:** During heading interactions, display all relevant players inside the penalty box rather than only showing a limited number of players.

- [ ] **C32. Automatic Situation-Based Interactions:** Interactions should automatically trigger whenever an appropriate match situation occurs rather than requiring the player to manually initiate them.

- [ ] **C33. Contextual Interaction Examples:** Automatic interactions should include situations such as shooting during a 1v1 opportunity, deciding whether to pass from midfield when an attacking chance develops, or receiving a through ball.

- [ ] **C34. Rework Sprinting Interaction:** Redesign sprinting interactions so the animation clearly demonstrates the player accelerating past and outspeeding a defender, with the outcome influenced by pace, acceleration, positioning, and defender ability.

- [ ] **C37. Smarter Player AI:** Improve the AI for all players, including teammates and opponents, so they play proper, intelligent football. Players should maintain realistic positioning, make better passing decisions, create space, defend intelligently, track runs, support attacks, and react appropriately to changing situations. AI behavior should also vary based on individual attributes, tactical roles, and team quality.

- [ ] **C38. Attribute-Based Shooting Accuracy and Power:** Rework shooting so that players with better shooting attributes have a more forgiving timing, accuracy, and power window. Higher-rated players should be able to shoot harder while maintaining good accuracy, whereas lower-rated players should have a smaller margin for error and be more likely to miss the target when attempting powerful shots. Shooting should still depend on positioning, pressure, angle, and timing.

- [ ] **C40.** Model size consistency with respect to distance to keep things real

C0 expands the earlier engine planning request from chat
`bb12309d-e778-4928-a710-79d1028a137d` into planning and development.
That earlier reply stopped at a usage limit before delivering a plan.
C27 removed the earlier dedicated long-range scene; ROADMAP.md records it as done.
The old release entries remain historical records; these new requests remain open
even where a previous release claimed related fixes.

On 2026-11-07 the user had Codex's physical shot actions, swept collisions and shot
camera removed (`ce526a0`, see ROADMAP.md). Before the next C0 step, ask what was
wrong with them, so it does not repeat the same approach.

C18 evidence (2026-11-09): with full training and every offer accepted, the career
probe leaves a rep-34 club after one season and reaches a top-flight side by 19
(seeds 7 and 21). The weaker-training result is in HISTORY.md. Ask the user for
the case where they felt stuck before changing how offers work.

## Historical seasons

The picker exists, but no historical season is registered in
[`PAST`](../src/data/seasons/index.ts). The 2006/07 pack is partly built.

- [ ] Finish 2006/07 Serie A in [`italy.ts`](../src/data/seasons/2006/italy.ts).
  Include its 20 clubs. Juventus, Napoli and Genoa were in Serie B that season.
- [ ] Finish 2006/07 Portugal and the Netherlands in
  [`portugalNetherlands.ts`](../src/data/seasons/2006/portugalNetherlands.ts).
  Include 16 Portuguese clubs and 18 Dutch clubs.
- [ ] Fill [`otherClubs.ts`](../src/data/seasons/2006/otherClubs.ts)
  with that season's major clubs outside the simulated leagues.
- [ ] Validate the complete 2006/07 pack and manually review major clubs' lineups
  and star ratings. England, Spain, Germany and France already have data.
  Nation strength overrides also exist; review them with the finished pack.
- [ ] Register 2006/07, confirm career and manager starts use its squads and year,
  and release the unlocked season.
- [ ] Build and release 2007/08, 2008/09, 2009/10 and 2010/11.
- [ ] Build and release 2011/12, 2012/13, 2013/14, 2014/15 and 2015/16.
- [ ] Build and release 2016/17, 2017/18, 2018/19, 2019/20 and 2020/21.
- [ ] Build and release 2021/22, 2022/23, 2023/24 and 2024/25.

Each pack needs that season's clubs, real squads, exact roles, ratings and nation
strengths. Follow [SEASON_DATA.md](SEASON_DATA.md), including squad sizes and
duplicate checks. Run `npm run check-seasons` after registration. For an
unregistered pack, use `npx tsx scripts/checkSeasons.ts 2006` with its start year.
Check lineups and a new game before unlocking a season.

The picker also exposes a locked 2025/26 slot. The written data plan ends at
2024/25, while the chat asks for every season back to 2006.
- [ ] Resolve 2025/26 coverage and document whether it gets its own historical pack.
  Do not assume the current built-in pack provides a selectable 2025/26 start.

Sources: [historical data plan](PLAN-2026-11-04.md#3-historical-squad-data-200607-to-202425),
[season format](SEASON_DATA.md), [game rules](GAME.md#planned-next),
and chat `2fc8bc22-f3d3-4846-9737-6f4d91264a9f`.

## Legends

- [ ] Decide the unlock model: one purchase for all legends, a price per legend,
  or a temporary test unlock. Payments are not set up.
  Keep the feature locked until that decision is made.
- [ ] Add the paid Legends choice to new career, showing its price and locked state.
- [ ] Add legend selection using historical data. Use names only, never real faces.
  Earlier requests named Yamal, Haaland, Mbappe, Messi, Ronaldo, Neymar,
  Maradona, Eusebio and Pele. The later plan also names Ronaldinho, Kaka,
  Zidane, Henry, Iniesta and Xavi.
- [ ] Resolve coverage for legends whose careers fall outside the planned packs.
  The 2006/07 start cannot represent Pele, Eusebio or Maradona's careers,
  or Zidane's final club season. The final roster needs matching data.
- [ ] Build full-career play from the legend's real club in their first available season.
- [ ] Build prime-season play that ends that summer, such as Messi 2011/12
  or Ronaldo 2007/08.
- [ ] Implement the chosen purchase or test-unlock flow when its scope is agreed.

Sources: [Legends plan](PLAN-2026-11-04.md#4-legends-paid);
chats `f6027e3a-d88e-4022-8ba9-7d0998fadaae` and
`2fc8bc22-f3d3-4846-9737-6f4d91264a9f`.
Removing the old Legends card is already done.

## Phone checks and user reviews

- [ ] Replay both request lists on a real phone, including career and manager playthroughs.
  Browser checks and simulated seasons do not close this task.
- [ ] Measure live pitch, jointed figures, interaction scenes and the ability tree
  on a mid-range phone. Target 60 fps, never below 45, and script time below 8 ms.
- [ ] Measure qualifying breaks on a phone. About 200 matches can simulate together.
  Optimize only if the measurement shows a pause.
- [ ] Listen to all referee clips and judge clarity and delivery in the match.
  Existing checks only inspected waveforms.
- [ ] Judge the clock and commentary on a phone. The clock is about 1.8x faster,
  short of the requested 2x, with play at 0.75x. Accept that tradeoff or retune it.
- [ ] Review the club page's My club, Squad and Transfers tabs with the user.
- [ ] Confirm the wrong-goal fix addresses the phone bug originally reported in request 4.
- [ ] Confirm request 10 meant the Play player card and that its spacing now feels right.
- [ ] Watch the VAR beats on a phone and judge whether the wait feels tense or slow.
- [ ] Look at the career-over screen at 360 px after a long career with many clubs.
- [ ] Check national team call-ups for strong players. In one pre-fix career probe
  (seed 21), an English striker at 85 overall reached 28 with no caps, while seed 7
  gained caps from 20.

Sources: [roadmap status](ROADMAP.md#where-it-stands),
[audit scope](ROADMAP.md#v200-full-audit),
[open decisions](ROADMAP.md#open-decisions) and
[research](RESEARCH.md#result-in-v200).

## Known gaps and deferred competitions

- [ ] Fix historical AFCON scheduling when the early packs land.
  Through 2012, it currently shares the World Cup summer instead of its January slot.
- [ ] Research Champions League access lists by nation and era, then decide how
  closely to model them. Current qualification places are approximate.
- [ ] Resolve the Champions League draw's two-opponents-per-nation constraint.
  Current research says the game only avoids same-nation games where possible.
- [ ] Scope other continents' club cups, deferred behind UEFA in the roadmap.
  No release is assigned.
- [ ] Decide whether to add Europa League continuation for third-place group teams
  in historical Champions League seasons. It is an acknowledged omission,
  not an agreed feature release.
- [ ] Before an app store release, review permission to use player and club names
  and the Champions League name. The current choice uses a fan-game notice,
  with no UEFA logo or anthem.

Sources: [known gaps](ROADMAP.md#known-gaps),
[open decisions](ROADMAP.md#open-decisions),
[Champions League research](RESEARCH.md#champions-league), and [README](../README.md).

## Research still unverified

These are evidence gaps in shipped systems. They do not mean those systems are unbuilt.

- [ ] Verify five-substitute start dates and the eight-second keeper rule by competition
  and era. Separate confirmed dates from assumptions used by historical packs.
- [ ] Verify abandoned-match scoring and simultaneous-fight treatment against the
  relevant competition rules. The minimum of seven players is already sourced.
- [ ] Verify violent-conduct bans and flare-up rates. Current values are design choices.
- [ ] Improve keeper calibration sources: save rate, held versus parried saves,
  dive distance and league-wide corner and deflection rates.
- [ ] Improve evidence for long-shot probabilities, especially halfway-line shots.
  The far end of the curve is an extrapolation.
- [ ] Improve evidence for formation roles and coaches' half-time formation changes.
  Current shapes use common practice; the change probability is a design choice.
- [ ] Revisit corner delivery outcomes if reliable data becomes available.
  Current routines have no measured goal-rate split.
- [ ] Validate ability-tree navigation and touch targets with phone use.
  Existing research is thin; a gesture library was found unnecessary.

Source: [RESEARCH.md](RESEARCH.md). Later findings there already resolve the old
open questions about minimum players, group-stage format and the voice licence.
Do not reopen those as missing research.

## Keeping this list accurate

The original 41 requests and B1 through B21 are recorded as shipped through v2.4.0.
Earlier chat summaries contain work later completed, including cases, life events,
team browsing, ability trees, qualifying and shot fixes. Those are not new pending work.
B21 replaces hold-to-charge shooting with taps; passing still uses a hold.

For each completed item, mark its request done in [ROADMAP.md](ROADMAP.md)
and preserve its request text there before removing it from this list.
Document current game behavior in [GAME.md](GAME.md), research in
[RESEARCH.md](RESEARCH.md), and design changes in [DESIGN.md](../DESIGN.md), as applicable.
Update the season plan or data format when those are affected.
Record release decisions in [HISTORY.md](HISTORY.md) and player-facing changes in
[CHANGELOG.md](../CHANGELOG.md) when shipping. Make these updates in the same change.
Use the checks and release process in [docs/README.md](README.md) and
[ROADMAP.md](ROADMAP.md#how-every-version-is-built).
