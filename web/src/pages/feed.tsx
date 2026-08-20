import { useState } from 'react';
import { MessageCircle, Sparkles } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import { Chips, Empty, Loading } from '@/components/shell';
import { Thumb } from '@/components/thumb';
import { api } from '@/lib/api';
import { useFormat } from '@/lib/format';
import { useI18n } from '@/lib/i18n';
import { useAsync } from '@/lib/use-async';
import { cn, focusRing } from '@/lib/utils';
import type { FeedPost, PostComment, Segment } from '@/lib/types';

const RANGES = [
  ['all', 0],
  ['month', 30],
  ['quarter', 90],
] as const;

export function Feed() {
  const { t } = useI18n();
  const [range, setRange] = useState<(typeof RANGES)[number][0]>('all');
  const { data, loading, error } = useAsync(() => api.feed(), []);

  if (loading) return <Loading />;
  if (error) return <Empty>{t('state.error')}</Empty>;
  if (!data?.length) return <Empty>{t('empty.videos')}</Empty>;

  const cutoff = RANGES.find(([key]) => key === range)![1];
  const posts = cutoff
    ? data.filter((post) => Date.now() - new Date(post.publishedAt).getTime() < cutoff * 86_400_000)
    : data;

  return (
    <>
      <Chips
        options={RANGES.map(([key]) => ({ key, label: t(`range.${key}`) }))}
        value={range}
        onChange={(key) => setRange(key as typeof range)}
      />

      <div className="space-y-5">
        {posts.length ? (
          posts.map((post) => <PostCard key={post.ytVideoId} post={post} />)
        ) : (
          <Empty>{t('empty.range')}</Empty>
        )}
      </div>
    </>
  );
}

/** Laid out the way a social post reads: header, media, reaction summary, a couple of replies. */
function PostCard({ post }: { post: FeedPost }) {
  const { t } = useI18n();
  const f = useFormat();
  const open = () => {
    location.hash = `#/post/${encodeURIComponent(post.ytVideoId)}`;
  };

  const hidden = post.commentCount - post.topComments.length;

  return (
    <Card className="gap-0 overflow-hidden rounded-2xl py-0">
      <button onClick={open} className={cn(focusRing, 'w-full px-4 pt-4 pb-3 text-left @md:px-5')}>
        <p className="text-lg leading-snug font-semibold @md:text-xl">{post.title}</p>
        <p className="text-muted-foreground mt-1 text-sm">{f.since(post.publishedAt)}</p>
      </button>

      <button onClick={open} className={cn(focusRing, 'block w-full')}>
        <Thumb
          url={post.thumbnailUrl}
          title={post.title}
          duration={post.durationS == null ? undefined : f.clock(post.durationS)}
          className="rounded-none"
        />
      </button>

      <div className="flex flex-wrap items-center justify-between gap-3 px-4 py-3 @md:px-5">
        <span className="text-muted-foreground text-sm">
          <b className="tabular text-foreground">{f.int(post.views)}</b> {t('metric.views')}
          {post.commentCount > 0 && (
            <>
              {' · '}
              <b className="tabular text-foreground">{post.commentCount}</b> {t('metric.comments')}
            </>
          )}
        </span>

        <span className="flex gap-2">
          <Badge variant="secondary" className={cn('text-xs', rank(post.ctrPct, 5))}>
            {t('metric.ctrPct')} {f.pct(post.ctrPct, 1)}
          </Badge>
          <Badge variant="secondary" className={cn('text-xs', rank(post.avgViewPct, 40))}>
            {t('metric.avgViewPct')} {f.pct(post.avgViewPct)}
          </Badge>
        </span>
      </div>

      <div className="grid grid-cols-2 border-t">
        <button
          onClick={open}
          className={cn(focusRing, 'text-muted-foreground hover:bg-accent hover:text-foreground flex items-center justify-center gap-2 py-3 text-sm font-medium')}
        >
          <MessageCircle className="size-4" />
          {t('feed.comments')}
        </button>
        <button
          onClick={open}
          className={cn(focusRing, 'text-primary hover:bg-accent flex items-center justify-center gap-2 border-l py-3 text-sm font-medium')}
        >
          <Sparkles className="size-4" />
          {t('feed.ask')}
        </button>
      </div>

      {post.topComments.length > 0 && (
        <div className="bg-muted/40 border-t">
          {post.topComments.map((comment) => (
            <CommentLine key={comment.ytCommentId} comment={comment} compact />
          ))}
          {hidden > 0 && (
            <button
              onClick={open}
              className={cn(focusRing, 'text-muted-foreground hover:text-primary w-full px-4 pb-4 text-left text-sm font-medium @md:px-5')}
            >
              {t('feed.moreComments', { n: hidden })}
            </button>
          )}
        </div>
      )}
    </Card>
  );
}

const rank = (value: number | null, benchmark: number) =>
  value == null
    ? 'text-muted-foreground'
    : value >= benchmark
      ? 'bg-primary/15 text-primary'
      : 'bg-destructive/12 text-destructive';

export const SEGMENT_STYLE: Record<string, string> = {
  superfan: 'bg-primary/20 text-primary',
  potential: 'bg-warning/15 text-warning',
  newcomer: 'bg-muted text-muted-foreground',
};

export function SegmentBadge({ segment }: { segment: Segment }) {
  const { t } = useI18n();
  return (
    <Badge variant="secondary" className={cn('text-[11px]', SEGMENT_STYLE[segment])}>
      {t(`segment.${segment}`)}
    </Badge>
  );
}

export function CommentLine({ comment, compact }: { comment: PostComment; compact?: boolean }) {
  const f = useFormat();
  const profile = `#/viewer/${encodeURIComponent(comment.ytAuthorId)}`;

  return (
    <div className={cn('flex gap-3 px-4 @md:px-5', compact ? 'py-3' : 'py-4')}>
      <a
        href={profile}
        className={cn(focusRing, 'bg-background text-muted-foreground hover:text-primary grid size-9 shrink-0 place-items-center rounded-full border text-sm font-semibold')}
      >
        {comment.displayName.trim().charAt(0).toUpperCase()}
      </a>

      <div className="min-w-0 flex-1">
        <div className="bg-background inline-block max-w-full rounded-2xl border px-4 py-3">
          <div className="flex flex-wrap items-center gap-2">
            <a href={profile} className={cn(focusRing, 'hover:text-primary text-sm font-semibold')}>
              {comment.displayName}
            </a>
            <SegmentBadge segment={comment.segment} />
          </div>
          <p className="mt-1 text-[15px] leading-relaxed">{comment.text}</p>
        </div>
        <p className="text-muted-foreground mt-1 px-1 text-xs">{f.since(comment.publishedAt)}</p>
      </div>
    </div>
  );
}
