# FootMax roadmap

Every open request, the version it ships in, and how it gets built. Live now:
v1.18.0. Next: v1.19.0. Status keys: `todo`, `doing`, `done`. Findings behind
this plan are in `RESEARCH.md`.

## Versions at a glance

The list is ordered by what depends on what, not by request number. Quick
fixes go first so they reach the phone soon. Then each match version builds on
the one before: players must be in the right place before they get bodies, and
need bodies before the ball can touch them.

| Version | Name | Requests | Why it sits here |
| --- | --- | --- | --- |
| v1.11.0 | Fix and tidy | 2, 4, 9, 10, 11, 20, 32, 33, 34, 35, 41 | Small, safe, and removes the worst visible bug |
| v1.12.0 | Match pace | 1, 14, 15 | Every later match feature is tuned at this speed |
| v1.13.0 | One pitch | 6, 29 | Moments must read the real pitch before anything is drawn on it |
| v1.14.0 | Bodies | 3, 31 | The jointed model that contact, cutscenes and the referee all use |
| v1.15.0 | Real contact | 3, 26, 27 | Needs real positions (v1.13) and joints (v1.14) |
| v1.16.0 | Laws | 7, 24, 25 | Set pieces and red cards must follow rules that exist first |
| v1.17.0 | The stage | 8, 28 | The overlay that set pieces and fights play on |
| v1.18.0 | Set pieces | 5, 21, 22, 23, 30 | Uses the stage, the laws and contact |
| v1.19.0 | Long shots and tempers | 16, 17 | New scenes on the same base |
| v1.20.0 | Tactics | 18, 19 | Needs the laws for subs and the stage for the news |
| v1.21.0 | Ability tree | 36, 37, 38, 39, 40 | Separate from the match; one save change |
| v1.22.0 | Champions League | 13 | Biggest calendar change, so it lands on a stable match |
| v1.23.0 | Club page | 12 | Built once, after it has Europe to show |
| v2.0.0 | Full audit | all | Performance, phone testing and a whole-career playthrough |

Request 0 (the docs) is done with this file.

## Request tracker

The 41-point request of 2026-11-04, word for word.

