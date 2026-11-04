# FootMax game design

How the game works and why, as it stands now. Update this file whenever a
rule, system or decision changes, so it stays the single place that
remembers every detail. The look and layout rules live in `DESIGN.md`.
`docs/README.md` lists every doc and when to update it.

## What it is

An original football career and management game in the genre of Football
Rising Star: a mobile-first Expo app, played and tested on the web at
footmax.vercel.app. Two modes: a player career and a club and/or national
team manager. The goal is a game that feels rewarding and fun, with real
moments to play, not a wall of information.

## World

- All 211 FIFA nations (`src/data/nations.ts`, `src/data/nationsRest.ts`),
  each with a strength, a league level, colours, a name pool and clubs.
- Eight simulated leagues with real 2025/26 squads (Premier League,
  Championship, LaLiga, Serie A, Bundesliga, Ligue 1, Liga Portugal,
  Eredivisie) plus real clubs abroad. Other nations' leagues are built from
  their clubs when a career or manager game needs one.
- **Start season:** a new career or manager game starts in the current
  season (2026/27, today's squads) or, once its data is in, any season
  back to 2006/07. A pack's `startYear` sets the first season and the
  ages; its `nationStrength` sets national teams for that era.
- Small leagues play each other two or three times so there is a game most
  weeks.
- Real player names are used with an unofficial fan game notice. Faces of
  real players are never shown.
- Every player has an exact role (GK, LB, CB, RB, LWB, RWB, CDM, CM, CAM,
  LM, RM, LW, RW, CF, ST). Generated players roll one by position; old
  saves get the role their attributes suit (save migration 2 to 3).

## Player career

- **Creator:** name, nickname, shirt number; nation picked by
  confederation (a search field with five suggestions); exact position;
  foot and weak foot; height and build
  (they change stats, shown per stat); a playing style and 40 stat points;
  avatar and goal celebration.
- **Start at the bottom:** the first club is drawn at random from the
  weakest leagues of the player's confederation (San Marino, Gibraltar,
  Bhutan...). The club cannot be chosen.
- **The climb:** offers come from clubs near the player's level in any
  nation; signing builds that club's league. A ladder (grassroots,
  semi-pro, professional, top flight, elite) shows where he is.
- **Training:** three sessions a week (28 energy each of 100), each a
  mini-game or a quick session. Quick gives 1x; Play gives 1x, 2x or 3x for
  one, two or three stars (`trainingMult`). A rest day (+20 fitness, 15
  energy) is a tile in the drill grid. Energy shows as a value out of 100. Attributes show
  whole points with a bar filling toward the next one, and a "+1" pops
  when a point lands.
- **Abilities** (Playmaker, Clinical Finisher...) cost 1 skill point a
  level and need a minimum attribute. **Skill moves** (nine dribble
  tricks, six finishing techniques) cost 1 to 5 points.
- **Levels:** XP from matches, training and rewards fills levels; each
  level gives a skill point.
- **Rewards to claim:** finished season goals and milestones wait in a
  Rewards card; Claim pays them with a chime and celebrates a level-up.
  Unclaimed season goals pay out at the end of the season.
