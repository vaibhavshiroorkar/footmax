// Sanity check for the built-in database: unknown nation codes, duplicate
// players and squad counts. Run with `npx tsx scripts/checkData.ts`.
import { BUILTIN_PACK } from '../src/data/builtin';
import { MINOR_NATIONS, NATION_SEEDS } from '../src/data/nations';

const known = new Set([...NATION_SEEDS.map((n) => n.code), ...Object.keys(MINOR_NATIONS)]);
const seen = new Map<string, string>();
let players = 0;
const problems: string[] = [];
const clubs = [...BUILTIN_PACK.leagues.flatMap((l) => l.clubs.map((c) => [l.id, c] as const)), ...BUILTIN_PACK.otherClubs.flatMap((o) => o.clubs.map((c) => [o.nation, c] as const))];
for (const [where, c] of clubs) {
  for (const p of c.players) {
    players++;
    if (!known.has(p.nation)) problems.push(`unknown nation ${p.nation}: ${p.name} (${c.name})`);
    // Same name, nation and birth year means the same person listed twice.
    const key = `${p.name.replace('!', '')} ${p.nation} ${p.born}`;
    if (seen.has(key)) problems.push(`duplicate ${key}: ${seen.get(key)} and ${c.name}`);
    seen.set(key, c.name);
  }
  if (!c.players.some((p) => p.pos === 'GK') && where.length === 4) problems.push(`no GK listed: ${c.name}`);
}
for (const l of BUILTIN_PACK.leagues) console.log(`${l.id}: ${l.clubs.length} clubs`);
console.log(`${players} database players, ${clubs.length} clubs`);
console.log(problems.join('\n') || 'no problems');
