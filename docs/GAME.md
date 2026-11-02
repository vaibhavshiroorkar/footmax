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
  confederation; exact position; foot and weak foot; height and build
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
  decides chances; the user's player gets key moments. Results never
  depend on watching.
- **Live pitch** (`src/ui/pitchSim.ts`, `src/ui/livePitch.tsx`): a
  frame-by-frame simulation of 22 players and a ball. Players run at their
  own pace to their slot in the formation, make runs, press and mark;
  keepers dive. The engine's move for each minute (`src/engine/play.ts`) is
  played out: passes, crosses (lobbed balls rise off their shadow),
  tackles, fouls, offsides, throw-ins, corners, goal kicks, shots.
- **Positions:** each formation has named slots (4-3-3 is GK, LB CB CB RB,
  CM CDM CM, LW ST RW); players fill the slot that suits them and stand
  there on the pitch and in the lineups.
- **What you see is what counts:**
  - the scoreboard only adds a goal when the pitch shows it going in;
  - each move plays once;
  - a save goes where the keeper can reach and he gets to it, and a goal
    goes past his dive;
  - an aimed shot goes to the same side on the pitch as in the shot game.
- **Key moments** pop up over the match while the pitch plays on in slow
  motion:
  - a choice: shoot, pass or take him on;
  - shots from the box, from distance (defenders can block) or one on one
    (chip with the chip move);
  - penalties and free kicks;
  - headers from crosses and corners;
  - passes picked on the pitch, where options light up as rings, safe to
    dangerous, with a Shoot button too; the ball goes to the mate you
    picked (or is cut out on the way), and a safe pass can come back as a
    one-two;
  - dribbles, which use one of four games (read and go, skill combo,
    nutmeg timing, sprint) depending on the skill move picked;
  - tackles and saves.
- **Shot timing:** the aim slides across the goal; tap to set it. In open
  play a defender closes in, so wait too long and he takes the ball. Then
  the power bar rises fast; tap in the green, or at the top it shoots
  itself at full power and flies over.
- **Shots are honest:** the shot strays from the aim by composure,
  shooting, weak foot, distance and power. Inside the keeper's reach
  (shown under him) it is saved and parried; out of reach and on target it
  is a goal; wide or overhit misses.
- **On the ball:** in a quiet move, when the user's player has the ball,
  the buttons become Shoot, Pass and Take him on, usable anywhere. Off the
  ball they are calls: Call for it, Make a run, Track back (8 minutes
  each, 3 minutes rest).
- **Screen:** one scoreboard row with speed (1x, 2x, 4x), pause, sound and skip,
  scorers under it, the pitch, the action buttons, then Feed, Lineups and
  Stats. No pop-up after goals. Full time shows the rating, player of the
  match, XP (the bar fills from where it was), fame, win bonus and what
  the match unlocked, and the table (five rows around the team, league or
  tournament group) with the places moved. The pitch hides at full time.
- **Managers** change approach and make substitutions at any time.
- **Sound:** kicks, whistles, crowd, goal roar, groans, chimes
  (`scripts/makeSounds.py`), with a setting to turn it off.

## Manager mode

Run a club, a national team or both: lineups and tactics, a transfer
market where any player can be bought, loans, swaps, release clauses,
contracts, board and federation confidence, sackings and job offers.

## Screens

- Bottom bar: More, Train, Play (the big middle button), Inbox, Me.
- Play: player strip, rewards, next match with Play inside it, this
  week's chips.
- Train: every attribute first, then Training, Abilities and Moves tabs.
- More: Life, Clubs, League, Internationals, Awards, Honours,
  Leaderboards, Settings, and a locked legends store (names only).
- Me: ladder, form and contract, season goals, milestones, growth,
  attributes, history.
- Notifications only appear when the player must act or can upgrade.

## Accounts and hosting

- Vercel deploys every push to `main` (footmax.vercel.app). Every change
  is pushed so it can be seen live.
- Supabase: email and Google sign-in, cloud saves (up to six slots),
  leaderboards and public profiles. Guest play needs no account.

## Planned next

- Life events with consequences:
  - dressing-room events and interviews with choices that lead somewhere;
  - romance and real-life events;
  - crime, corruption, jail and career-ending injuries that can end the
    career;
  - good events that help.
- Faster stat growth.
- A bigger gap between strong and weak players, so a 95 can dominate a
  team of 75s.
- Abilities as a skill tree per role.
- Team pages to browse any club's squad.
- The store stays locked until payments and licensing are decided.
