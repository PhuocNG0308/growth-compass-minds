import { useMemo, useState } from 'react';
import {
  Archive,
  ArchiveRestore,
  Check,
  ListFilter,
  MessageSquare,
  MoreVertical,
  Search,
  Sparkles,
} from 'lucide-react';
import { Thumb } from '@/components/thumb';
import { Empty, Failed, Sheet, Skeletons, Strip, StripItem } from '@/mobile/kit';
import { api } from '@/lib/api';
import { useArchive } from '@/lib/archive';
import { FILTERS, useFeedFilters, type FilterKey } from '@/lib/feed-filters';
import { useFormat } from '@/lib/format';
import { useI18n } from '@/lib/i18n';
import { useAsync } from '@/lib/use-async';
import { cn, focusRing } from '@/lib/utils';
import type { FeedPost } from '@/lib/types';

type Tab = 'active' | 'hidden' | 'all';

const TABS: Array<[Tab, string]> = [
  ['active', 'feed.tabActive'],
  ['hidden', 'feed.tabHidden'],
  ['all', 'feed.tabAll'],
];

/**
 * The same catalogue as the desktop table, in the shape a thumb can walk: one row per video,
 * the three numbers that decide whether to open it, and everything else behind a sheet.
 */
export function MobileFeed() {
  const { t } = useI18n();
  const [tab, setTab] = useState<Tab>('active');
  const [query, setQuery] = useState('');
  const [filters, setFilters] = useState<Set<FilterKey>>(new Set());
  const [sheet, setSheet] = useState(false);
  const [round, setRound] = useState(0);
  const [chosen, setChosen] = useState<FeedPost | null>(null);
  const { data, loading, error } = useAsync(() => api.feed(), [round]);
  const archive = useArchive();
  const { matches } = useFeedFilters(data, round);

  const posts = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return (data ?? []).filter((post) => {
      const hidden = archive.ids.includes(post.ytVideoId);
      if (tab === 'active' && hidden) return false;
      if (tab === 'hidden' && !hidden) return false;
      if (needle && !post.title.toLowerCase().includes(needle)) return false;
      return matches(post, filters);
    });
  }, [data, tab, query, filters, archive.ids, matches]);

  if (loading) return <Skeletons />;
  if (error) return <Failed onRetry={() => setRound((n) => n + 1)} />;
  if (!data?.length) return <Empty>{t('empty.videos')}</Empty>;

  return (
    <>
      <div className="flex items-center gap-2 px-4 pb-3">
        <div className="relative min-w-0 flex-1">
          <Search className="text-muted-foreground pointer-events-none absolute top-3 left-4 size-4" />
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder={t('feed.search')}
            aria-label={t('feed.search')}
            className={cn(focusRing, 'h-11 w-full rounded-full border pr-4 pl-11 text-sm')}
          />
        </div>

        <button
          onClick={() => setSheet(true)}
          aria-label={t('feed.filter')}
          className={cn(
            focusRing,
            'relative grid size-11 shrink-0 place-items-center rounded-full border',
            filters.size > 0 && 'bg-foreground text-background border-transparent',
          )}
        >
          <ListFilter className="size-5" />
        </button>
      </div>

      <Strip snap="none" className="pb-3">
        {TABS.map(([key, label]) => (
          <StripItem key={key}>
            <button
              onClick={() => setTab(key)}
              aria-pressed={tab === key}
              className={cn(
                focusRing,
                'min-h-11 rounded-full border px-4 text-sm font-medium',
                tab === key ? 'bg-foreground text-background' : 'text-muted-foreground',
              )}
            >
              {t(label)}
            </button>
          </StripItem>
        ))}
      </Strip>

      {posts.length === 0 ? (
        <Empty>
          {t(tab === 'hidden' && !query && filters.size === 0 ? 'empty.hidden' : 'empty.filtered')}
        </Empty>
      ) : (
        <div className="divide-y border-y">
          {posts.map((post) => (
            <Row key={post.ytVideoId} post={post} onMenu={() => setChosen(post)} />
          ))}
        </div>
      )}

      <Actions post={chosen} archive={archive} onClose={() => setChosen(null)} />

      <Sheet open={sheet} onOpenChange={setSheet} title={t('feed.filter')}>
        <div className="px-3 pt-2 pb-6">
          {FILTERS.map((key) => {
            const on = filters.has(key);
            return (
              <button
                key={key}
                onClick={() =>
                  setFilters((current) => {
                    const next = new Set(current);
                    if (!next.delete(key)) next.add(key);
                    return next;
                  })
                }
                aria-pressed={on}
                className={cn(
                  focusRing,
                  'flex min-h-14 w-full items-center gap-3 rounded-xl px-4 text-left text-sm font-medium',
                )}
              >
                <span
                  className={cn(
                    'grid size-5 shrink-0 place-items-center rounded-sm border',
                    on && 'bg-foreground text-background border-transparent',
                  )}
                >
                  {on && <Check className="size-3" />}
                </span>
                {t(`filter.${key}`)}
              </button>
            );
          })}

          {filters.size > 0 && (
            <button
              onClick={() => setFilters(new Set())}
              className={cn(
                focusRing,
                'text-muted-foreground mt-2 flex min-h-12 w-full items-center justify-center rounded-full border text-sm font-medium',
              )}
            >
              {t('feed.clearSearch')}
            </button>
          )}
        </div>
      </Sheet>
    </>
  );
}