- **Happiness:** a coach bar (his trust, from form and the relationship)
  and a dressing-room bar (team-mates' average morale) on the Play screen.
- **Win bonus, fame, sponsors, shop, life actions, international call-ups,
  awards** (Ballon d'Or and others), and a second position at level 6.

## Matches

- **Engine** (`src/engine/match.ts`): minute by minute, team strength
  decides chances. Strength is a cubed mean of the players' ratings, so a
  star lifts his side more than his share, and great shooters take far
  more of the chances and finish them far better. A 95 side beats a 75
  side about 97% of the time; a league season still averages about 2.6
  goals a match with about 22% draws (`npx tsx scripts/gapCheck.ts`,
  `npm run balance`); the user's player gets key moments (at most 12 a
  match). Results never depend on watching: anything the pitch needs is
  drawn from its own random stream (`playSeed`).
- **Live pitch** (`src/ui/pitchSim.ts`, `src/ui/livePitch.tsx`): a
  frame-by-frame simulation of 22 players, a ball and a referee. Players
  run at their own pace to their slot in the formation, make runs, press
  and mark; keepers dive. The engine's move for each minute
  (`src/engine/play.ts`) is played out: passes, crosses and throw-ins
  (lobbed balls rise off their shadow), tackles, fouls, offsides,
  throw-ins, corners, goal kicks, shots, cards and injuries.
  - Players are shirt-coloured dots with their numbers (keepers squarer,
    with gloves). Human figures are only in the moment games.
  - The ball is a football (white with black panels) in every view, and
    spins as it rolls. Crosses are whipped and bend, long balls drift,
    curlers start outside the post and bend in, low shots skim the grass,
    driven ones swerve a little. Height, bend and pace vary every time.
    Play runs at 2.6 times real time at 1x, so a match goes by quickly.
  - Goal celebrations: the scorer runs to the corner flag and does his
    celebration (knee slide, backflip, robot, shush, heart hands, ice
    cold; the career player does the one he picked) with a jump for joy,
    team-mates chase him and crowd round, and confetti bursts in his
    colours. The caption then says what he did. It lasts as long in real
    time as before the speed-up.
  - In the moment games (shot, passes, saves, blocks, headers, dribbles)
    the players are drawn as people: keeper in a ready crouch who dives
    full stretch, defenders who spread their arms to cover the goal they
    hide, a four-man wall that jumps.
- **VAR:** about 8% of goals (not penalties) are checked. The ball goes
  in, play holds, VAR CHECK shows and the referee goes to a monitor at the
  touchline. Then GOAL (it stands, the celebration plays and the feed says
  the goal stood) or NO GOAL (ruled out for offside, a foul or handball,
  about 4 in 10 checks): it never counts and the defenders get a free
  kick. The scoreboard adds a goal only after the call. Tested in
  `__tests__/ui/var.test.ts`.
- **The laws on the pitch** (checked frame by frame in
  `__tests__/ui/rules.test.ts`):
  - kick-off: each side in its own half, the other side outside the
    centre circle; the referee waits until both are lined up; the kick-off
    goes back to a midfielder first;
  - offside: off the ball, attackers stay level with the second-last
    defender (not at corners, not in their own half);
  - free kicks and corners: the other side 9.15 m away, a four-man wall
    for free kicks within about 36 m of goal, attackers and markers in the
    box for corners; goal kicks: the other side out of the box; the kick
    waits until they are back;
  - keepers stay in their penalty area and come off their line to narrow
    the angle when the ball is near;
  - saves are sometimes tipped behind and shots deflected out: corners;
  - the ball is fetched to a restart spot instead of jumping there;
  - fouls bring a player down and give a free kick; a card follows a foul
    by that player: the referee runs over and shows it (a card shape on
    screen); a sent-off, subbed or injured player walks off the pitch;
    an injured player stays down first.
- **Positions:** each formation has named slots (4-3-3 is GK, LB CB CB RB,
  CM CDM CM, LW ST RW); players fill the slot that suits them and stand
  there on the pitch and in the lineups.
- **What you see is what counts:**
  - the scoreboard only adds a goal when the pitch shows it going in;
  - each move plays once;
  - every shot's facts are decided once (where it goes across the goal,
    how it is struck, over or wide, tipped, deflected, blocked, how the
    chance was built) and both the feed line and the pitch come from
    them, so "curls it into the left corner" is what you see; tested in
    `__tests__/engine/shotText.test.ts`;
  - a failed pass names the defender who cuts it out, and the pitch shows
    that defender winning it;
  - a save goes where the keeper can reach and he gets to it, and a goal
    goes past his dive;
  - an aimed shot goes to the same side on the pitch as in the shot game;
  - a picked pass goes to the team-mate picked.
