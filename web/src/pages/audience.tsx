import { useState } from 'react';
import { Chips, Empty, Failed, List, Loading, SectionTitle } from '@/components/shell';
import { SegmentBadge } from '@/pages/feed';
import { ReplyQueue } from '@/components/reply-queue';
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
  const { t } = useI18n();
  const f = useFormat();
  const [tier, setTier] = useState<Tier>('all');
  const [round, setRound] = useState(0);
  const [limit, setLimit] = useState(40);
  const { data, loading, error } = useAsync(
    () => api.audience(tier === 'all' ? null : tier, limit),
    [tier, limit, round],
  );

  if (loading) return <Loading rows={3} />;
  if (error || !data) return <Failed onRetry={() => setRound((n) => n + 1)} />;

  const counts = data.segmentCounts;
  const total = TIERS.reduce((sum, key) => sum + (counts[key] ?? 0), 0);

  const shownTotal = tier === 'all' ? total : (counts[tier] ?? 0);

  const options = [
    { key: 'all', label: t('filter.all'), count: total },
    ...TIERS.map((key) => ({ key, label: t(`filter.${key}`), count: counts[key] ?? 0 })),
  ];

  return (
    <>
      <Chips
        options={options}
        value={tier}
        onChange={(key) => {
          setTier(key as Tier);
          setLimit(40);
        }}
      />
      <p className="text-muted-foreground mb-6 text-sm">{t(`tier.hint.${tier}`)}</p>

      <SectionTitle>{t('section.fans')}</SectionTitle>
      {data.superfans.length ? (
        <List>
          {data.superfans.map((fan) => (
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

      {shownTotal > data.superfans.length && (
        <button
          onClick={() => setLimit((n) => n + 40)}
          className={cn(
            focusRing,
            'text-muted-foreground hover:text-foreground w-full rounded-md py-4 text-sm font-medium',
          )}
        >
          {t('queue.more', { n: String(shownTotal - data.superfans.length) })}
        </button>
      )}

      <SectionTitle>{t('section.queue')}</SectionTitle>
      <ReplyQueue segment={tier === 'all' ? null : tier} />
    </>
  );
}