| # | Request | Version | Status |
| --- | --- | --- | --- |
| 0 | doucment in /docs everything of past till now for this project and it should update as we go so we never lose context | docs | done |
| 1 | speed up timer by 2x but make gameplay 0.75x speed, keep the option 1x as default, make commentary more readable instead of fast | v1.12.0 | done |
| 2 | make shooting bar rise slightly slower | v1.11.0 | done |
| 3 | give joints to model so they accurately stop the ball | v1.14.0, v1.15.0 | done |
| 4 | fix goalkeeper shooting to other side | v1.11.0 | done |
| 5 | allow interaction of user during corner (either header or outside the box or take the corner) | v1.18.0 | done |
| 6 | make defenders actually stand in the way instead of random | v1.13.0 | done |
| 7 | apply proper rules and constraints of football | v1.16.0 | done |
| 8 | show avatar when celebrating like in the middle of the screen, same for referee calls, make a model for referee | v1.17.0 | done |
| 9 | don't make money and fame clickable in play | v1.11.0 | done |
| 10 | the card seems too congested, give more space | v1.11.0 | done |
| 11 | keep home inside setting as quit | v1.11.0 | done |
| 12 | rework the club page | v1.23.0 | todo |
| 13 | add UCL | v1.22.0 | todo |
| 14 | when you hit play match, it should show u lineups and allow you to go back or kickoff | v1.12.0 | done |
| 15 | make call for ball have better passing chances, make run have better shooting chances | v1.12.0 | done |
| 16 | make shooting from longer distance exponentially harder like halfway line with new interaction scene | v1.19.0 | todo |
| 17 | players can get angry at each other and commit red card or both commit red card onto each other (during match scene with popup on the screen with models) | v1.19.0 | todo |
| 18 | more formation, coaches can dynamically change it in career mode at HT, manager mode user can change | v1.20.0 | todo |
| 19 | coach can sub you off if you perform poor | v1.20.0 | todo |
| 20 | make goalkeeper rush you faster | v1.11.0 | done |
| 21 | show proper penalty winning moment and everyone on the pitch standing outside like a short cutscene before you switch to the penalty spot and take your time to take the shot | v1.18.0 | done |
| 22 | freekick should be pass or shoot and also short cutscene and take your time | v1.18.0 | done |
| 23 | same for corner like the other 2 setpiece, short cutscene and user interaction | v1.18.0 | done |
| 24 | sometimes let a goal happen and it gets called for VAR or offside or ref sees foul, etc | v1.16.0 | done |
| 25 | make sure the rules apply to all players properly, constraints should always apply | v1.16.0 | done |
| 26 | the ball should touch the model and deflect, it cant be saved if it doesnt touch but make sure this doesnt mean the ball always goes in, it should make keeper model actually interact properly instead of static rotation of keeper body | v1.15.0 | done |
| 27 | the ball can deflect out for corner or something as well | v1.15.0 | done |
| 28 | maybe add voice of refree shouting PENALTY or saying freekick like that | v1.17.0 | done |
| 29 | all the players should remain in context and continuity when any event happens so if 3 players are in front, it should be accurate to ur position if u shoot. | v1.13.0 | done |
| 30 | rework header interaction, it's mid | v1.18.0 | done |
| 31 | show players avatar when interaction mode instead of circles | v1.14.0 | done |
| 32 | keep energy out of 100 | v1.11.0 | done |
| 33 | keep rest beside defensive intead of below | v1.11.0 | done |
| 34 | make ovr of play and trian same size, inconsistencies should never happen | v1.11.0 | done |
| 35 | 1x for quick train, 3x for play train | v1.11.0 | done |
| 36 | ability tree should have it's own navigation with large tree with branches for each role, remove weakfoot from selection screen and make it part of tree, make tree larger with more variety. | v1.21.0 | todo |
| 37 | alternate position can unlock multiple psoitions | v1.21.0 | todo |
| 38 | ability tree is based on level point and requirement of attribute level | v1.21.0 | todo |
| 39 | skill moves can be kept to train and it wiill train in X amount of weeks, it costs money instead of points | v1.21.0 | todo |
| 40 | increasing physical can make u have more energy for training, add unique stuff like this | v1.21.0 | todo |
| 41 | remove done for week button | v1.11.0 | done |

## Rules changed by the 41-point request

These replace older rules from the moment their version ships. Update
`GAME.md`, `DESIGN.md` and the older notes when they do.

- **Human figures.** They were only for moment games. Requests 8, 17 and 31 add
  them to celebrations, referee calls, fights and pass picking. The live pitch
  keeps its numbered dots during normal play.
- **No pop-up after goals.** Request 8 puts the scorer in the middle of the
  screen. It is a short scene over the pitch, inside the pitch's own block, so
  the layout still never shifts. It is not a modal.
- **Weak foot.** It leaves the creator and becomes part of the tree.
- **Skill moves.** They cost money and weeks instead of skill points.

## How every version is built

1. **Research.** Answer the version's research questions and add the findings,
   with sources, to `RESEARCH.md`. For anything touching Expo, read the SDK 58
   docs first, as `AGENTS.md` requires.
2. **Measure.** Run `scripts/matchProbe.ts` (added in v1.11.0) for the numbers
   the version will change, so the gain can be shown.
3. **Tests first.** Write the failing test that defines done.
4. **Build.** Engine and simulation stay free of React, so they stay testable.
5. **Check.** Typecheck, lint, all tests, `npm run balance` and `npm run probe`.
   Any new save field needs a migration and a higher `SAVE_VERSION`.
6. **Look at it.** Drive the web build at 360 px wide with `--mute-audio`, using
   `expo export --dev` and a static server.
7. **Ship.** Update the docs as `docs/README.md` says, then bump the version,
   tag it and push to `main`.

Rules that hold in every version:

