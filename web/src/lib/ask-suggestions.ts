import type { PostDetail } from './types';

const FALLBACK = ['ask.who', 'ask.why', 'ask.next'];
const RESCUE_WINDOW_H = 72;
const OPENING = 0.15;
const HALFWAY = 0.5;
const PAR = 0.5;
const STRONG = 0.6;

/**
 * The chips are the only part of the Mind a creator reaches without typing, so they are worth
 * spending on the video actually open. Every rule reads a signal the payload already carries —
 * `relative` is YouTube's own percentile against comparable videos, the one benchmark here
 * honest enough to phrase a question around. Order is priority: what can still be acted on
 * comes before what can only be understood.
 */
export function askSuggestions({ post, comments, retention }: PostDetail): string[] {
  const ageH = (Date.now() - new Date(post.publishedAt).getTime()) / 3_600_000;
  const drops = retention?.steepestDropOffs ?? [];
  const ranked = (retention?.points ?? []).map((point) => point.relative).filter((r) => r != null);
  const typical = ranked.length ? ranked.reduce((sum, r) => sum + r, 0) / ranked.length : null;

  const matched = [
    ageH < RESCUE_WINDOW_H && 'ask.rescue',
    drops.some((drop) => drop.ratio <= OPENING) && 'ask.earlyDrop',
    // the list is sorted by size, so the first entry is the moment that cost the most
    drops[0] != null && drops[0].ratio >= HALFWAY && 'ask.lateDrop',
    comments.some((comment) => comment.triage === 'criticism') && 'ask.criticism',
    comments.some((comment) => comment.triage === 'question') && 'ask.questions',
    typical != null && typical < PAR && 'ask.belowTypical',
    typical != null && typical >= STRONG && 'ask.whatWorked',
  ].filter((key) => typeof key === 'string');

  return [...matched, ...FALLBACK].slice(0, 3);
}
