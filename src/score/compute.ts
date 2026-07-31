import { config } from '../config.ts';
import type { ProbeResult, ServiceScore } from '../types.ts';
import { loadProbes } from './store.ts';

const UP_OUTCOMES = new Set(['up_402', 'up_free', 'up_paid']);

/**
 * Composite weights. Uptime dominates: a beautiful answer from a dead
 * service is worth nothing to a buyer agent deciding where to spend.
 */
const WEIGHTS = {
  uptime: 0.45,
  latency: 0.15,
  schema: 0.15,
  quality: 0.25,
};

/** Latency → 0-1: 500ms or faster is perfect, 10s or slower is zero. */
function latencyScore(p50: number | null): number | null {
  if (p50 === null) return null;
  const clamped = Math.min(Math.max(p50, 500), 10_000);
  return 1 - (clamped - 500) / 9_500;
}

function percentile(values: number[], p: number): number | null {
  if (values.length === 0) return null;
  const sorted = [...values].sort((a, b) => a - b);
  return sorted[Math.min(sorted.length - 1, Math.floor(p * sorted.length))];
}

function toGrade(composite: number): ServiceScore['grade'] {
  if (composite >= 85) return 'A';
  if (composite >= 70) return 'B';
  if (composite >= 55) return 'C';
  if (composite >= 40) return 'D';
  return 'F';
}

export function scoreService(probes: ProbeResult[]): Omit<
  ServiceScore,
  'resource' | 'provider' | 'category'
> {
  const up = probes.filter((p) => UP_OUTCOMES.has(p.outcome));
  const uptime = probes.length ? up.length / probes.length : 0;
  const latencyP50 = percentile(
    up.map((p) => p.latencyMs),
    0.5,
  );
  const withSchema = probes.filter((p) => p.schemaValid !== undefined);
  const schemaValidRate = withSchema.length
    ? withSchema.filter((p) => p.schemaValid).length / withSchema.length
    : null;
  const graded = probes.filter(
    (p): p is ProbeResult & { quality: number } =>
      typeof p.quality === 'number',
  );
  const avgQuality = graded.length
    ? graded.reduce((s, p) => s + p.quality, 0) / graded.length
    : null;

  // Missing dimensions redistribute their weight instead of scoring zero,
  // so estimate-only services aren't punished for never having been graded.
  const parts: Array<[number, number]> = [[WEIGHTS.uptime, uptime]];
  const lat = latencyScore(latencyP50);
  if (lat !== null) parts.push([WEIGHTS.latency, lat]);
  if (schemaValidRate !== null) parts.push([WEIGHTS.schema, schemaValidRate]);
  if (avgQuality !== null) parts.push([WEIGHTS.quality, avgQuality / 10]);
  const totalWeight = parts.reduce((s, [w]) => s + w, 0);
  const composite = Math.round(
    (parts.reduce((s, [w, v]) => s + w * v, 0) / totalWeight) * 100,
  );

  const timestamps = probes.map((p) => p.ts).sort();
  return {
    samples: probes.length,
    paidSamples: probes.filter((p) => p.mode === 'paid').length,
    uptime,
    latencyP50Ms: latencyP50,
    schemaValidRate,
    avgQuality,
    composite,
    grade: toGrade(composite),
    firstProbe: timestamps[0] ?? '',
    lastProbe: timestamps[timestamps.length - 1] ?? '',
  };
}

/** All service scores over the configured window, best first. */
export function computeScores(): ServiceScore[] {
  const since = Date.now() - config.scoreWindowDays * 24 * 60 * 60 * 1000;
  const probes = loadProbes(since);
  const byResource = new Map<string, ProbeResult[]>();
  for (const p of probes) {
    const list = byResource.get(p.resource) ?? [];
    list.push(p);
    byResource.set(p.resource, list);
  }
  const scores: ServiceScore[] = [];
  for (const [resource, list] of byResource) {
    scores.push({
      resource,
      provider: list[list.length - 1].provider,
      category: list[list.length - 1].category,
      ...scoreService(list),
    });
  }
  return scores.sort((a, b) => b.composite - a.composite);
}
