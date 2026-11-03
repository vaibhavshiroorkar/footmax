# FootMax game design

How the game works and why, as it stands now. Update this file whenever a
rule, system or decision changes, so it stays the single place that
remembers every detail. The look and layout rules live in `DESIGN.md`.

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
  mini-game whose score sets the gain, or a quick session at 0.9x. A rest
  day (+20 fitness, 15 energy) sits on the Train screen. Attributes show
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
  decides chances; the user's player gets key moments (at most 12 a
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
    nutmeg timing, sprint) depending on the skill move picked;
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
- **Screen:** one scoreboard row with speed (1x, 2x, 4x, 8x), pause, sound
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

## Manager mode

Run a club, a national team or both: lineups and tactics, a transfer
market where any player can be bought, loans, swaps, release clauses,
contracts, board and federation confidence, sackings and job offers.

## Screens

- Bottom bar: More, Train, Play (the big middle button), Inbox, Me.
- Play: player strip, then two tiles: Life (money, where you spend it)
  and Clubs (fame, and how many clubs are keen), then the next match with
  Play inside it, this week's chips, then rewards to claim (last, so
  claiming one moves nothing).
- Train: every attribute first, then Training, Abilities and Moves tabs.
- More, in groups: Your career (Life, Clubs), Football (League,
  Internationals, Awards, Honours), Other (Leaderboards, Settings), then
  the locked legends store as one card (names only).
- Clubs: your club first (team rating, table place, the coach's trust),
  then Keen on you or All clubs with a search. Every club shows its team
  rating (the average of its best eleven), the fame it needs before it
  listens, the agent's fee to pitch you (none for small clubs, real money
  for big ones) and its interest. Fame and money gate the Offer button,
  which says why when it is locked. Clubs that like you also get in touch
  through the inbox between windows; taking the call grows the
  relationship, so their offer comes sooner.
- Me: ladder, form and contract, season goals, milestones, growth,
  attributes, history.
- Inbox: Important (what needs an answer) and News.
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

Asked for and not built yet, in the order they will be done:

1. Dribbles and sprints: beat your man, then choose what comes next
   (shoot, pass, take on the next man), with a reward that feels big.
2. VAR: the referee reviews a goal or a penalty, with an animation of
   him at the monitor, before the decision.
3. Attributes and abilities as a skill tree per role, unlocking
   techniques that change moments (curling shots, fake shots, and more).
4. Money buys many useful things; Clash Royale style cases with
   equipment that makes the player better.
5. Faster stat growth, and a bigger gap between strong and weak players
   so a 95 can dominate a team of 75s.
6. Life events with consequences: dressing room, interviews with choices,
   romance, real-life events, crime and jail, corruption, career-ending
   injuries (some end the career), and good events that help.
7. A mega search for clubs: browse any club, see its profile, squad,
   lineup and details, see who has made an offer, and offer yourself to a
   club.
8. World Cup qualifying for every nation, so even India can try to
   qualify.
9. Start the game in 2010, just after the World Cup, with squads of that
   time (prime Messi and Ronaldo). This needs 2010 squad data for every
   league; today's data is 2025/26.
10. An alignment pass: nothing wraps or overflows, one screen where
    possible.

The store stays locked until payments and licensing are decided; real
players appear by name only, never by face.

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
    (`index.tsx`), Train, Me (`profile.tsx`), More, Life, Clubs.
  - `src/data/`: nations, leagues and real squads.
- **Checks before every push:** `npm run typecheck`, `npm run lint`,
  `npm test`. The tests include whole matches played through the pitch:
  goals shown exactly once, keepers on the ball for saves, aim sides, the
  laws (`__tests__/ui/rules.test.ts`) and the zone mix
  (`__tests__/engine/zones.test.ts`).
- **Looking at it in a browser:** `npx expo export -p web` builds `dist`;
  serve it and drive it with headless Chrome. Always start Chrome with
  `--mute-audio`.
- **Shipping:** commit and push to `main`; Vercel deploys
  footmax.vercel.app. The user wants every change pushed so they can see
  it live, and this file kept up to date with every rule and decision.
