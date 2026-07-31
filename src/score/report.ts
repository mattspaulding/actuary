import { computeScores } from './compute.ts';

const scores = computeScores();
if (scores.length === 0) {
  console.log('No probe data yet. Run `npm run probe` first.');
  process.exit(0);
}

console.log(
  'GRADE  SCORE  UPTIME  P50(ms)  SAMPLES  SERVICE',
);
for (const s of scores) {
  console.log(
    [
      `  ${s.grade}  `,
      String(s.composite).padStart(5),
      `${Math.round(s.uptime * 100)}%`.padStart(6),
      String(s.latencyP50Ms ?? '—').padStart(8),
      String(s.samples).padStart(8),
      `  ${s.provider} — ${s.resource}`,
    ].join(' '),
  );
}
