# FootMax research

What we found out and where it came from. Each version in `ROADMAP.md` adds its
findings here before it is built. Mark anything unproven as open.

## Shared match state

The engine's physical pitch owns positions, while legacy interactions report outcomes
that `visualizeMoment` reconstructs as new moves. Headers generate their own lane
and marker. These code paths need a shared state contract; camera changes alone
cannot establish full continuity. The approved design is in
[Engine consistency](superpowers/specs/2026-11-05-engine-consistency-design.md).

Box2D's simulation documentation recommends fixed time steps and explains sweeping
fast objects to their first contact. These principles inform the TypeScript
runtime; adding Box2D is not part of the design. The fixed 60 Hz physical step
produces identical seeded movement at 30, 60 and 120 display frames per second.
The current clock ratio advances 1.95 physics seconds per wall-clock second at 1x.

The foundation's 12-match probe averages 175 seconds per match, excluding user decision time.
Median caption time remains 1.62 seconds, with 3% shown for under one second.
None of its 248 shots went toward the wrong goal. This checks direction, not full action continuity.
Three simulated seasons finish with 2.55 to 2.77 goals per match and 22% to 23% draws.

Sources: [Box2D simulation](https://box2d.org/documentation/md_simulation.html),
[Expo SDK 58](https://docs.expo.dev/versions/v58.0.0/),
[Expo audio reference](https://docs.expo.dev/versions/v58.0.0/sdk/audio/).

The halftime regression now skips a pending chance, invalidates its callback and accepts a fresh second-half chance.
Open: full transition measurements, real-phone frame times and reproduction of the reported audio failures.

The audio path reused idle players without waiting for `seekTo(0)` to finish.
Two requests could reserve the same player before its playing flag changed.
Playback now reserves the player while rewinding and rejects cancelled requests.
SDK 58 declares `seekTo` as a promise; the implementation now awaits it.
Tests cover delayed rewind, duplicate calls, muting, failed seeks and voice replacement.
The referee preference was missing from saved settings and now survives reloads.
Free-kick scenes without a preceding foul animation previously had no voice call.
They now announce once; a foul and booking followed by a restart do not repeat it.
Clip clarity still needs the existing listening review on a phone.

## Baseline: v1.10.0 (measured 2026-11-04)

Typecheck and lint are clean, and all 113 tests in 17 suites pass.

The match numbers come from 12 seeded matches with a career striker, played
through `PitchSim` at 60 frames a second and 1x speed. Moments resolved at once,
and on-ball waits were not included, so a real match takes longer. A throwaway
script measured these. v1.11.0 turns it into `scripts/matchProbe.ts`.

| Measure | Value |
| --- | --- |
| Pitch time per match | 305 s |
| Moves shown per match | 97 (64 quiet, 33 busy) |
| Mean quiet move | 2.45 s (157 s a match) |
| Mean busy move | 4.41 s (144 s a match) |
| Key moments per match | 5.25 |
| Goals per match | 2.67 |
| Caption time on screen, median | 0.64 s |
| Caption time on screen, 10th percentile | 0.22 s |
| Captions shown for under 1 s | 83% |
| Shots flying at the wrong goal | 40 of 239 (17%) |
| Shots taken by keepers | 0 of 239 |

"Busy" means the move holds a goal, save, miss, moment, foul, card or injury.

### What this means for request 1

A 2x clock means a match of about 153 s of pitch time. At 0.75x speed every move
takes a third longer, which gives these totals:

| What is shown at 0.75x | Pitch time | Clock speed-up |
| --- | --- | --- |
| Every move | 407 s | 0.75x |
| Busy moves only | 192 s | 1.6x |
| Busy moves with shorter build-up (target 4.6 s each) | 152 s | 2x |

So skipping quiet minutes is not enough. Reaching 2x also needs shorter build-up
in busy moves, and plain fouls treated as quiet. If that looks rushed, the honest
landing point is about 1.6x to 1.8x.

### Result in v1.12.0

171 s a match with play at 0.75x, so the clock runs 1.78 times faster than
v1.10.0 (about 1.9 times with goal celebrations left out, which must not shrink).
That is the stopping point: cutting more would leave a chance with no build-up at
all. Median caption 1.62 s, 4% under a second (goals cutting in).

### Result in v2.0.0

Across all versions: 166 to 172 s of pitch time a match (v2.3.0), so the clock runs about 1.8 times faster
than v1.10.0 with play at 0.75x. The referee scenes cost about 15 s on top of v1.12.0's
171 s. Median caption 1.62 s, 3% under a second. No wrong-goal shots.

Production web build, CPU slowed 4x, no GPU: live pitch 57 fps, shot moment 60 fps, no
page errors. The main bundle grew from 2.88 MB to 2.95 MB. Nothing here ran on a real
phone, which is the one test left.

### Request 4: the cause

`addFinish` in `src/engine/play.ts` sets `step.side` to the attackers on a tipped
save or a deflected miss, because they take the corner. `PitchSim` then reads
`step.side` as the defending side, so it aims at the shooter's own goal and picks
the shooter's own keeper. The ball flies the length of the pitch, then jumps back
for the corner. Measured: 30 tipped saves and 10 deflected misses out of 239
finishes, and no other kind. Keepers never took a shot.

### Defending shape (v1.13.0)

Coaching guides put a compact block at about 30 to 35 m from back to front, 35 to
40 m wide, with 10 to 15 m between lines. They disagree on units and nothing here
is a governing-body standard, so these are rules of thumb. A study of 153 Bundesliga
games found almost no difference in compactness between successful and failed
defending, so shape alone does not stop goals.

Measured over five matches, at the moment each shot was struck:

| | v1.12.0 | v1.13.0 |
| --- | --- | --- |
| Shots with a defender within 3 m of the line to goal | 50% | 58% |
| Mean men in that lane | 0.62 | 0.75 |
| Frame-to-frame ball jumps over 3 m, per four matches | 74 | 0 |

The first attempt changed nothing: the block was too wide and moved at a jog, and
tacklers came from formation spots. Passing live positions to the move builder and
making the block run did the work.

Sources: [The Football Analyst on compactness](https://the-footballanalyst.com/?p=7317),
[TeamStats on defensive shape](https://teamstats.net/blog/strengthening-defensive-shape-through-practice),
[Bundesliga compactness study](https://ucrisportal.univie.ac.at/en/publications/is-a-compact-organization-important-for-defensive-success-in-elit/).

### Rendering the rig (v1.14.0)

Frame rate on the web build, CPU slowed 4x, software rendering (no GPU), so a harsh
stand-in for a mid-range phone:

| Build | Live pitch | Shot moment |
| --- | --- | --- |
| Dev, before memoising | 33 fps | 23 fps |
| Production, memoised | 59 fps | 44 fps (median frame 16.7 ms) |

SVG meets the target, so Skia and its 2.9 MB download are not needed. To repeat this,
build with `EXPO_PUBLIC_TEST_HOOK=1`, which keeps the store hook in production. Open:
nobody has measured it on a real phone yet. That is for v2.0.0.

### Keepers and contact (v1.15.0)

- The ball takes 400 to 600 ms from the penalty spot (Kuhn 1988, via Tsai 2005).
- A keeper takes about 0.6 s to reach a side and a full second to stretch to a top
  corner (van der Kamp and colleagues, 2018).
- One site puts the Premier League save rate near 70%. The source is weak.
- Liverpool average 6.6 corners a game in the Premier League all-time. No reliable
  league-wide figure turned up.
- Open: no source gave parried against held saves, or dive distance in metres. The
  splits in `contact.ts` and its reach figures are our judgement, tuned by test.

Sources: [Tsai on keeper dive response](https://ojs.ub.uni-konstanz.de/cpa/article/view/1115),
[Bowtell on the keeper-dependent strategy](https://repository.lboro.ac.uk/articles/Analysis_of_the_keeper-dependent_strategy_in_the_soccer_penalty_kick/9625016),
[The Journal on van der Kamp's review](https://www.thejournal.ie/article.php?id=3973669),
[StatMuse on corners](https://www.statmuse.com/fc/ask/liverpool-average-corners).

### Stalls and teleports (v2.1.0)

Measured over eight matches on v2.0.0. When a moment opened, the ball was on average
8.4 m from the player and up to 40 m. Stretches of a dead ball with nothing on screen
to explain it: corners 2.6 s at worst, free kicks 2.3 s, throw-ins 1.9 s, tackles 1.6 s.
The offside bug: the engine picked the attacking side at random after a restart, so the
defenders took the free kick and lost it at once.

## Laws of the Game

Source: IFAB Laws, read 2026-11-04. The 2026/27 Laws took effect on 1 July 2026.

**Penalty (Law 14).** The keeper stays on the line, between the posts, facing the
kicker until the kick. At the kick, at least one foot must touch, be in line with
or be behind the line. Everyone else stands inside the field, outside the box, at
least 9.15 m from the mark and behind it. Feinting in the run-up is allowed, but
feinting after it is a caution and an indirect free kick. The kicker cannot touch
the ball again until another player has, so a rebound off the keeper can be scored,
but one off the post cannot be played by the kicker.

**Offside (Law 11).** A player is in an offside position if any part of the head,
body or feet is in the opponents' half and nearer the goal line than both the ball
and the second-last opponent. Hands and arms do not count, and level is onside.
Being there is no offence. It only counts when they play the ball, interfere with
an opponent, or gain from a rebound or deflection. There is no offence direct from a
goal kick, throw-in or corner. The free kick is taken where the offence happened.

**Fouls and misconduct (Law 12).**

- Sending-off offences: denying a goal or obvious chance (DOGSO), serious foul
  play, violent conduct, biting or spitting, offensive language or actions, and a
  second caution.
- DOGSO in the box is a caution if it was a genuine attempt at the ball. Holding,
  pulling, pushing or having no chance of the ball is a red.
- Violent conduct is excessive force or brutality against an opponent when not
  challenging for the ball, with or without contact.
- Keepers may hold the ball for eight seconds. After that the opponents get a
  corner, taken on the side nearest the keeper.
- Handball: a goal scored direct from the hand or arm, or straight after it touched
  them, does not count. The shoulder is not part of the arm.
- Advantage: a card for the offence is given when the ball next goes out of play.
  It should not be played for serious foul play, violent conduct or a second caution
  unless there is a clear chance.

**Ball in play (Law 9).** A ball off a post, the bar or a corner flag stays in play
while it stays on the field. So rebounds are live.

**Free kicks (Law 13).** Attackers must stay at least 1 m from a wall of three or
more defenders until the ball is in play.

**New for 2026/27.** A slow throw-in or goal kick can bring a five-second countdown.
Missing it gives a throw to the opponents or a corner. A player taken off must leave
within 10 seconds. A player treated on the pitch stays off for a minute after the
restart. VAR can now help with a wrong second yellow, mistaken identity and, as a
competition option, a clearly wrong corner.

**Open, for v1.16.0.** The minimum number of players; what happens when two players
fight at once (the Law 12 page was only part read); and the first season of VAR, of
five subs and of the eight-second rule in each competition.

## Champions League

**From 2024/25.** 36 clubs in one league phase, 8 games each, 4 home and 4 away, against
8 different opponents. 1st to 8th reach the last 16. 9th to 24th play two-legged
play-offs, with 9th to 16th seeded. 25th to 36th are out. Two-legged ties follow, then
a one-game final.

**Qualifying (2026/27).** 29 clubs go straight in and 7 come through qualifying: three
qualifying rounds and a play-off round. From the second round the field splits into a
champions path and a league path.

**Before 2024/25.** A double round-robin group stage of 32 clubs. Away goals last counted
in 2020/21, and level ties then went to extra time and penalties.

**Group era (confirmed).** 32 clubs in eight groups of four, seeded, no two from one
association in a group. Top two go through, third drops into the Europa League. The
game does not model the Europa League, so third place simply ends there.

**Open.** Each era's real access list by nation: sources disagree and England had six
in 2025/26, so the game's places are approximate. The real draw has a two-per-nation
limit; the game only avoids same-nation games where it can. Other continents' club
cups are not in.

## Shot distance

| Distance | Chance of a goal | Source quality |
| --- | --- | --- |
| Inside the box, overall | About 15% | Premier League analysis |
| Outside the box, overall | 3.7% to 4.8% | Premier League studies |
| 18 yards | 0.07 to 0.12 xG | Rough, one calculator site |
| 25 yards | 0.03 to 0.06 xG | Rough, same site |
| 30 yards | About 0.03 xG | Rough, same site |
| Halfway line | Not found | Our extension of the curve |

Curve for request 16: `xG = 0.10 * exp(-0.115 * (d - 16.5))`, with `d` in metres. It
gives 0.03 at 27 m and about 0.0016 from halfway, near 1 in 600. Treat the far end as a
design choice, not data.

## Tools (Expo SDK 58)

| Tool | Finding | Plan |
| --- | --- | --- |
| `@shopify/react-native-skia` 2.14.0 | In Expo Go. On the web it needs CanvasKit, about 2.9 MB gzipped, which can load only when needed | Only if SVG misses the frame targets in v1.14.0 |
| `react-native-reanimated` 4.7.1 | Needs `react-native-worklets`. In Expo Go, and works on the web | Not needed yet |
| `expo-speech` | Android, iOS, web. Voices depend on the device, speech queues, and there is no sound on an iPhone in silent mode | Rejected for the referee |
| `react-native-gesture-handler` | Available | Check in v1.21.0 whether the tree needs it |

**How the code draws today.** The live pitch moves `Animated` values each frame, with no
React render. The moment games re-render React SVG every frame through `useTicker`, so
they are the performance risk once figures have joints. Nobody has measured this on a
phone yet.

**Joints.** Two-bone IK solves an arm or leg exactly with the law of cosines, with no
iteration. FABRIK handles longer chains but iterates. Each limb here has two bones, so
two-bone IK fits. A target past full stretch has no solution, so the hand stops at full
reach, which is what stops a keeper saving what he cannot reach.

**Voice.** Piper is an offline text-to-speech tool, reported as MIT licensed, with voices
under their own licences. The sources are second-hand, so check the licence on the
voice's model card and the engine's own repo in v1.17.0.

## Formations

4-3-3, 4-2-3-1 and 4-4-2 are confirmed as widely used. Sources for 4-1-4-1, 5-3-2,
3-4-2-1 and 4-4-1-1 gave no role detail, so that research stays open for v1.20.0.

## Rates and law dates (v1.16.0)

| Measure | Real | Source quality |
| --- | --- | --- |
| Yellows a match | 4.19 (2024/25: 1,591 in 380) | Good |
| Reds a match | 0.14 (52 in 380) | Good |
| Penalties scored a match | 0.22 to 0.25 | Good |
| Fouls a match | About 22.8 | Medium |
| Offsides a match | About 2.8 | Weak |

Law 3: a match cannot start or continue with fewer than seven on a side. A keeper
sent off must be replaced by a sub or an outfield player. The VAR start seasons are
confirmed for the big five. The 2022/23 date for five subs and the abandoned-match
score are from general knowledge, not a checked source.

Sources: [Extratime 2024/25](https://extratime.com/stats/2129/2287/premier-league/),
[OLBG on referees](https://www.olbg.com/blogs/men-middle-premier-league-referee-performances),
[Worldmetrics](https://worldmetrics.org/football-match-statistics/),
[IFAB Law 3](https://theifab.com/laws/latest/the-players),
[ESPN on VAR in Europe](https://global.espn.com/football/story/_/id/37501924/how-var-performed-la-liga-serie-bundesliga-ligue-1-mls-season).

## The referee's voice (v1.17.0)

Rendered clips beat `expo-speech`: they sound the same on every device and overlap
the crowd. The clips use Piper with the `en_US-norman` voice, whose model card says
"public domain", from LibriVox recordings. Piper (GPL-3.0) is only a build tool and
does not ship. Each call is the shortest of six takes, trimmed by energy, raised in
pitch, driven and given a short echo. Open: nobody has listened to them. They were
checked by their waveforms only, so a person should judge how they sound.

Sources: [norman model card](https://huggingface.co/rhasspy/piper-voices/raw/main/en/en_US/norman/medium/MODEL_CARD),
[Piper](https://github.com/OHF-Voice/piper1-gpl).

## Corners (v1.18.0)

Near-post flick-ons, far-post deliveries with delayed runs and short corners are the
standard routines, and sources agree on them. No reliable public figures split goals
by delivery type, so the game does not favour one by data.

Sources: [Guide to Football on corner routines](https://guidetofootball.com/tactics/corner-routines/),
[Left Back Football on short corners](https://leftbackfootball.com/home/2022/2/1/short-corner-routines-from-around-world-football).

## Long shots and tempers (v1.19.0)

Premier League goals from a player's own half are rare and famous: Beckham, Alonso,
Rooney twice, Charlie Adam and a handful of keepers. No source gave a total, so the
1 in 600 from halfway stays our own extension of the curve. The scene rewards a keeper
off his line because the famous examples turn on that.

The three-game ban for violent conduct and the rate of flare-ups are our judgement,
not checked figures. Red cards stay near the real level.

Sources: [FourFourTwo on own-half goals](https://www.fourfourtwo.com/features/players-who-scored-from-inside-their-own-half),
[Sportskeeda on halfway goals](https://www.sportskeeda.com/slideshow/top-5-goals-from-behind-the-half-way-line-in-premier-league-history).

## Tactics (v1.20.0)

The first substitution comes around the 60th minute and barely moves year to year,
which is why the sub windows stay at 60, 70 and 80. Research suggests trailing sides
should change by 58, 73 and 79 minutes. No reliable figure exists for how often
coaches change shape, so the 45% chance at half time is our judgement. The formation
research stayed thin: the shapes are standard, and their slots follow common use.

Sources: [Kwest on substitution timing](https://kwestthoughts.substack.com/p/how-effective-are-managers-substitutions),
[FiveThirtyEight on subs when behind](https://fivethirtyeight.com/features/down-at-halftime-in-a-soccer-game-use-your-subs),
[ESPN on substitutes](https://global.espn.com/football/story/_/id/37505582/premier-league-teams-rarely-use-all-their-substitutes-why-take-advantage-such-fresh-legs).

## Skill tree on a phone (v1.21.0)

Sources are thin. The useful points: keep the tree as data, draw lines so prerequisites
read at a glance, make state obvious once a tree is big, and zooming out is a known
pain. There is no sourced guidance on touch targets, so nodes are 50 px, above the
44 px this app already uses. No gesture library is needed: nested scroll views drag the
map, and two zoom buttons rescale it.

Sources: [Wayline on data-driven skill trees](https://www.wayline.io/blog/unity-skill-tree-scriptable-objects),
[itch.io player feedback](https://itch.io/post/15844276).

## Awards, retirement, VAR and passing (v2.5.0)

**Awards (C12).** Since 2022 the Ballon d'Or judges one season. Its criteria, in
order: individual performance, team results and titles, then class and fair play.
100 journalists from FIFA's top 100 nations each rank ten of a 30-player shortlist.
From 1995 players from anywhere at European clubs were eligible, and from 2007 every
professional. Since 1995 the winners have come from England, France, Germany, Italy
and Spain. The 2026 shortlist still reached beyond them: one MLS and one Saudi player.
The Golden Boy is for under-21s in a European top flight. The European Golden Shoe
doubles goals in the five strongest leagues by UEFA coefficient and counts them 1.5
times in the next band. Sources differ on whether that band ends at 21st or 22nd.
The game uses league strength for that band, because it only builds the leagues a
career needs, so ranks among them would be wrong.

**Retirement (C7).** A study of 3,467 retired Portuguese players found a mean
retirement age of 32.7 (sd 4.3, range 21 to 45) after 17.5 years in the game. It did
not split by position or division. The claim that keepers play several years longer
comes from weaker sources, but it is consistent across them. The game's limit sits
above 32.7 because its player turned pro at 16 and plays at a good level; that is a
design choice.

**VAR (C24).** Premier League figures put the average check at about 40 s in
2022/23, 64 s in 2023/24 and 40 s in 2024/25. One commercial source claims over four
minutes per review in 2025/26; it is not comparable with the league's own figures.
The game keeps the stages (check, lines or monitor, call) and shrinks the minute
into a few seconds of pitch time.

**Passing (C39).** A long ball is one of 32 m or more. In 2025/26 the Premier League
averaged 99.7 long balls in 849.1 passes a game, about 11 to 12%. The long-pass share
fell from 19.4% in 2006/07 to a low of 10.5%. Lower English tiers play more long
passes, and less accurately. The match probe measured the live pitch at 83% lofted
passes before this change and 49% after (12 matches, seeds 101 to 112). The rest are
mostly passes of over 40 m left by the clock's folding of quiet minutes, which the
pitch must not split into touches the engine never played.

Sources: [SI on Ballon d'Or voting](https://www.si.com/soccer/how-ballon-dor-voting-work-nominees-format-explained),
[Al Jazeera on the 2026 shortlist](https://aljazeera.com/sports/2026/9/8/dembele-mbappe-kane-and-yamal-top-ballon-dor-shortlist),
[90min on non-European winners](https://www.90min.com/posts/has-player-outside-europe-ever-won-ballon-dor),
[Golden Boy on Wikipedia](https://en.wikipedia.org/wiki/Golden_Boy_(award)),
[Golden Shoe points](https://www.topendsports.com/sport/soccer/awards/golden-shoe-europe.htm),
[Journal of Human Kinetics on retirement age](https://pmc.ncbi.nlm.nih.gov/articles/PMC12360933),
[Jobs in Football on retirement](https://jobsinfootball.com/blog/what-age-do-soccer-players-retire/),
[Irish Times on 2023/24 VAR waits](https://www.irishtimes.com/sport/soccer/2024/06/05/premier-league-reveals-waiting-time-for-var-decisions-went-up-50-last-season/),
[Premier League on 2024/25 VAR](https://premierleague.com/news/4251195),
[Opta Analyst on long balls](https://www.premierleague.com/en/news/4426039/opta-analyst-on-long-balls-long-throws-key-tactical-trends-spotted-in-2025-26-season),
[The Analyst on style by division](https://theanalyst.com/articles/how-does-the-style-of-football-change-as-you-journey-down-the-english-football-league).

## Sources

- IFAB Laws: [penalty kick](https://theifab.com/laws/latest/the-penalty-kick),
  [offside](https://theifab.com/laws/latest/offside),
  [fouls and misconduct](https://theifab.com/laws/latest/fouls-and-misconduct),
  [ball in and out of play](https://theifab.com/laws/latest/the-ball-in-and-out-of-play)
- [IFAB on match flow and player behaviour](https://theifab.com/news/the-ifab-introduces-further-measures-to-improve-match-flow-and-player-behaviour/)
- [The FA on free kicks, Law 13](https://www.thefa.com/football-rules-governance/lawsandrules/laws/football-11-11/law-13---free-kicks)
- [UEFA on 2026/27 qualifying](https://www.uefa.com/uefachampionsleague/news/02a6-20e5a8be4e63-ae971c582f8c-1000--2026-27-champions-league-qualifying-fixtures-results-dates-how-it-/)
- [UEFA on the 2024/25 format](https://uefa.com/uefachampionsleague/news/0290-1bae124dbd1a-4a9fc08cd25c-1000--2024-25-champions-league-teams-format-dates-draws-final)
- [ESPN on the knockout rounds](https://africa.espn.com/football/story/_/id/43439604/how-teams-qualify-champions-league-knockout-rounds)
- [UEFA on away goals](https://www.uefa.com/uefachampionsleague/news/027d-17172d2190e2-03070c1a3001-1000--does-the-away-goals-rule-still-apply/)
- [Champions League on Wikipedia](https://en.wikipedia.org/wiki/UEFA_Champions_League)
- Shot figures: [Fantasy Football Scout on xG](https://www.fantasyfootballscout.co.uk/2019/06/14/expected-goals-part-one-what-is-xg-and-how-is-it-measured/),
  [Metricgate on xG](https://metricgate.com/docs/expected-goals/),
  [The Analyst](https://theanalyst.com/?p=222651)
- Expo SDK 58: [Skia](https://docs.expo.dev/versions/v58.0.0/sdk/skia/),
  [Reanimated](https://docs.expo.dev/versions/v58.0.0/sdk/reanimated/),
  [Speech](https://docs.expo.dev/versions/v58.0.0/sdk/speech/),
  [docs index](https://docs.expo.dev/llms.txt)
- [React Native Skia on the web](https://shopify.github.io/react-native-skia/docs/getting-started/web)
- [Godot on two-bone IK](https://docs.godotengine.org/pl/4.x/classes/class_skeletonmodification2dtwoboneik.html)
- [Humanoid procedural animation study](https://journals.vilniustech.lt/index.php/MLA/article/view/19216)
- [Piper voices listing](https://tts.ai/voices/piper/)
- [FourFourTwo on formations](https://www.fourfourtwo.com/features/football-tactics-formations-explained-442-433-451-4231-most-common-how-beat-them)
