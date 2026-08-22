import { useCallback, useMemo } from 'react';
import { api } from '@/lib/api';
import { useAsync } from '@/lib/use-async';
import type { FeedPost } from '@/lib/types';

export type FilterKey = 'unanswered' | 'aboveMedian' | 'running';

export const FILTERS: FilterKey[] = ['unanswered', 'aboveMedian', 'running'];

export function median(values: Array<number | null>): number | null {
  const sorted = values.filter((value): value is number => value != null).sort((a, b) => a - b);
  if (sorted.length === 0) return null;
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[middle]! : (sorted[middle - 1]! + sorted[middle]!) / 2;
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
      ctrPct: median((posts ?? []).map((post) => post.ctrPct)),
      avgViewPct: median((posts ?? []).map((post) => post.avgViewPct)),
    }),
    [posts],
  );

  const matches = useCallback(
    (post: FeedPost, filters: Set<FilterKey>) => {
      if (filters.has('unanswered') && !owesReply.has(post.ytVideoId)) return false;
      if (filters.has('running') && !underTest.has(post.ytVideoId)) return false;
      if (filters.has('aboveMedian')) {
        return post.ctrPct != null && benchmark.ctrPct != null && post.ctrPct >= benchmark.ctrPct;
      }
      return true;
    },
    [owesReply, underTest, benchmark.ctrPct],
  );

  return { benchmark, matches };
}
