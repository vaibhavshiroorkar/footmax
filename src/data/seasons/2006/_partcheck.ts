// Temporary: checks the clubs of one 2006 file. Usage: npx tsx src/data/seasons/2006/_partcheck.ts england
import { MINOR_NATIONS, NATION_SEEDS } from '../../nations';
import { ClubSeed } from '../../pack';
const known = new Set([...NATION_SEEDS.map((n) => n.code), ...Object.keys(MINOR_NATIONS)]);
async function main() {
  const m = await import(`./${process.argv[2]}`);
  const problems: string[] = [];
  const seen = new Map<string, string>();
  let n = 0;
  for (const v of Object.values(m) as any[]) {
    for (const l of v) {
      const other = !l.id;
      console.log(`${l.id ?? l.nation}: ${l.clubs.length} clubs`);
      for (const c of l.clubs as ClubSeed[]) {
        const min = other ? 14 : 18;
        if (c.players.length < min) problems.push(`${c.name}: ${c.players.length} players, needs ${min}`);
        const roles = c.players.map((p) => (p.pos === 'GK' ? 'GK' : p.role ?? p.pos));
        const count = (...r: string[]) => roles.filter((x) => r.includes(x)).length;
        if (count('GK') < 2) problems.push(`${c.name}: fewer than 2 GK`);
        if (count('CB') < 2) problems.push(`${c.name}: fewer than 2 CB`);
        if (count('LB', 'LWB') < 1) problems.push(`${c.name}: no left back`);
        if (count('RB', 'RWB') < 1) problems.push(`${c.name}: no right back`);
        if (count('CDM', 'CM', 'CAM') < 3) problems.push(`${c.name}: fewer than 3 central midfielders`);
        if (count('LW', 'RW', 'LM', 'RM', 'CF', 'ST') < 3) problems.push(`${c.name}: fewer than 3 forwards or wingers`);
        for (const p of c.players) {
          n++;
          if (p.pos !== 'GK' && !p.role) problems.push(`${p.name} (${c.name}): needs exact role`);
          if (!known.has(p.nation)) problems.push(`unknown nation ${p.nation}: ${p.name} (${c.name})`);
          const age = 2006 - p.born;
          if (age < 15 || age > 42) problems.push(`${p.name} (${c.name}): age ${age}`);
          if (p.ovr < 35 || p.ovr > 95) problems.push(`${p.name} (${c.name}): rating ${p.ovr}`);
          if (/[^\x20-\x7e]/.test(p.name)) problems.push(`${p.name} (${c.name}): non-ASCII`);
          const key = `${p.name.replace('!', '')} ${p.born}`;
          if (seen.has(key)) problems.push(`duplicate ${key}: ${seen.get(key)} and ${c.name}`);
          seen.set(key, c.name);
        }
      }
    }
  }
  console.log(`${n} players. ${problems.length ? problems.join('\n') : 'no problems'}`);
}
main();
