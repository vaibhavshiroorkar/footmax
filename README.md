# FootMax

A football (soccer) career and management game for Android, iOS and the web. Built with Expo and React Native.

The world is built from real data: all 211 FIFA nations, 8 simulated leagues (Premier League, Championship, LaLiga, Serie A, Bundesliga, Ligue 1, Liga Portugal, Eredivisie) and about 2,000 real players from the 2025/26 season, plus real clubs abroad (Saudi Pro League, MLS, Brazil, Argentina, Turkey and more). Generated players fill out squads and national pools. Any other nation's league is built from its clubs when a career or manager game needs it.

- **Player career.** A step-by-step creator: confederation and nation, exact position (15 roles including goalkeeper), foot, height and build, a playing style and 40 stat points, an avatar and a goal celebration. Every career starts at the bottom: a random small club in one of the weakest leagues of your confederation (San Marino, Gibraltar, Bhutan, Tonga...). Climb the ladder from grassroots to elite as bigger clubs call. Height and build shape your stats, and the creator shows exactly how. Train twice a week through quick mini-games (target practice, sprint race, timing passes, skill combos, reaction blocks and saves) whose score sets your gains; attributes fill toward the next point and land one point at a time. Chase the coach's season targets and unlock career milestones for XP and fame, and see your growth in a season review and a rating chart. Earn skill points and unlock a second position at level 6. Coaches pick on form, so a bad run gets you benched. Track your standing with clubs, pitch yourself to them, and chase the Ballon d'Or, Golden Boy, Yashin Trophy and Golden Boot.
- **Matches.** A live pitch that plays every move: numbered players pass, run and shoot, and goals, saves and misses happen where you can see them. Lineups with shirt numbers before kick-off, live ratings and substitutions, and key moments for every position: shots, dribbles, passes, tackles and saves. Full time shows your rating, player of the match, XP, fame and win bonus.
- **Manager.** Run a club, a national team, or both. Search and bid for any player in the world, negotiate fee then wages, use loans, swaps and release clauses, and handle bids, contract demands and transfer requests. The board and the federation judge your results.
- **Internationals.** International breaks in weeks 9, 20 and 30. Every summer brings tournaments: the World Cup (48 teams) in 2030, 2034...; the Euros and Copa America in 2028, 2032...; and AFCON, the Asian Cup, the Gold Cup and the Nations League Finals in odd years.
- **Editor.** Edit any player or club in a save, or export, edit and import the whole database as a JSON data pack.
- **Saves.** Keep up to six careers and manager games side by side. Load, rename or delete them from the title screen. The game saves itself after every action.
- **Notifications.** Badges and pop-ups only appear when you have to act: a message that needs an answer, or a skill you can upgrade now. News waits quietly in the inbox.

Ratings are estimates and squads drift out of date as real transfers happen. Use the editor or a data pack to correct them. Real names and likenesses are licensed in many countries, so check before publishing a build to an app store.

## Play it

Play in the browser at https://footmax.vercel.app. The site is an installable web app: use "Add to Home Screen" on a phone.

FootMax is an unofficial fan game. It is not affiliated with any league, club, federation or player.

## Hosting

Vercel builds and serves the site (`vercel.json`): `main` goes to production and every other branch and pull request gets its own preview URL. GitHub Actions (`.github/workflows/ci.yml`) runs the typecheck, lint, data check, tests and a web build on every push.

To set it up on a new Vercel account: import the GitHub repo and keep the defaults; `vercel.json` sets the build command and output. If the project gets a name other than `footmax`, change the `og:image` URLs in `public/index.html`.

The page template, social-preview tags and web app manifest live in `public/`. Icons are in `assets/` (app) and `public/icons/` (web).

## Accounts and cloud saves

Accounts use Supabase: email and password or Google sign-in, cloud saves, leaderboards and public profiles at `/u/<username>`. Builds use the official FootMax Supabase project by default (`src/state/supabase.ts`). Set the two `EXPO_PUBLIC_SUPABASE_*` env vars to use your own project, or set the URL to `off` to run guest-only with everything on the device.

Setting up a Supabase project:

1. Create a project at supabase.com. Copy the project URL and the publishable key from Project Settings > API into `.env.local` (see `.env.example`) and into the Vercel project's environment variables.
2. Run `supabase/migrations/20261102000000_init.sql` in the SQL editor. It creates the tables, row level security, the private `saves` storage bucket and the account deletion function.
3. Run `supabase/tests/rls.sql` in the SQL editor. It should end with "RLS checks passed" and leaves no data behind.
4. Authentication > URL Configuration: set the Site URL to `https://footmax.vercel.app` and add these redirect URLs: `https://footmax.vercel.app/**`, `https://*-<your-vercel-team>.vercel.app/**` (previews), `http://localhost:8081/**` and `footmax://**`.
5. Authentication > Providers > Google: paste the client ID and secret of a Google Cloud OAuth client (type "Web application") whose authorized redirect URI is `https://<project-ref>.supabase.co/auth/v1/callback`.

How sync works: the device is the source of truth while playing. A save uploads about 15 seconds after it changes and when the app goes to the background. Each upload moves the cloud copy to the next revision only if nobody else moved it first; otherwise the save is marked as changed on two devices and the player picks which copy to keep. Leaderboard numbers come from the player's own save, so the database only rejects impossible values.

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
