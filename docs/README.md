# FootMax docs

Read these at the start of every session, in this order. Together they
hold everything about the project, so no context depends on a chat.

| File | What it holds | Update it when |
| --- | --- | --- |
| [ROADMAP.md](ROADMAP.md) | What comes next: every open request, the version it ships in, and its status | A request arrives, a status changes, or the plan moves |
| [pending.md](pending.md) | Unfinished work from project chats and documents, with sources and completion checks | Work is found, finished, deferred, or awaiting review |
| [Engine design](superpowers/specs/2026-11-05-engine-consistency-design.md) | Approved shared match state and delivery order for the backlog | An implementation decision changes |
| [Engine foundation plan](superpowers/plans/2026-11-05-engine-foundation.md) | Implementation steps for engine ownership, snapshots and transitions | A step finishes or its design changes |
| [Match usability plan](superpowers/plans/2026-11-05-match-usability.md) | Training labels, interaction buttons and match rewards | A step finishes or its design changes |
| [Match flow plan](superpowers/plans/2026-11-06-match-flow.md) | Quick Sim results, cards, Press and referee audio | A step finishes or its design changes |
| [Career and match rules plan](superpowers/plans/2026-11-09-career-and-match-rules.md) | Awards, retirement, VAR suspense and ground passes | A step finishes or its design changes |
| [Grounds and crowds plan](superpowers/plans/2026-11-09-grounds-and-crowds.md) | Grounds, crowds in team colours and the climb you can feel | A step finishes or its design changes |
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
   Keep `pending.md` in sync with open requests, reviews and research gaps.
   When an item is finished, preserve its request text and mark it done in `ROADMAP.md`.
   Document its outcome in the relevant documents listed above, then remove it from `pending.md`.
   Do all three in the same change. Do not leave completed checkboxes in `pending.md`.
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
