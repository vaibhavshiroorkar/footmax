// Prints the starting overall each role and style preset produces, to keep
// new careers around 46-50. Run with `npx tsx scripts/creationCheck.ts`.
import { ROLE_LIST, ROLES } from '../src/engine/roles';
import { STYLE_PRESETS, STAT_POINTS, applyAllocation, autoAllocate, baseTemplate, pointsSpent } from '../src/engine/creation';
import { overall } from '../src/engine/player';

for (const r of ROLE_LIST) {
  const body = { heightCm: 180, build: 'athletic' as const };
  const base = overall({ attrs: baseTemplate(r, body), position: ROLES[r].broad, role: r });
  const res = STYLE_PRESETS[r].map((s) => {
    const a = autoAllocate(r, s.weights, STAT_POINTS);
    return `${s.id} ${overall({ attrs: applyAllocation(r, body, a, 2), position: ROLES[r].broad, role: r })} (${pointsSpent(a, 2)} pts)`;
  });
  console.log(`${r.padEnd(4)} base ${base}  ${res.join('  ')}`);
}
