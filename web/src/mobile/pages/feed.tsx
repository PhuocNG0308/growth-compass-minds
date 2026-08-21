import { useState } from 'react';
import { MessageCircle, Sparkles } from 'lucide-react';
import { Sparkline, Thumb } from '@/components/thumb';
import { SegmentBadge } from '@/pages/feed';
import { Empty, Failed, Pills, Sheet, Skeletons, Strip, StripItem } from '@/mobile/kit';
import { api } from '@/lib/api';
import { useFormat } from '@/lib/format';
import { useI18n } from '@/lib/i18n';
import { useAsync } from '@/lib/use-async';
import { cn, focusRing } from '@/lib/utils';
import type { FeedPost, PostComment } from '@/lib/types';

const RANGES = [
  ['all', null],
  ['month', 30],
  ['quarter', 90],
] as const;

export function MobileFeed() {
  const { t } = useI18n();
  const [range, setRange] = useState<(typeof RANGES)[number][0]>('all');
  const [round, setRound] = useState(0);
  const { data, loading, error } = useAsync(() => api.feed(), [round]);

  if (loading) return <Skeletons />;
  if (error) return <Failed onRetry={() => setRound((n) => n + 1)} />;
  if (!data?.length) return <Empty>{t('empty.videos')}</Empty>;

  const cutoff = RANGES.find(([key]) => key === range)![1];
  const posts = cutoff
    ? data.filter((post) => Date.now() - new Date(post.publishedAt).getTime() < cutoff * 86_400_000)
    : data;

  const benchmark = {
    ctrPct: median(data.map((post) => post.ctrPct)),
    avgViewPct: median(data.map((post) => post.avgViewPct)),
  };

  return (
    <>
      <Strip snap="none" className="pb-3">
        {RANGES.map(([key]) => (
          <StripItem key={key}>
            <button
              onClick={() => setRange(key)}
              aria-pressed={key === range}
              className={cn(
                focusRing,
                'min-h-11 rounded-full border px-4 text-sm font-medium',
                key === range
                  ? 'border-primary bg-primary/12 text-primary'
                  : 'text-muted-foreground',
              )}
            >
              {t(`range.${key}`)}
            </button>
          </StripItem>
        ))}
      </Strip>

      {posts.length ? (
        <div className="space-y-3 px-4">
          {posts.map((post) => (
            <Card key={post.ytVideoId} post={post} benchmark={benchmark} />
          ))}
        </div>
      ) : (
        <Empty>{t('empty.range')}</Empty>
      )}
    </>
  );
}

/**
 * One tappable object. The desktop card carries a two-button row, a comment preview and two
 * benchmark badges; on a phone the whole card is the target, the numbers become one
 * flickable line, and the conversation waits behind a sheet.
 */
function Card({
  post,
  benchmark,
}: {
  post: FeedPost;
  benchmark: { ctrPct: number | null; avgViewPct: number | null };
}) {
  const { t } = useI18n();
  const f = useFormat();
  const [comments, setComments] = useState(false);

  const go = (ask = false) => {
    location.hash = `#/post/${encodeURIComponent(post.ytVideoId)}${ask ? '/ask' : ''}`;
  };

  return (
    <article className="bg-card overflow-hidden rounded-2xl border">
      <button
        onClick={() => go()}
        className={cn(focusRing, 'block w-full text-left')}
        aria-label={post.title}
      >
        <Thumb
          url={post.thumbnailUrl}
          title={post.title}
          duration={post.durationS == null ? undefined : f.clock(post.durationS)}
          className="rounded-none"
        />
        <div className="px-4 pt-3">
          <h3 className="line-clamp-2 leading-snug font-medium">{post.title}</h3>
          <p className="text-muted-foreground mt-1 text-xs">{f.since(post.publishedAt)}</p>
        </div>
      </button>

      <div className="mt-3">
        <Pills
          items={[
            { label: t('metric.views'), value: f.int(post.views) },
            {
              label: t('metric.ctrPct'),
              value: f.pct(post.ctrPct, 1),
              tone: tone(post.ctrPct, benchmark.ctrPct),
            },
            {
              label: t('metric.avgViewPct'),
              value: f.pct(post.avgViewPct),
              tone: tone(post.avgViewPct, benchmark.avgViewPct),
            },
          ]}
        />
      </div>

      {post.trajectory.length > 2 && (
        <div className="mt-4 flex items-center gap-3 px-4">
          {/* a bare curve between numbers and buttons reads as decoration, so it is named.
              It is deliberately *not* labelled "still climbing": snapshots are sampled at
              6h, 24h … 1008h, so a window over the last few points spans most of the
              video's life and any slope read off it would be wrong. */}
          <span className="text-muted-foreground shrink-0 text-xs">{t('feed.curve')}</span>
          <span className="min-w-0 flex-1">
            <Sparkline points={post.trajectory} />
          </span>
        </div>
      )}

      <div className="mt-3 grid grid-cols-2 border-t">
        <button
          onClick={() => setComments(true)}
          disabled={post.commentCount === 0}
          className={cn(
            focusRing,
            'text-muted-foreground flex min-h-12 items-center justify-center gap-2 text-sm font-medium disabled:opacity-40',
          )}
        >
          <MessageCircle className="size-4" />
          {post.commentCount}
        </button>
        <button
          onClick={() => go(true)}
          className={cn(
            focusRing,
            'text-primary flex min-h-12 items-center justify-center gap-2 border-l text-sm font-medium',
          )}
        >
          <Sparkles className="size-4" />
          {t('feed.ask')}
        </button>
      </div>

      <Sheet open={comments} onOpenChange={setComments} title={post.title}>
        <div className="divide-y">
          {post.topComments.map((comment) => (
            <CommentRow key={comment.ytCommentId} comment={comment} />
          ))}
        </div>
        <button
          onClick={() => go()}
          className={cn(focusRing, 'text-primary min-h-12 w-full px-4 text-sm font-medium')}
        >
          {t('feed.moreComments', { n: Math.max(post.commentCount - post.topComments.length, 0) })}
        </button>
      </Sheet>
    </article>
  );
}

function CommentRow({ comment }: { comment: PostComment }) {
  const f = useFormat();

  return (
    <a
      href={`#/viewer/${encodeURIComponent(comment.ytAuthorId)}`}
      className={cn(focusRing, 'block px-4 py-4')}
    >
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-sm font-semibold">{comment.displayName}</span>
        <SegmentBadge segment={comment.segment} />
        <span className="text-muted-foreground ml-auto text-xs">{f.since(comment.publishedAt)}</span>
      </div>
      <p className="mt-1 text-[15px] leading-relaxed">{comment.text}</p>
    </a>
  );
}

const tone = (value: number | null, benchmark: number | null) =>
  value == null || benchmark == null
    ? undefined
    : value >= benchmark
      ? 'text-primary'
      : 'text-destructive';

function median(values: Array<number | null>): number | null {
  const sorted = values.filter((value): value is number => value != null).sort((a, b) => a - b);
  if (sorted.length === 0) return null;
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[middle]! : (sorted[middle - 1]! + sorted[middle]!) / 2;
}
