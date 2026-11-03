# FootMax docs

Read these at the start of every session, in this order. Together they
hold everything about the project, so no context depends on a chat.

| File | What it holds | Update it when |
| --- | --- | --- |
| [ROADMAP.md](ROADMAP.md) | What comes next: every open request, the version it ships in, and its status | A request arrives, a status changes, or the plan moves |
| [HISTORY.md](HISTORY.md) | What happened: each stage of the project, the decisions made and why, and the traps found | A version ships or a decision is made |
| [GAME.md](GAME.md) | How the game works right now: every rule and system | Any rule or system changes |
| [RESEARCH.md](RESEARCH.md) | What we found out: laws, formats, tools, measurements and their sources | Before building each version |
| [SEASON_DATA.md](SEASON_DATA.md) | The format of past-season squad packs | The pack format changes |
| [PLAN-2026-11-04.md](PLAN-2026-11-04.md) | Progress on past-season squads and Legends | A season pack lands |

Outside this folder: [`DESIGN.md`](../DESIGN.md) holds the look and layout
rules, [`CHANGELOG.md`](../CHANGELOG.md) lists each release for players, and
[`AGENTS.md`](../AGENTS.md) holds the rules for working on the code.

## Keeping them current

The docs change in the same commit as the work, never after it.

1. A new request goes into `ROADMAP.md` straight away, in the words it was
   written in, with a version and a status.
2. Before building a version, finish its research and add what was found to
   `RESEARCH.md`, with sources.
3. When a version ships:
   - mark its items done in `ROADMAP.md`;
   - move the rules into `GAME.md`;
   - add a stage to `HISTORY.md`, with any decision or trap worth keeping;
   - add a `CHANGELOG.md` entry, bump `app.json` and `package.json`, and tag
     the release.
4. If a decision changes an older rule, edit the older rule too. Two docs
   must never disagree.
