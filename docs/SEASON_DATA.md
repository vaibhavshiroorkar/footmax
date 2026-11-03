# Season data packs

A past season (2006/07 to 2024/25) is a data pack with that season's clubs
and squads. A new career or manager game can start in any season that has
one. The current season uses the built-in pack (`src/data/leagues/`).

## Files

One folder per season, named by its start year:

```
src/data/seasons/2006/
  index.ts        // exports PACK: DataPack
  england.ts      // ENG1 Premier League, ENG2 Championship
  spain.ts        // ESP1 LaLiga
  italy.ts        // ITA1 Serie A
  germany.ts      // GER1 Bundesliga
  france.ts       // FRA1 Ligue 1
  portugalNetherlands.ts // POR1 Liga Portugal, NED1 Eredivisie
  otherClubs.ts   // big clubs abroad that season
```

`index.ts`:

```ts
import { DataPack } from '../../pack';
import { ENGLAND } from './england';
// ...
export const PACK: DataPack = {
  format: 'footmax-pack',
  version: 1,
  name: 'FootMax 2006/07',
  startYear: 2006,
  nationStrength: { ITA: 74, FRA: 73, BRA: 75, ... },
  leagues: [...ENGLAND, ...SPAIN, ...ITALY, ...GERMANY, ...FRANCE, ...PORTUGAL, ...NETHERLANDS],
  otherClubs: OTHER_CLUBS,
};
```

Register the season in `src/data/seasons/index.ts` (`PAST`):

```ts
2006: () => import('./2006').then((m) => m.PACK),
```

## Leagues

The same ids, nations, tiers and names as the built-in pack. ENG2 has
`parent: 'ENG1', swap: 3`. Club counts must match that season:

| League | Clubs |
| --- | --- |
| ENG1 Premier League | 20 |
| ENG2 Championship | 24 |
| ESP1 LaLiga | 20 |
| ITA1 Serie A | 20 |
| GER1 Bundesliga | 18 |
| FRA1 Ligue 1 | 20 until 2022/23, 18 from 2023/24 |
| POR1 Liga Portugal | 16 until 2013/14, 18 from 2014/15 |
| NED1 Eredivisie | 18 |

The clubs are the ones that actually played in that division that season
(promoted sides in, relegated sides out).

## Clubs

`club(name, short, rep, colour1, colour2, players)`, as in the built-in
pack. For a club that is also in the built-in pack, reuse its `short` and
colours. `rep` (1-99) is the club's standing that season: the season's
champions and Champions League regulars 85-93, mid-table top-flight sides
70-80, Championship sides 60-72.

## Players

Packed as `Name ROLE NAT YY OVR`, separated by `; `:

- **Name**: the name the player was known by, ASCII only (no accents). A
  leading `!` marks a one-name player (`!Ronaldinho`, `!Kaka`).
- **ROLE**: the exact role he played most that season: `GK`, `LB`, `CB`,
  `RB`, `LWB`, `RWB`, `CDM`, `CM`, `CAM`, `LM`, `RM`, `LW`, `RW`, `CF`, `ST`.
  Always an exact role, never `DEF`/`MID`/`FWD`, so the lineups come out
  right.
- **NAT**: the FIFA code of the nation he played for (or was eligible
  for), from `src/data/nations.ts` or `nationsRest.ts`. Serbia and
  Montenegro players are `SRB`.
- **YY**: two-digit birth year (`87` for 1987, `04` for 2004).
- **OVR**: his rating that season on a 1-99 scale, as a game of that year
  would rate him. World's best around 90-93, Champions League starters
  80-88, top-flight squad players 70-78, Championship 62-72.

Each club lists **its real squad that season, at least 18 players**: the
regular starting XI plus the main squad players, in squad order (keepers,
defenders, midfielders, forwards). That covers at least 2 GK, 2 CB, a left
back, a right back, 3 central midfielders and 3 forwards or wingers.
Players who moved in a January window are listed where they spent most of
the season. Nobody is listed twice in a season.

## Other clubs

The big clubs outside the simulated leagues that season, as `OTHER_CLUBS`
by nation, at least 14 players each: Scotland (Celtic, Rangers), Turkey
(Galatasaray, Fenerbahce, Besiktas), Brazil and Argentina (the giants),
Russia, Ukraine, Greece, Belgium, the USA, and where relevant Saudi Arabia
and Qatar.

## Nation strengths

`nationStrength` sets each national team's strength that season on the
same scale as `src/data/nations.ts` (today Spain, England and France are
72). List the top 40 or so nations of the era; others keep today's value.

## Check

`npm run check-seasons` loads every registered season, builds a world
from it and reports wrong club counts, missing roles, bad nations,
duplicates and impossible ages. It must print `no problems`.