- **Key moments** open on the main screen, never in a pop-up: the pitch
  and the action buttons form one block whose size never changes; a
  moment's game covers the pitch there, and the pass picker, the skip
  choices and the leave check cover the buttons under it. Nothing pushes
  the page. Moments:
  - a choice: shoot, pass or take him on;
  - shots from the box or from distance, with the defenders the pitch
    has in the way drawn in front of goal (up to three, nearest first), or
    one on one with nobody in the way (chip with the chip move);
  - penalties, and free kicks with a choice: shoot it, or cross it into
    the box (the pass options become crosses); both start from a foul on
    the user shown on the pitch;
  - headers from crosses and corners;
  - passes picked on the pitch, where options light up as rings, safe to
    dangerous, with a Shoot button too; a safe ball arrives about 85% of
    the time, a through ball about 65%, better passers more; a safe pass
    can come back as a one-two;
  - pass scenes: picking a through ball or a cross opens a short scene.
    Through ball: the runner bursts at the defensive line, which may step
    up; release just before he crosses it (late is offside, early is cut
    out). Cross: the striker attacks the near or far post and may switch
    late; a marker sweeps the box and the ball takes a moment to land, so
    aim where he will be. Better passing (and vision for through balls)
    widens the window, and Playmaker widens it more. A ball played well
    is a bigger chance (up to 1.4 times the danger); the pitch shows the
    same thing (a through ball runs him into the box, a cross is a header,
    an offside is flagged);
  - assists pay more: a bigger rating boost, more XP and more fame than
    before, so a good pass can be worth as much as a shot;
  - dribbles, which use one of four games (read and go, skill combo,
    nutmeg timing, sprint) depending on the skill move picked. Beat your
    man and you choose what comes next: shoot (one on one), pass, or take
    on the next man. The second man is harder to beat but pays more: a
    bigger rating boost and a clearer chance, then shoot or pass;
  - tackles and saves;
  - defending duels: read the pass (pick the lane from the passer's body
    shape; win it and you pick the counter pass), block a shot (slide as
    the ring closes) and head a cross clear (jump as the ball drops).
  - stats set the time you get in every game: vision (reading a pass),
    defending (blocks and tackles), height and strength (clearances),
    goalkeeping (saves), dribbling (dribbles), passing and vision (through
    balls and crosses). A weak player gets about a third of the window a
    top one gets. Even a well-timed through ball or cross can be cut out
    by a stretching defender.
  - a defending mistake (failing the timing and losing the duel) is
    punished: the man you lost gets a much better chance (clean through,
    a clear sight of goal, free in the box), and the user's rating drops
    more, and more again if it goes in. A lost duel in midfield can still
    end in a shot.
- **Shooting:** two taps. First pick how to strike it, free for everyone:
  Driven (hard and true), Curl (bends in from outside the post: round a
  defender, into the corners, but slower, so a curler at the keeper gives
  him time) or Low (hard for the keeper to get down to, easier to block,
  never goes over; struck too hard it drags wide). On free kicks a curler
  goes round the ends of the wall and a low one hits their feet. The shot
  view starts from where he stands: out to the left of goal, the ball
  starts on the left. With men in the way, Pass instead turns the shot
  into a pass from the same spot.
  1. Aim: a marker slides across the goal. In open play a defender closes
     in (a timer under the goal), and the keeper comes off his line the
     longer you wait, so his reach grows.
  2. Power: a fast bar with four bands, LOW (38%), MID (22%), HIGH (16%)
     and TOO HIGH: each good band is narrower than the one before, so they
     are easy to miss. Where you tap sets the power; at the top it shoots
     itself, over the bar. The bar speeds up as it fills. Shooting sets
     how fast it fills (much slower for a good shooter); composure sets
     how fast the aim marker moves and how long you have to aim.
     LOW is an easy save. MID is placed (less stray). HIGH is hard to save
     but strays more. TOO HIGH flies over (just into it chips the keeper
     in a one on one with the chip move). From distance a LOW or MID shot
     gives the keeper time to get across (his reach band under him widens
     as you watch); only HIGH beats him from far.
  The shot strays from the aim by composure, shooting, weak foot and
  distance. From outside the box a poor shooter strays far more and the
  keeper gets across more easily; it takes high shooting to score from
  there (the same holds when the sim plays the shot). No shot is certain:
  now and then the keeper gets a fingertip to one at full stretch, a good
  keeper more often, less often in the corners. Into a defender's body it is blocked; inside the keeper's
  reach it is saved; out of reach and on target it is a goal; wide misses.
  Each defender is drawn as wide as the part of the goal he hides, so a
  man close to the shooter looks bigger and blocks more. A blocked shot
  hits that same defender on the pitch and goes behind for a corner.