- Results never depend on watching. A skipped match and a watched match follow
  the same engine stream.
- Nothing shifts the layout. Scenes overlay the pitch's block.
- Every new visual has a test that it matches the result.

Performance targets, checked from v1.14.0 on:

| Measure | Target |
| --- | --- |
| Frame rate during moments and scenes | 60 fps on a mid-range phone, never under 45 |
| Script time per frame | Under 8 ms |
| League scoring | About 2.6 goals a match, about 22% draws (today's level) |
| Late-game save size | Near 2 MB (today's level) |
| Web download | Any large library loads only when first needed |

## v1.11.0: Fix and tidy

Requests 2, 4, 9, 10, 11, 20, 32, 33, 34, 35, 41.

**Research:** done. Request 4's cause is confirmed (`RESEARCH.md`). The one open
question is training balance for request 35, which `npm run probe` answers.

**Build:**

- First, add `scripts/matchProbe.ts`: match length, moves, caption time and
  wrong-goal shots, so every later version can compare numbers.
- **4:** 17% of finishes fly at the wrong goal. `PitchSim` reads `step.side` as
  the defending side, but on tipped saves and deflected misses `addFinish` sets
  it to the attackers, because they take the corner. `defendingSide()` in
  `play.ts` now works it out from the restart.
- **2:** the bar's fill time goes from 0.52-0.84 s to about 0.62-1.0 s (1.2x).
  Bands stay the same.
- **20:** the keeper's rush time goes from 2.8 s to 1.9 s, and from 1.8 s to
  1.1 s in a one on one. He also closes faster on the live pitch.
- **9:** the money and fame chips become plain values.
- **10:** more space in the Play player card. Taken to mean this card; see Open
  decisions.
- **11:** the home button leaves the Play and manager headers
  (`src/app/career/index.tsx`, `src/app/manager/index.tsx`). Settings gets "Quit
  to menu", and manager mode gets a way to reach Settings.
- **32:** energy reads `72/100`.
- **33:** Rest becomes a tile in the drill grid, beside Defensive shape. That makes
  six tiles for outfield players and four for keepers, so the grid stays even.
- **34:** the ring is 54 on Play and 56 on Train. Use one shared size, then sweep
  for other mismatches.
- **35:** Quick gives 1x. Play gives 1x, 2x or 3x for one, two or three stars.
  Literal 3x took a 16-year-old to 78 in one season, so the base gain came down
  from 0.26 to 0.18. All three-star training now reaches elite around 19 or 20,
  and Quick alone around 21 or 22.
- **41:** remove the button.

**Done when:** a test proves every shot flies at the goal its shooter attacks,
and the probe shows zero wrong-goal shots. Screens checked at 360 px.

## v1.12.0: Match pace

Requests 1, 14, 15.

**Research before building:** how long do real commentary lines stay readable on
a phone? Which quiet moves are worth keeping for the feel of the match?

**Build:**

- **1, the clock.** Today one move equals one minute, so the clock cannot speed
  up while play slows down. Split them. The engine still plays all 90 minutes,
  so results do not change, but the pitch only shows the minutes that matter.
  After each move the engine runs on through quiet minutes until the clock has
  caught up or something happens.
- **1, the limit.** A 2x clock allows about 153 s of play, but busy moves alone
  take 192 s at 0.75x. That is only 1.6x even with every quiet move gone. So busy
  moves also lose part of their build-up (4.4 s down to about 3.5 s at today's
  speed), and plain fouls count as quiet. If that feels rushed, stop at about 1.7x
  and tell the user. The sums are in `RESEARCH.md`.
- **1, the gaps.** A skipped minute can end with the ball somewhere else. A short
  bridge step moves the ball there on screen, so it never teleports.
- **1, play speed.** `TIME` goes from 2.6 to 1.95. The new pace is labelled 1x and
  stays the default, and 2x and 4x are multiples of it. Celebrations keep their
  real length.
- **1, commentary.** 83% of captions last under a second today, and the median is
  0.64 s. Add a caption queue with a minimum time on screen of about 1.6 s. Big
  events jump the queue and small passes are dropped.
- **14.** Play match opens a lineups screen: both XIs on a formation board, with
  Back and Kick off pinned. The pitch stays hidden until kick-off. Back leaves
  nothing behind, and the seed in `pendingMatch` keeps the match the same.
- **15.** Call for it: more pass moments, safer passes, wider pass-scene windows.
  Make a run: more shot moments, from closer in, with a better chance. Each call
  has a clear job, and neither helps the other's job.

**Done when:** the probe shows play at 0.75x and the clock at 2x, or at the best
rate that still feels right, with the reason written down. No caption under 1.5 s
at 1x. No frame-to-frame ball jump. Goals per match
and win rates unchanged. A test shows each call raises its own moment type.

## v1.13.0: One pitch

Requests 6, 29.

**Research before building:** how does a defending team keep shape (line height,
distance between lines, who presses and who covers)? Add a baseline: how often
is a defender in the shot lane today?

**Build:**

- **29.** A `MomentScene` is a frozen copy of all 22 players, the ball and the
  keeper at the moment play stops. Every moment game reads only this. The random
  keeper position and random keeper kit in `ShotGame` go. One function projects
  the pitch into the goal view. After the moment, play resumes from those same
  positions. Three men in front of you on the pitch means three men in the shot.
- **6.** Defenders stop heading to a formation spot and marking whoever is near.
  The nearest man presses the ball, the next covers him, and the rest hold a
  compact shape between the ball and the goal, moving across with play.
- **6, naming.** `buildPlay` picks tacklers from formation spots, not live
  positions, so the man who wins it can be nowhere near. The pitch reads ahead in
  the queue and sends the named player early, so he is really there.

**Done when:** a test proves every player in a moment matches the pitch to within
a small tolerance, and that resume starts from the same spots. The probe shows
more shots with a defender in the lane. Tackle winners are near the ball before
the step begins.

## v1.14.0: Bodies

Requests 3 (the joints), 31.

**Research before building:** run a spike with five jointed figures in SVG on a
real phone, and measure it. If SVG misses the frame targets, test Skia. Skia is
in Expo Go and SDK 58 recommends 2.14.0, but on the web it adds about 2.9 MB
gzipped of WebAssembly, so it would load only when first needed.

**Build:**

- A new `src/ui/rig/`: a skeleton (head, torso, hips, two-part arms and legs), a
  two-bone IK solver (limbs reach a target using the law of cosines), joint limits
  and a pose library. No React in the solver, so it is testable. Poses are plain
  data, so the drawing layer can change without touching them.
- `PlayerFigure`, `KeeperFigure` and `RefereeFigure` all use this rig. The whole
  body `rotate()` on the keeper goes.
- **31.** Every moment game that draws circles (`PassScenes`, `DribbleGame`,
  `DribbleMore`, `DefendGames`, `HeaderGame`, `SaveGame`) moves to figures, in real
  kit colours. The user's figure uses their avatar look. Pass picking on the pitch
  shows the mates as small figures.

**Done when:** hands reach any target in range and stop at full stretch when out
of range, joints never bend the wrong way, no circles remain for people, and the
performance targets are met.

## v1.15.0: Real contact

Requests 3 (stopping the ball), 26, 27.

**Research before building:** how fast do keepers react and dive? How are shots
split between held, parried and tipped? How many corners come from deflections?

**Build:**

- New pure modules in `src/engine/`: `ballFlight` (a 3D ball with swerve and dip),
  `keeperModel` (reaction time, dive speed and reach from his stats) and `contact`
  (ball against the rig's hands and body, posts and bar).
- The shot steps forward in small fixed steps. The keeper starts late, the IK
  drives his hands to where he thinks the ball will be, and a touch happens only
  if the ball meets a limb.
- Outcomes: goal, held, parried, tipped over, tipped round, off the post in or
  out, deflected for a corner, or into the net off a hand. The old `judge()` goes.
- A ball off the post or a parry stays in play, as the law says, so rebounds are
  live and can fall to anyone nearby.
- **26, both halves.** No touch means no save. Keeper skill still keeps saves
  common, because his read and reach are tuned so the ball does not always go in.
- **AI shots.** The result is already decided, so the solver searches for a path
  and dive that gives that result, and the contact shown is real.
- **27.** Blocks and deflections use the same contact: out for a corner, a throw,
  or looping to someone.

**Done when:** a test proves every save has a contact event and no touch means no
save. Thousands of simulated shots give save rates in the set band by zone. Corner
counts look like real football. Goals per match unchanged.

## v1.16.0: Laws

Requests 7, 24, 25.

**Research before building:** read the full 2026/27 laws on the points below, and
find when each rule began, so a 2006/07 start plays by 2006/07 rules.

**Build:** a `src/engine/laws.ts` table that everyone goes through, with era
gates. Gaps found in the code today:

| Gap today | Fix |
| --- | --- |
| Cards go to a random player, even the keeper, with no foul behind them | Cards come from real fouls, scaled by how bad the foul was |
| No second yellow | Track yellows; a second is a red |
| Only the user's moments produce penalties; `autoShot` has no penalty path | Fouls in the box give penalties to every side |
| Offside is a clamp that stops attackers | Judge the position when the pass is played, for every player |
| No advantage | Play on after a foul when the attack continues; card at the next stoppage |
| No handball | Add it, with the law's rules on deliberate and accidental cases |
| No rule for a keeper sent off | An outfield player goes in goal, or a sub if one is left |
| No minimum players | Check the law's minimum and end the match if a side drops below it |
| Keeper can hold the ball as long as the script says | Eight seconds, then a corner, from the season it began |
| Subs always 5 | Limit by era |
| VAR in every season | Only from the season it began |

**24.** Three ways to lose a goal: the flag goes up, the referee has already blown
for a foul, or VAR rules it out. The ball goes in, the crowd rises, and then the
call comes. Applies to the user's goals as well as the AI's.

**25.** A law check runs over whole matches in every frame, for all roles, both
sides, and AI against AI. Any break fails the test. It extends
`__tests__/ui/rules.test.ts`.

**Done when:** the law check passes across many seeded matches. Card, penalty and
offside rates sit near real league figures. An early-season match has no VAR.

## v1.17.0: The stage

Requests 8, 28.

**Research before building:** which voice source sounds right? Compare a rendered
clip with `expo-speech` on a phone. Check the licence on the chosen voice's model
card.

**Build:**

- `src/ui/stage/`: a timed scene layer inside the pitch block, holding figures,
  captions and sound on one timeline. Tap to skip. Reduce motion gives a still
  frame. Play holds while it runs.
- **8.** Goals: the scorer in the middle of the screen doing their celebration,
  with the user's own look. Referee calls: the referee figure with the right
  signal, pointing to the spot, arm up, or showing a card, with the word beside it.
- **28.** Short rendered clips (PENALTY, FREE KICK, CORNER, OFFSIDE, PLAY ON,
  GOAL KICK) played through the existing sound code, with a setting to turn them
  off. Rendered clips sound the same on every device. `expo-speech` does not, it
  queues rather than overlaps, and it is silent on an iPhone in silent mode.

**Done when:** every scene matches the event that caused it, nothing shifts, and
the voice respects the sound setting. Skipped matches play no scenes and give the
same result.

## v1.18.0: Set pieces

Requests 5, 21, 22, 23, 30.

**Research before building:** where do players stand at corners? Which corner
routines are common? What makes a header feel skilful on a touch screen?

**Build:** one flow for all three set pieces, with no clock on the choice: the
foul or stoppage, a short scene, the setup by the laws, then your decision.

- **21, penalty.** The foul in the box, the whistle, the referee points. Everyone
  walks outside the box and at least 9.15 m from the mark, behind it. The keeper
  stands on his line. Then the view moves to the spot, and you take your time.
- **22, free kick.** The ball placed, the wall set at 9.15 m, attackers 1 m from a
  wall of three or more. Choose Shoot or Pass, with no clock.
- **23 and 5, corner.** A new `corner` moment. If you take it: pick the swing and
  the target (near, far, short). If you do not: attack near post, far post or the
  penalty spot for a header, or wait outside the box for the knock-down shot.
- **30, header.** Three parts: choose your run while the ball is in the air, time
  the jump against a real marker, then aim it (near post, far post, or down). Height,
  physical and timing all count.

**Done when:** a test proves players stand where the laws say at each set piece,
and the user gets corner moments. The same setups apply to AI set pieces shown on
the pitch.

## v1.19.0: Long shots and tempers

Requests 16, 17.

**Research before building:** study real halfway-line goals. Find how often players
are sent off for violent conduct, and what bans follow.

**Build:**

- **16.** Chance falls exponentially with distance: `xG = 0.10 * exp(-0.115 * (d -
  16.5))`, with `d` in metres, scaled by shooting. It fits the published figures
  (about 0.10 at 16.5 m, 0.03 at 27 m) and gives about 0.002 from halfway. The
  halfway figure is our extension of the curve, since no source publishes one.
- **16, the scene.** Past about 35 m a new long-range scene opens. You read how far
  off his line the keeper is, choose lob or driven, and hit a narrow power window.
  A keeper off his line is the real chance, as in football.
- **17.** Each match has a heat level, raised by hard fouls, the score and rivalry,
  and lowered by composure. When it boils over, the stage shows both players and the
  referee. Outcomes: calmed, a yellow, one red, or two reds. If the user is involved,
  they choose to walk away or square up, and composure decides how it goes.
- **17, the law.** Violent conduct is a red card. Reds carry a ban through
  `suspendedWeeks`, and a side plays on with fewer players.

**Done when:** a simulation over many shots matches the curve. Fights stay rare and
both sides are treated alike. Red-card totals stay near real levels.

## v1.20.0: Tactics

Requests 18, 19.

**Research before building:** which shapes are most used today, and the roles in
each? The first search gave only part of this. When do real coaches change shape
and make their first subs?

**Build:**

- **18, shapes.** Add 4-1-4-1, 4-4-1-1, 3-4-3, 3-4-2-1, 5-3-2, 5-4-1, 4-3-1-2 and
  4-1-2-1-2 to `FORMATION_SLOTS` and `FORMATIONS`.
- **18, in the match.** The shape in a match moves onto `MatchSide`, so a half-time
  change does not rewrite the club. Today the match screen offers no change of shape.
- **18, coaches.** They change shape at half time by score and men on the pitch: more
  attacking when behind, tighter when ahead, and 4-4-1 after a red card. The user is
  told, and their slot can move. Managers change shape at half time or any stoppage.
- **19.** `aiSubs` today never takes the user's player off. Now a poor rating by about
  the hour can see them subbed, and an injury or a booking raises the risk. The stage
  shows it. They then watch from the bench or skip to full time, and it hurts coach
  trust a little.

**Done when:** every shape gives a legal XI of 11 with the right lines, and the pitch
shows it. A poor player is subbed in simulation at a set rate; a good one never is.

## v1.21.0: Ability tree

Requests 36, 37, 38, 39, 40. Raises `SAVE_VERSION`.

**Research before building:** how do well-liked skill trees stay readable on a phone?
What can a phone do for panning and zooming without a new library?

**Build:**

- **36.** A new route, `/career/tree`, with its own navigation: a large map you drag
  around, with zoom buttons and a jump to each branch. Target about 120 nodes in plain
  data. A shared trunk, then branches for each role group: keeper, centre-back,
  full-back, holding midfielder, midfielder, playmaker, winger and striker, plus
  physical, mind and set pieces.
- **36, weak foot.** It leaves the creator (everyone starts at 2 stars) and becomes
  tree nodes up to 5 stars.
- **37.** `secondaryRole` becomes a list, and tree nodes unlock more positions, each
  needing the one before.
- **38.** Each node costs level points and needs an attribute level, with a parent
  node above it.
- **39.** Skill moves leave the points system. Pick one, pay money, and it trains for
  a number of weeks set by its stars. Progress shows on Train, and it finishes in
  `advanceWeek`.
- **40.** Attributes give perks. Energy stays out of 100 (request 32), so physical
  lowers each session's cost instead of raising the cap: about 28 at 50 physical, 22
  at 90. Others in the same spirit: pace shortens recovery, vision shows one more pass
  option, composure cuts the chance of a night out going wrong, and passing reduces
  the fee on skill move training.
- **Old saves.** A migration maps skills to nodes, refunds what no longer fits and
  turns the old second position into the list.

**Done when:** an old save loads with nothing lost. Every node is reachable. The
map runs smoothly at 360 px. Each perk has a test.

## v1.22.0: Champions League

Request 13. Raises `SAVE_VERSION`.

**Research before building:** the access list by nation and era, how the league phase
draw works, and past formats. 2024/25 on is confirmed; the details of the group era
still need a proper source.

**Build:**

- **Format by era.** From 2024/25: 36 clubs, one table, 8 games each (4 home, 4 away).
  1st to 8th go to the last 16, 9th to 24th play a two-legged play-off, 25th to 36th
  go out. Before 2024/25: 32 clubs in groups. Two-legged ties, then a one-game final.
  Away goals count until 2020/21.
- **Who qualifies.** Places come from league finish, with the rest of the 36 filled
  by the best other European clubs. A league champion from a small nation enters
  qualifying, so a San Marino club can still dream. Only the user's club plays those
  rounds live; the others are simmed.
- **Calendar.** Fixtures get a midweek slot and `userFixture` becomes a queue, because
  a week can now hold two matches. Fitness and rotation start to matter. Weeks must
  avoid the breaks at 9, 20 and 30.
- **Everywhere else.** A Tournaments page, honours, awards weight, milestones, money
  and fame, and manager mode.

**Done when:** a full season plays with the right number of clubs and matches, a
winner is crowned, and past-era starts use their format. Season sim time and save
size stay inside the targets.

## v1.23.0: Club page

Request 12.

**Research before building:** what does a player want from this page at each stage
of a career? Review the page with the user before building.

**Build:** today it is one long list: club card, requests, fame, then all clubs. Split
it into tabs: My club (standing, coach, dressing room, form, fixtures, including
Europe), Squad (team-mates and your place in the order), and Transfers (the keen and
all-clubs search). One job per tab, nothing longer than it needs to be.

**Done when:** each tab passes the `DESIGN.md` rules at 360 px, and no old feature is
lost.

## v2.0.0: Full audit

All requests.

- Replay the tracker line by line on a real phone.
- Play a whole career and a whole manager game, as `npm run probe` does and by hand.
- Performance run against the targets, then fix the worst offenders.
- Review the code with `/code-review`, and read all docs for anything out of date.

## After this list

Past seasons and Legends carry on from `PLAN-2026-11-04.md`. They are data work and
do not depend on the versions above. They need era rules from v1.16.0 and the group
format from v1.22.0 to play true to their time, so they resume after this list,
unless the user asks for them sooner.

## Open decisions

The plan goes ahead on the default unless the user says otherwise.

| # | Question | Default |
| --- | --- | --- |
| 4 | Is the wrong-goal shot the bug you meant? | Yes. Confirm on the phone after v1.11.0 |
| 10 | Which card is congested? | The player card on Play |
| 13 | Use the name "Champions League"? UEFA owns the marks | Use the words, with no logo or anthem, under the fan game notice. Revisit before any app store release |
| 13 | Other continents' club cups? | UEFA first; others later |
| 28 | Whose voice? | Rendered clips from a voice with a free licence. A real recording would sound better if you want to make one |
| 35 | Should Play always give 3x, or depend on stars? | Depends on stars, so skill still matters |
