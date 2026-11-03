// Checks every registered past-season pack: club counts, exact roles, a
// full XI per club, nations, duplicates and ages; then builds a world from
// it. Run with `npm run check-seasons` (or pass a year to check just one).
import { SEASONS, seasonLabel } from '../src/data/seasons';
import { DataPack } from '../src/data/pack';
import { validatePack } from '../src/data/pack';
import { MINOR_NATIONS, NATION_SEEDS } from '../src/data/nations';
import { generateWorld, START_YEAR } from '../src/engine/generator';

const known = new Set([...NATION_SEEDS.map((n) => n.code), ...Object.keys(MINOR_NATIONS)]);
const only = process.argv[2] ? Number(process.argv[2]) : null;

function expectedClubs(id: string, year: number): number {
  if (id === 'ENG1' || id === 'ESP1' || id === 'ITA1') return 20;
  if (id === 'ENG2') return 24;
  if (id === 'GER1' || id === 'NED1') return 18;
  if (id === 'FRA1') return year <= 2022 ? 20 : 18;
  if (id === 'POR1') return year <= 2013 ? 16 : 18;
  return 0;
}

async function main() {
  let failed = false;
  // A year on the command line is checked straight from its folder, so a
  // season can be checked before it is registered.
  const list: { year: number; label: string; load: () => Promise<DataPack> }[] = only
    ? [{ year: only, label: seasonLabel(only), load: () => import(`../src/data/seasons/${only}`).then((m: { PACK: DataPack }) => m.PACK) }]
    : SEASONS.filter((s) => s.year !== START_YEAR && s.ready);
  for (const s of list) {
    const problems: string[] = [];
    const raw = await s.load();
    const { pack, error } = validatePack(JSON.parse(JSON.stringify(raw)));
    if (!pack) {
      console.log(`${s.label}: invalid pack: ${error}`);
      failed = true;
      continue;
    }
    if (pack.startYear !== s.year) problems.push(`startYear is ${pack.startYear}, expected ${s.year}`);
    for (const id of ['ENG1', 'ENG2', 'ESP1', 'ITA1', 'GER1', 'FRA1', 'POR1', 'NED1']) {
      const l = pack.leagues.find((x) => x.id === id);
      if (!l) problems.push(`missing league ${id}`);
      else if (l.clubs.length !== expectedClubs(id, s.year)) problems.push(`${id} has ${l.clubs.length} clubs, expected ${expectedClubs(id, s.year)}`);
    }
    const seen = new Map<string, string>();
    const clubNames = new Set<string>();
    let players = 0;
    const all = [...pack.leagues.flatMap((l) => l.clubs.map((c) => [l.id, c] as const)), ...pack.otherClubs.flatMap((o) => o.clubs.map((c) => [o.nation, c] as const))];
    for (const [where, c] of all) {
      if (clubNames.has(c.name)) problems.push(`club listed twice: ${c.name}`);
      clubNames.add(c.name);
      const min = where.length === 4 ? 18 : 14;
      if (c.players.length < min) problems.push(`${c.name} (${where}): ${c.players.length} players, needs ${min}`);
      const roles = c.players.map((p) => (p.pos === 'GK' ? 'GK' : p.role ?? p.pos));
      const count = (...r: string[]) => roles.filter((x) => r.includes(x)).length;
      if (count('GK') < 2) problems.push(`${c.name}: fewer than 2 GK`);
      if (count('CB') < 2) problems.push(`${c.name}: fewer than 2 CB`);
      if (count('LB', 'LWB') < 1) problems.push(`${c.name}: no left back`);
      if (count('RB', 'RWB') < 1) problems.push(`${c.name}: no right back`);
      if (count('CDM', 'CM', 'CAM') < 3) problems.push(`${c.name}: fewer than 3 central midfielders`);
      if (count('LW', 'RW', 'LM', 'RM', 'CF', 'ST') < 3) problems.push(`${c.name}: fewer than 3 forwards or wingers`);
      for (const p of c.players) {
        players++;
        if (p.pos !== 'GK' && !p.role) problems.push(`${p.name} (${c.name}): broad position ${p.pos}, needs an exact role`);
        if (!known.has(p.nation)) problems.push(`unknown nation ${p.nation}: ${p.name} (${c.name})`);
        const age = s.year - p.born;
        if (age < 15 || age > 42) problems.push(`${p.name} (${c.name}): age ${age} in ${s.label}`);
        if (p.ovr < 35 || p.ovr > 95) problems.push(`${p.name} (${c.name}): rating ${p.ovr}`);
        if (/[^\x20-\x7e]/.test(p.name)) problems.push(`${p.name} (${c.name}): non-ASCII name`);
        const key = `${p.name.replace('!', '')} ${p.born}`;
        if (seen.has(key)) problems.push(`duplicate ${key}: ${seen.get(key)} and ${c.name}`);
        seen.set(key, c.name);
      }
    }
    try {
      const w = generateWorld(1234, pack);
      if (w.season !== s.year) problems.push(`world starts in ${w.season}`);
    } catch (e) {
      problems.push(`world does not build: ${(e as Error).message}`);
    }
    console.log(`${s.label}: ${players} players, ${all.length} clubs. ${problems.length ? `${problems.length} problems:` : 'no problems'}`);
    if (problems.length) {
      failed = true;
      console.log(problems.map((p) => `  ${p}`).join('\n'));
    }
  }
  if (failed) process.exit(1);
}

main();