- **On the ball:** in a quiet move, when the user's player has the ball,
  the buttons become Shoot, Pass and Take him on, usable anywhere. Play
  slows to slow motion (at any speed) and waits about two seconds while
  he carries it, so there is time to choose.
- **Calls** (off the ball, 8 minutes each, no cooldown, switch any time),
  left to right:
  - Track back: he drops goal-side and presses, and gets tackle moments
    to win the ball;
  - Call for it: he comes short and a team-mate usually passes to him;
    he is also picked as the passer for chances about three times as
    often, and the team makes a few more chances with his support;
  - Make a run: he runs into the box (held onside by the line) and balls
    are played in behind to him there.
  A tag (RUN, CALL, BACK) shows over him while a call lasts.
- **Zone slider (Defend, Middle, Attack):** above the action buttons,
  starting at the role's zone (strikers, wingers and CAMs attack; CMs,
  CDMs and wide mids play the middle; defenders defend; keepers have
  none). He stands about 15 m higher or deeper, and it decides what comes
  to him:
  - Attack: more shots and men to beat, few defending moments;
  - Middle: passes from deep (a good one keeps the move going and
    sometimes makes a chance), long shots and passes to read;
  - Defend: tackles, blocks and clearances, few shots.
  No zone moment, call pass or win-back happens at a restart or in the
  first two minutes, and no moment opens before kick-off.
