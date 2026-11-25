/** Not a real test: prints how big each area and discipline is. Run: npx vitest run src/lib/arete/tree/stats.test.ts */
import { it } from 'vitest';
import { AREAS, CORE_NODES, LADDERS, GUIDES } from '../tree';
import { disciplineKey } from './dsl';

it('prints tree stats', () => {
  const lines = [`TOTAL ${CORE_NODES.length} stations, ${LADDERS.length} lines, ${GUIDES.size} guides`];
  for (const a of AREAS) {
    const mine = CORE_NODES.filter(n => n.area === a.id);
    const by = new Map<string, number>();
    for (const n of mine) by.set(n.branch, (by.get(n.branch) ?? 0) + 1);
    lines.push(`${a.name}: ${mine.length} — ${[...by].map(([b, c]) => `${b} ${c}${GUIDES.has(disciplineKey(a.id, b)) ? '' : ' (no guide)'}`).join(', ')}`);
  }
  console.log(lines.join('\n'));
});
