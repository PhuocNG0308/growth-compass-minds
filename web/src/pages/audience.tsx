import { useState } from 'react';
import { Chips, Empty, List, Loading, SectionTitle } from '@/components/shell';
import { SegmentBadge } from '@/pages/feed';
import { api } from '@/lib/api';
import { useFormat } from '@/lib/format';
import { useI18n } from '@/lib/i18n';
import { cn, focusRing } from '@/lib/utils';
import { useAsync } from '@/lib/use-async';
import type { Segment } from '@/lib/types';

const TIERS = ['superfan', 'potential', 'newcomer'] as const;
type Tier = 'all' | Segment;

const AVATAR = 'grid size-10 shrink-0 place-items-center rounded-full font-semibold';

/** Solid, tinted, flat — the tier reads as fill strength before anyone reads the label. */
const TIER_AVATAR: Record<Segment, string> = {
  superfan: 'bg-primary text-primary-foreground',
  potential: 'bg-warning/15 text-warning',
  newcomer: 'bg-muted text-muted-foreground',
};

export function Audience() {
  const { t, plural } = useI18n();
  const f = useFormat();
  const [tier, setTier] = useState<Tier>('all');
  const { data, loading, error } = useAsync(() => api.audience(), []);

  if (loading) return <Loading />;
  if (error || !data) return <Empty>{t('state.error')}</Empty>;

  const people = new Map<string, Segment>();
  for (const fan of data.superfans) people.set(fan.ytAuthorId, fan.segment);
  for (const comment of data.queue) people.set(comment.ytAuthorId, comment.segment);

  const fans = data.superfans.filter((fan) => tier === 'all' || fan.segment === tier);
  const queue = data.queue.filter((comment) => tier === 'all' || comment.segment === tier);

  const counts = new Map<Segment, number>();
  for (const segment of people.values()) counts.set(segment, (counts.get(segment) ?? 0) + 1);

  const options = [
    { key: 'all', label: t('filter.all'), count: people.size },
    ...TIERS.filter((key) => counts.has(key)).map((key) => ({
      key,
      label: t(`filter.${key}`),
      count: counts.get(key)!,
    })),
  ];

  return (
    <>
      <Chips options={options} value={tier} onChange={(key) => setTier(key as Tier)} />
      <p className="text-muted-foreground mb-6 text-sm">{t(`tier.hint.${tier}`)}</p>

      <SectionTitle>{t('section.fans')}</SectionTitle>
      {fans.length ? (
        <List>
          {fans.map((fan) => (
            <a
              key={fan.ytAuthorId}
              href={`#/viewer/${encodeURIComponent(fan.ytAuthorId)}`}
              className={cn(focusRing, 'hover:bg-accent flex items-center gap-4 p-4')}
            >
              <span className={cn(AVATAR, TIER_AVATAR[fan.segment])}>
                {fan.displayName.trim().charAt(0).toUpperCase()}
              </span>
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="truncate font-medium">{fan.displayName}</span>
                  <SegmentBadge segment={fan.segment} />
                </div>
                <div className="text-muted-foreground mt-1 text-xs">
                  {t('fan.since', { date: f.shortDate(fan.firstSeenAt) })} ·{' '}
                  {t('fan.last', { when: f.since(fan.lastSeenAt) })}
                </div>
              </div>
              <span className="ml-auto shrink-0 text-right">
                <span className="tabular block font-medium">{fan.commentCount}</span>
                <span className="text-muted-foreground text-xs">{t('metric.comments')}</span>
              </span>
            </a>
          ))}
        </List>
      ) : (
        <Empty>{t(tier === 'all' ? 'empty.fans' : 'empty.tierFans')}</Empty>
      )}

      <SectionTitle>{t('section.queue')}</SectionTitle>
      {queue.length ? (
        <List>
          {queue.map((comment) => (
            <a
              key={comment.ytCommentId}
              href={`#/viewer/${encodeURIComponent(comment.ytAuthorId)}`}
              className={cn(focusRing, 'hover:bg-accent flex gap-4 p-4')}
            >
              <span className={cn(AVATAR, TIER_AVATAR[comment.segment])}>
                {comment.displayName.trim().charAt(0).toUpperCase()}
              </span>
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="truncate font-semibold">{comment.displayName}</span>
                  <SegmentBadge segment={comment.segment} />
                  <span className="text-muted-foreground text-xs">
                    {plural('fan.comments', comment.viewerCommentCount)}
                  </span>
                </div>
                <p className="mt-1 max-w-[68ch] text-[15px] leading-relaxed">{comment.text}</p>
                <div className="text-muted-foreground mt-2 text-xs">
                  {t('fan.on', { title: comment.videoTitle })} · {f.shortDate(comment.publishedAt)}
                </div>
              </div>
            </a>
          ))}
        </List>
      ) : (
        <Empty>{t(tier === 'all' ? 'empty.queue' : 'empty.tierQueue')}</Empty>
      )}
    </>
  );
}