- **Screen:** one scoreboard row with speed (1x by default, 2x, 4x), pause, sound
  and skip (to half time or to full time), scorers under it, the pitch,
  the zone slider, the action buttons (on the bench: "Skip to when I come
  on", which stops when the coach brings him on, or plays to full time if
  he never does), then two tabs: Feed, and Teams
  (possession and shots, then one team at a time, picked by its crest,
  with team OVR, each player's OVR, live rating, goals and assists). No
  pop-up after goals. Full time shows the rating, player of the match,
  XP (the bar fills from where it was), fame, win bonus, what the match
  unlocked, and the table (five rows around the team, league or
  tournament group) with the places moved. The pitch hides at full time.
- **Managers** change approach and make substitutions at any time.
- **Sound:** kicks, whistles, crowd, goal roar, groans, chimes
  (`scripts/makeSounds.py`), with a setting and a button in the match to
  turn it off.

## Internationals

- Breaks in weeks 9, 20 and 30; summers hold the tournaments
  (`tournamentsForSummer`): World Cups in 2010, 2014... (32 teams until
  2022, 48 from 2026), Euros in 2008, 2012... (16 teams until 2012, 24
  from 2016), the Copa America in odd years until 2019 and then with the
  Euros, AFCON in even years until 2012 and odd years after, the Asian Cup
  in 2007, 2011..., the Gold Cup in odd years, the Nations League Finals
  in odd years from 2019.
- **World Cup qualifying** (`src/engine/qualifying.ts`): drawn at the start
  of the season before a World Cup (or at the first break of an old save).
  Every nation, by confederation, in seeded groups of three or four,
  home and away over six matchdays, two at each break. Group winners go
  through first, then the best runners-up (by points per game), up to the
  confederation's places; places left over go to the best of the rest.
  The World Cup takes exactly these teams. The user's nation's results
  and the final verdict come to the inbox; Tournaments shows its group.
  During qualifiers caps come from the matches, not the friendlies.
- The other tournaments pick their teams on form (team rating plus luck).

## Manager mode

Run a club, a national team or both: lineups and tactics, a transfer
market where any player can be bought, loans, swaps, release clauses,
contracts, board and federation confidence, sackings and job offers.

## Screens

- Bottom bar: Life, Train, Play (the big middle button), Inbox, Me.
- Play: the player card (face, club, rating; money and fame, which are not
  buttons; level bar and win streak), the next match with
  Play inside it, then four square shortcuts: Club, Tournaments, Awards,
  Leaderboard. Nothing pops into Play: rewards and the season review are
  on Me, and there are no week chips.
- Train: every attribute first, then Training, Abilities and Moves tabs.
- Abilities is a skill tree per position (`src/engine/skillTree.ts`):
  three branches, each a chain of nodes joined by a line; a node unlocks
  only after the one above it. Nodes are levels of the abilities (1 point
  each, with an attribute needed) and, at the end of some branches, a
  technique (2 points) that changes a moment:
  - Fake shot: a Fake button in shot moments sends the keeper the wrong
    way once and leaves him off balance (less reach);
  - Curler: curled shots bend further, round defenders and away from the
    keeper;
  - Defence splitter: a much wider through-ball window;
  - Last-ditch: the first defensive mistake each match is not punished;
  - Sweeper keeper: more time to react in save moments.
  Forwards: Finishing, Flair, Big games. Midfielders: Playmaking, Engine,
  Shooting. Defenders: Defending, Physical, Leadership. Keepers: Shot
  stopping, Distribution, Mind. A panel under the tree shows the chosen
  node, what it needs and Unlock; it keeps its size, so nothing moves.
- More is gone (`/career/more` redirects to Play). Honours is a tab in
  Awards; Settings is the gear on Me; League is reached from Club.
- Life: money's home, laid out as a store with four tabs. Each tab is a
  details panel that keeps its size over a grid of square tiles (three a
  row on a phone, four wider); tap a tile to see it in the panel and do,
  buy, open, wear or sell it there. This week (activities and
  sponsors); Shop (perks from $3K: ice baths, a media coach for 20% more
  fame, nutritionist, physio, personal trainer, top agent, car, villa);
  Cases (`src/engine/equipment.ts`): Bronze $2K, Silver $8K, Gold $25K
  roll equipment by rarity (common +1, rare +2, epic +3, legendary +5 to
  one attribute while worn). Six slots: boots, gloves (keepers), shin
  pads (outfield), training top, headband, smart watch; one piece per
  slot. A better piece goes on by itself; spares can be worn or sold. The
  reveal panel keeps its size, so opening a case moves nothing.
- Club (`/career/clubs`): your club first (team rating, table place, the
  coach's trust, the dressing room, a link to the league table), then Talk
  to the club (ask for a raise, to leave or for a loan; one request every
  6 weeks), then Keen on you or All clubs with a search. Every club shows its team
  rating (the average of its best eleven), the fame it needs before it
  listens, the agent's fee to pitch you (none for small clubs, real money
  for big ones) and its interest. Fame and money gate the Offer button,
  which says why when it is locked. Clubs that like you also get in touch
  through the inbox between windows; taking the call grows the
  relationship, so their offer comes sooner.
- Quit to menu is in Settings, which is the gear on Me and on the manager
  home. Play has no home button.
- Me: Settings gear in the header; ladder; fitness, morale, form and
  contract; rewards to claim (the Me tab badge counts them); the season
  review; the two season goals closest to done; Growth (rating now, the
  change this season, the scouts' potential range, a small line by
  season); a two-column grid of facts (value, scouts, nation, position,
  body, caps); milestones; career history; awards. Attributes live on
  Train.
- Inbox: Important (what needs an answer) and News.
- Life events with consequences (`src/engine/lifeEvents.ts`, in the same
  pool as media events, a little more often): dressing-room rows, meeting
  someone (a partner who later wants your time, or a split), nights out
  that can end in an arrest (a fine, a ban that keeps you out of the
  side, lost fame; a third arrest is prison and the end of the career),
  a fixer offering cash for a booking (each bribe taken can come out
  later: a 12-week ban, or a life ban once three are found), charity
  galas. Careers can also end with an injury, rarely, and more likely
  from 31 and 34. Fame brings the odd good surprise. A ban shows on the
  main screen; the career-over screen says why it ended.
- Media events: a pool of different situations, each with its own
  answers and effects (morale, fame, energy, money, club relations, board
  confidence). Ones tied to what just happened come first: a brace, a
  bad game, a big win or a defeat. Others: transfer links, a rival's
  jibe, a hospital visit, a documentary, a fan's letter, boot deals,
  title talk, the sack question, a star's rumoured exit, the academy. The
  last six are not repeated.
- Notifications only appear when the player must act or can upgrade.
  Results (training, life, offers) show as a short toast at the top that
  hides itself, so nothing on the page moves.
- Match scoreboard: three columns; the score, clock and controls in the
  middle, each team with its scorers in a fixed space under it (three
  lines, then "+N more"), so a goal never grows the board.
- Version: shown in Settings; every release is tagged in git and listed
  in `CHANGELOG.md`.

## Accounts and hosting

- Vercel deploys every push to `main` (footmax.vercel.app). Every change
  is pushed so it can be seen live.
- Supabase: email and Google sign-in, cloud saves (up to six slots),
  leaderboards and public profiles. Guest play needs no account.

## Planned next

`docs/ROADMAP.md` holds every open request and the version it ships in. Add
new requests there, and move a rule into this file when it is built.

Past seasons and Legends resume after that list. Their progress is in
`docs/PLAN-2026-11-04.md`: the season picker is built
(`src/ui/seasonPicker.tsx`, `src/data/seasons/`), and each season unlocks
when its pack lands (format in `docs/SEASON_DATA.md`, checked by
`npm run check-seasons`). Real players appear by name only, never by face.

## Working on the code

- **Stack:** Expo SDK 58, React Native 0.88, React 19, expo-router
  (screens in `src/app`), zustand stores in `src/state` (the game object is
  changed in place; `rev` and `liveRev` counters re-render). Fonts: Big
  Shoulders Display and Rubik. Sound: expo-audio. Read `AGENTS.md` before
  touching any Expo API, and `DESIGN.md` before changing the look.
- **Where things are:**
  - `src/engine/`: the game, free of React. `match.ts` (match engine, key
    moments, zones, calls, incidents), `play.ts` (the move drawn for each
    minute), `career.ts`, `progress.ts` (season goals, milestones,
    claims), `skills.ts` (abilities and skill moves), `roles.ts`
    (formations and slots), `save.ts` (migrations; `SAVE_VERSION` in
    `game.ts`), `alerts.ts` (badges).
  - `src/ui/pitchSim.ts`: the live pitch simulation (no React, tested);
    `src/ui/livePitch.tsx` draws it.
  - `src/ui/moments/`: the mini-games (`ShotGame`, `PassGame`,
    `DribbleGame`, `DribbleMore`, `HeaderGame`, `SaveGame`,
    `DefendGames`); `useTicker.ts` is their clock.
  - `src/app/match.tsx`: the match screen; `src/app/career/`: Play
    (`index.tsx`), Train, Me (`profile.tsx`), Life, Clubs.
  - `src/data/`: nations, leagues and real squads.
- **Checks before every push:** `npm run typecheck`, `npm run lint`,
  `npm test`. The tests include whole matches played through the pitch:
  goals shown exactly once, keepers on the ball for saves, aim sides, the
  laws (`__tests__/ui/rules.test.ts`) and the zone mix
  (`__tests__/engine/zones.test.ts`).
- **Looking at it in a browser:** `npx expo export --platform web --dev`
  builds it and keeps the `window.__footmax` store hook; serve the output
  and drive it with headless Chrome. The dev server here stops seeing
  edits, so do not rely on it. Always start Chrome with `--mute-audio`.
- **Shipping:** commit and push to `main`; Vercel deploys
  footmax.vercel.app. The user wants every change pushed so they can see
  it live, and the docs updated in the same commit (`docs/README.md`).
