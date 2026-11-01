# FootMax

A football (soccer) career and management game for Android, iOS and the web. Built with Expo and React Native.

The world is built from real data: 77 nations, 8 simulated leagues (Premier League, Championship, LaLiga, Serie A, Bundesliga, Ligue 1, Liga Portugal, Eredivisie) and about 2,000 real players from the 2025/26 season, plus real clubs abroad (Saudi Pro League, MLS, Brazil, Argentina, Turkey and more). Generated players fill out squads and national pools. Any other nation's league is built from its real clubs when a game starts there.

- **Player career.** A step-by-step creator: confederation and nation, exact position (15 roles including goalkeeper), foot, height and build, a playing style and 40 stat points, an avatar and a goal celebration. Start at a small club in your nation's league. Train through quick mini-games (target practice, sprint race, timing passes, skill combos, reaction blocks and saves) whose score sets your gains. Chase the coach's season targets and unlock career milestones for XP and fame, and see your growth in a season review and a rating chart. Earn skill points and unlock a second position at level 6. Coaches pick on form, so a bad run gets you benched. Track your standing with clubs, pitch yourself to them, and chase the Ballon d'Or, Golden Boy, Yashin Trophy and Golden Boot.
- **Matches.** Lineups before kick-off, a live pitch with the ball moving between the teams, a Lineups tab with live ratings and substitutions, and key moments for every position: shots, dribbles, passes, tackles and saves.
- **Manager.** Run a club, a national team, or both. Search and bid for any player in the world, negotiate fee then wages, use loans, swaps and release clauses, and handle bids, contract demands and transfer requests. The board and the federation judge your results.
- **Internationals.** International breaks in weeks 9, 20 and 30. Every summer brings tournaments: the World Cup (48 teams) in 2030, 2034...; the Euros and Copa America in 2028, 2032...; and AFCON, the Asian Cup, the Gold Cup and the Nations League Finals in odd years.
- **Editor.** Edit any player or club in a save, or export, edit and import the whole database as a JSON data pack.
- **Saves.** Keep up to six careers and manager games side by side. Load, rename or delete them from the title screen. The game saves itself after every action.
- **Notifications.** Badges and pop-ups only appear when you have to act: a message that needs an answer, or a skill you can upgrade now. News waits quietly in the inbox.

Ratings are estimates and squads drift out of date as real transfers happen. Use the editor or a data pack to correct them. Real names and likenesses are licensed in many countries, so check before publishing a build to an app store.

## Play it

Play in the browser at https://vaibhavshiroorkar.github.io/footmax/. Every push to `main` rebuilds the site (`.github/workflows/deploy.yml`). Saves stay in that browser's local storage.

## Run it

```sh
npm install
npm run web        # play in the browser at http://localhost:8081
npm start          # scan the QR code with Expo Go to play on a phone
```

## Develop

```sh
npm test                    # engine unit tests (Jest)
npm run typecheck
npm run lint
npm run check-data          # unknown nation codes and duplicate players in the database
npm run balance -- 3 1234   # sim seasons headless: goals per game, winners, save size
npm run probe -- 6 7        # play a career as an active user would and print progress
```

## Layout

- `src/data/` holds the database: nations and their domestic clubs, name pools, one file per league, and real clubs outside the simulated leagues. Players are packed as `Name POS NAT YY OVR`.
- `src/engine/` holds all game rules as plain TypeScript with no React. Every random roll uses a seeded RNG stored in the save.
- `src/app/` holds the screens (Expo Router: one file per route).
- `src/ui/` holds shared components and the match mini-games (`src/ui/moments/`).
- `src/state/` holds the zustand store, save slots and storage. Saves are deflated (about 5x smaller) so several fit in the browser's and Android's storage limits. Big values are split across several AsyncStorage keys.