function Row({ post, onMenu }: { post: FeedPost; onMenu: () => void }) {
  const { t } = useI18n();
  const f = useFormat();

  return (
    <div className="flex items-center gap-3 px-4 py-3">
      <a
        href={`#/post/${encodeURIComponent(post.ytVideoId)}`}
        className={cn(focusRing, 'min-w-0 flex-1 rounded-md')}
      >
        <div className="flex items-center gap-3">
          <Thumb
            url={post.thumbnailUrl}
            title={post.title}
            duration={post.durationS == null ? undefined : f.clock(post.durationS)}
            className="w-24 shrink-0"
          />
          <div className="min-w-0 flex-1">
            <p className="line-clamp-2 text-[13px] leading-snug font-medium">{post.title}</p>
            <p className="text-muted-foreground mt-1 truncate text-[11px]">
              <span className="tabular">{f.int(post.views)}</span> {t('metric.views')}
              {' · '}
              <span className="tabular">{f.pct(post.ctrPct, 1)}</span> {t('metric.ctrPct')}
              {' · '}
              {f.since(post.publishedAt)}
            </p>
          </div>
        </div>
      </a>

      <button
        onClick={onMenu}
        aria-label={t('feed.actions', { title: post.title })}
        className={cn(focusRing, 'text-muted-foreground grid size-11 shrink-0 place-items-center rounded-full')}
      >
        <MoreVertical className="size-5" />
      </button>
    </div>
  );
}

function Actions({
  post,
  archive,
  onClose,
}: {
  post: FeedPost | null;
  archive: ReturnType<typeof useArchive>;
  onClose: () => void;
}) {
  const { t } = useI18n();
  if (!post) return null;

  const href = `#/post/${encodeURIComponent(post.ytVideoId)}`;
  const hidden = archive.has(post.ytVideoId);
  const row = cn(
    focusRing,
    'hover:bg-secondary flex min-h-12 w-full items-center gap-3 rounded-xl px-4 text-sm font-medium',
  );

  return (
    <Sheet open onOpenChange={(open) => !open && onClose()} title={post.title}>
      <div className="space-y-1 px-3 pt-2 pb-6">
        <a href={`${href}/ask`} onClick={onClose} className={row}>
          <Sparkles className="size-4" />
          {t('feed.ask')}
        </a>
        <a href={href} onClick={onClose} className={row}>
          <MessageSquare className="size-4" />
          {t('feed.comments')}
          <span className="tabular text-muted-foreground ml-auto">{post.commentCount}</span>
        </a>
        <button
          onClick={() => {
            archive.toggle(post.ytVideoId);
            onClose();
          }}
          className={row}
        >
          {hidden ? <ArchiveRestore className="size-4" /> : <Archive className="size-4" />}
          {t(hidden ? 'feed.unhide' : 'feed.hide')}
        </button>
      </div>
    </Sheet>
  );
}
