import type { useFormat } from './format';
import type { Translate } from './i18n';
import type { ScoredExperiment } from './types';

export const absErrors = (scores: ScoredExperiment[]) =>
  scores.map((score) => Math.abs(score.ctrDelta ?? 0));

export const mean = (values: number[]) =>
  values.reduce((sum, value) => sum + value, 0) / values.length;

/**
 * The trend in words. The split mirrors `repo.accuracy` — newest half against the rest —
 * because both read the same graded rows and must agree on what counts as recent.
 */
export function claim(errors: number[], f: ReturnType<typeof useFormat>, t: Translate): string {
  const half = Math.floor(errors.length / 2);
  if (half === 0) return t('memory.trendThin', { error: f.dec(mean(errors), 2) });

  const recent = mean(errors.slice(errors.length - half));
  const earlier = mean(errors.slice(0, errors.length - half));

  return t(recent < earlier ? 'memory.trendBetter' : 'memory.trendWorse', {
    recent: f.dec(recent, 2),
    earlier: f.dec(earlier, 2),
  });
}
