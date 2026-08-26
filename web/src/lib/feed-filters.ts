import { useCallback, useMemo } from 'react';
import { api } from '@/lib/api';
import { useAsync } from '@/lib/use-async';
import type { FeedPost } from '@/lib/types';

export type FilterKey = 'unanswered' | 'aboveMedian' | 'running';

export const FILTERS: FilterKey[] = ['unanswered', 'aboveMedian', 'running'];

function quantile(sorted: number[], q: number): number {
  const at = (sorted.length - 1) * q;
  const low = Math.floor(at);
  const high = Math.ceil(at);
  return low === high ? sorted[low]! : sorted[low]! + (sorted[high]! - sorted[low]!) * (at - low);
}

export type Band = { low: number; median: number; high: number } | null;

/**
 * What this channel normally does, as a range rather than a single number. A creator asking
 * "is 5.2% good?" needs to know that half its videos land between 3.8% and 6.1% — one median
 * makes every video look either above or below average, which is true and useless.
 */
export function band(values: Array<number | null>): Band {
  const sorted = values.filter((value): value is number => value != null).sort((a, b) => a - b);
  if (sorted.length < 4) return null;
  return { low: quantile(sorted, 0.25), median: quantile(sorted, 0.5), high: quantile(sorted, 0.75) };
}

/**
 * Two of the three criteria are not in the feed payload: who still owes a reply lives in the
 * reply queue, and what is under test lives in the ledger. Both builds ask the same three
 * questions, so they ask them from here rather than each keeping its own copy.
 */
export function useFeedFilters(posts: FeedPost[] | null | undefined, round: number) {
  const replies = useAsync(() => api.replies(), [round]);
  const ledger = useAsync(() => api.ledger(), [round]);

  const owesReply = useMemo(
    () => new Set((replies.data?.queue ?? []).map((comment) => comment.ytVideoId)),
    [replies.data],
  );

  const underTest = useMemo(
    () =>
      new Set(
        (ledger.data?.openExperiments ?? [])
          .map((experiment) => experiment.video?.ytVideoId)
          .filter((id): id is string => id != null),
      ),
    [ledger.data],
  );

  const benchmark = useMemo(
    () => ({
      // "good" is what this channel usually does, not a number from a blog post
      ctrPct: band((posts ?? []).map((post) => post.ctrPct)),
      avgViewPct: band((posts ?? []).map((post) => post.avgViewPct)),
    }),
    [posts],
  );

  const matches = useCallback(
    (post: FeedPost, filters: Set<FilterKey>) => {
      if (filters.has('unanswered') && !owesReply.has(post.ytVideoId)) return false;
      if (filters.has('running') && !underTest.has(post.ytVideoId)) return false;
      if (filters.has('aboveMedian')) {
        return post.ctrPct != null && benchmark.ctrPct != null && post.ctrPct >= benchmark.ctrPct.median;
      }
      return true;
    },
    [owesReply, underTest, benchmark.ctrPct],
  );

  return { benchmark, matches };
}
