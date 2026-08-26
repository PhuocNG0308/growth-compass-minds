import { useMemo, useState } from 'react';
import { DropdownMenu } from 'radix-ui';
import {
  Archive,
  ArchiveRestore,
  Check,
  ChevronDown,
  ChevronUp,
  CornerDownRight,
  ExternalLink,
  ListFilter,
  MoveDown,
  MoveUp,
  RefreshCw,
  Search,
  Sparkles,
  X,
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { LiveStrip } from '@/components/live-strip';
import { Empty, Failed, Loading, Modelled, useSync } from '@/components/shell';
import { useToast } from '@/components/toast';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Thumb } from '@/components/thumb';
import { api } from '@/lib/api';
import { useArchive } from '@/lib/archive';
import { FILTERS, useFeedFilters, type Band, type FilterKey } from '@/lib/feed-filters';
import { DASH, useFormat } from '@/lib/format';
import { useI18n } from '@/lib/i18n';
import { useAsync } from '@/lib/use-async';
import { cn, focusRing } from '@/lib/utils';
import type { FeedPost, PostComment, Segment } from '@/lib/types';

type Tab = 'active' | 'hidden' | 'all';
type SortField = 'publishedAt' | 'views' | 'ctrPct' | 'avgViewPct' | 'commentCount';

const TABS: Array<[Tab, string]> = [
  ['active', 'feed.tabActive'],
  ['hidden', 'feed.tabHidden'],
  ['all', 'feed.tabAll'],
];

const COLUMNS: Array<{ field: SortField; key: string; align: string; modelled?: boolean }> = [
  { field: 'publishedAt', key: 'col.date', align: 'text-left' },
  { field: 'views', key: 'col.views', align: 'text-right' },
  // the two YouTube hands to the channel owner and to nobody else
  { field: 'ctrPct', key: 'col.ctr', align: 'text-right', modelled: true },
  { field: 'avgViewPct', key: 'col.avgView', align: 'text-right', modelled: true },
  { field: 'commentCount', key: 'col.comments', align: 'text-right' },
];

const sortValue = (post: FeedPost, field: SortField) =>
  field === 'publishedAt' ? new Date(post.publishedAt).getTime() : (post[field] ?? -Infinity);

/**
 * The catalogue, as a table. A creator opening this is scanning for the video that moved,
 * so every row is one line of numbers that line up down the page; the thumbnail is an
 * identifier rather than an image to look at, and the per-video actions stay out of the way
 * until the pointer is on the row.
 */
export function Feed({ demo }: { demo: boolean }) {
  const { t, plural } = useI18n();
  const notify = useToast();
  const [tab, setTab] = useState<Tab>('active');
  const [query, setQuery] = useState('');
  const [sort, setSort] = useState<{ field: SortField; asc: boolean }>({
    field: 'publishedAt',
    asc: false,
  });
  const [filters, setFilters] = useState<Set<FilterKey>>(new Set());
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [round, setRound] = useState(0);
  const { data, loading, error } = useAsync(() => api.feed(), [round]);
  const archive = useArchive();
  const { sync, syncing } = useSync();

  const { benchmark, matches } = useFeedFilters(data, round);

  const rows = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return (data ?? [])
      .filter((post) => {
        const hidden = archive.ids.includes(post.ytVideoId);
        if (tab === 'active' && hidden) return false;
        if (tab === 'hidden' && !hidden) return false;
        if (needle && !post.title.toLowerCase().includes(needle)) return false;
        return matches(post, filters);
      })
      .sort((a, b) => {
        const delta = sortValue(a, sort.field) - sortValue(b, sort.field);
        return sort.asc ? delta : -delta;
      });
  }, [data, tab, query, sort, filters, archive.ids, matches]);

  if (loading) return <Loading rows={6} height="h-20" />;
  if (error) return <Failed onRetry={() => setRound((n) => n + 1)} />;
  if (!data?.length) {
    return (
      <Empty
        action={
          <Button variant="outline" size="sm" onClick={sync} disabled={syncing}>
            <RefreshCw className={cn(syncing && 'animate-spin')} />
            {t(syncing ? 'shell.syncing' : 'shell.sync')}
          </Button>
        }
      >
        {t('empty.videos')}
      </Empty>
    );
  }

  const counts: Record<Tab, number> = {
    active: data.filter((post) => !archive.ids.includes(post.ytVideoId)).length,
    hidden: data.filter((post) => archive.ids.includes(post.ytVideoId)).length,
    all: data.length,
  };

  // a selection that survives a change of tab would act on rows nobody can see
  const reset = <T,>(apply: (value: T) => void) => (value: T) => {
    apply(value);
    setSelected(new Set());
  };

  // undoing a bulk hide by hiding the same ids again would also unhide whatever the creator
  // had already put away, so the whole list is what gets put back
  const undoably = (hidden: boolean, n: number, apply: () => void) => {
    const snapshot = archive.ids;
    apply();
    notify(plural(hidden ? 'feed.didHide' : 'feed.didUnhide', n), 'ok', () =>
      archive.restore(snapshot),
    );
  };

  const bulk = (hide: boolean) => {
    const targets = [...selected];
    setSelected(new Set());
    undoably(hide, targets.length, () => archive.setMany(targets, hide));
  };

  const visibleIds = rows.map((post) => post.ytVideoId);
  const allPicked = rows.length > 0 && visibleIds.every((id) => selected.has(id));

  return (
    <>
      <LiveStrip />

      {selected.size > 0 ? (
        // swapping the whole toolbar out is silent to a screen reader unless the count speaks
        <div role="status" className="mb-4 flex h-10 flex-wrap items-center gap-3">
          <span className="text-sm font-medium">{t('feed.selected', { n: selected.size })}</span>
          <Button size="sm" variant="outline" onClick={() => bulk(true)}>
            <Archive />
            {t('feed.hide')}
          </Button>
          <Button size="sm" variant="outline" onClick={() => bulk(false)}>
            <ArchiveRestore />
            {t('feed.unhide')}
          </Button>
          <Button size="sm" variant="ghost" onClick={() => setSelected(new Set())}>
            {t('feed.clearSelection')}
          </Button>
        </div>
      ) : (
      <div className="mb-4 flex flex-wrap items-center justify-between gap-4">
        <div className="flex gap-2">
          {TABS.map(([key, label]) => (
            <button
              key={key}
              onClick={() => reset(setTab)(key)}
              aria-pressed={tab === key}
              className={cn(
                focusRing,
                'rounded-full px-4 py-2 text-sm font-medium transition-colors',
                tab === key
                  ? 'bg-foreground text-background'
                  : 'bg-secondary text-foreground hover:bg-input',
              )}
            >
              {t(label)}
              <span className="tabular ml-2 opacity-70">{counts[key]}</span>
            </button>
          ))}
        </div>

        <div className="flex items-center gap-3">
          <div className="relative w-64">
            <Search className="text-muted-foreground pointer-events-none absolute top-3 left-3 size-4" />
            <input
              value={query}
              onChange={(event) => reset(setQuery)(event.target.value)}
              placeholder={t('feed.search')}
              aria-label={t('feed.search')}
              className={cn(focusRing, 'h-10 w-full rounded-full border pr-4 pl-10 text-sm')}
            />
          </div>

          <FilterMenu value={filters} onChange={reset(setFilters)} />
        </div>
      </div>
      )}

      {filters.size > 0 && selected.size === 0 && (
        <ActiveFilters value={filters} onChange={reset(setFilters)} />
      )}

      {rows.length === 0 ? (
        <Empty>
          <p>{t(tab === 'hidden' && !query && filters.size === 0 ? 'empty.hidden' : 'empty.filtered')}</p>
          {(query || filters.size > 0) && (
            <Button
              variant="outline"
              size="sm"
              className="mt-4"
              onClick={() => {
                setQuery('');
                setFilters(new Set());
              }}
            >
              {t('feed.clearSearch')}
            </Button>
          )}
        </Empty>
      ) : (
        <Table className="table-fixed">
          <TableHeader>
            <TableRow className="hover:bg-transparent">
              <TableHead className="w-12">
                <Tick
                  checked={allPicked}
                  mixed={!allPicked && visibleIds.some((id) => selected.has(id))}
                  label={t('feed.selectAll')}
                  onChange={() => setSelected(allPicked ? new Set() : new Set(visibleIds))}
                />
              </TableHead>
              <TableHead className="w-2/5">{t('col.video')}</TableHead>
              {COLUMNS.map((column) => (
                <SortHead
                  key={column.field}
                  column={column}
                  sort={sort}
                  onSort={setSort}
                  modelled={demo && column.modelled === true}
                />
              ))}
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((post) => (
              <Row
                key={post.ytVideoId}
                post={post}
                benchmark={benchmark}
                hidden={archive.has(post.ytVideoId)}
                onArchive={() =>
                  undoably(!archive.has(post.ytVideoId), 1, () => archive.toggle(post.ytVideoId))
                }
                picked={selected.has(post.ytVideoId)}
                onPick={() =>
                  setSelected((current) => {
                    const next = new Set(current);
                    if (!next.delete(post.ytVideoId)) next.add(post.ytVideoId);
                    return next;
                  })
                }
              />
            ))}
          </TableBody>
        </Table>
      )}
    </>
  );
}

/** A native checkbox is already keyboard- and screen-reader-correct; it only needs a skin. */
function Tick({
  checked,
  mixed,
  label,
  onChange,
}: {
  checked: boolean;
  mixed?: boolean;
  label: string;
  onChange: () => void;
}) {
  return (
    <input
      type="checkbox"
      checked={checked}
      onChange={onChange}
      aria-label={label}
      title={label}
      // indeterminate is a property, never an attribute, so it cannot be set in JSX
      ref={(node) => {
        if (node) node.indeterminate = Boolean(mixed);
      }}
      className={cn(focusRing, 'accent-foreground size-4 cursor-pointer align-middle')}
    />
  );
}

function FilterMenu({
  value,
  onChange,
}: {
  value: Set<FilterKey>;
  onChange: (next: Set<FilterKey>) => void;
}) {
  const { t } = useI18n();

  return (
    <DropdownMenu.Root>
      <DropdownMenu.Trigger asChild>
        <Button variant="outline" className="h-10">
          <ListFilter />
          {t('feed.filter')}
          {value.size > 0 && (
            <span className="bg-foreground text-background tabular grid size-5 place-items-center rounded-full text-xs">
              {value.size}
            </span>
          )}
        </Button>
      </DropdownMenu.Trigger>

      <DropdownMenu.Portal>
        <DropdownMenu.Content
          align="end"
          sideOffset={8}
          className="bg-popover z-50 min-w-72 rounded-xl border p-2 shadow-md"
        >
          {FILTERS.map((key) => (
            <DropdownMenu.CheckboxItem
              key={key}
              checked={value.has(key)}
              // without this the menu closes on every tick, so combining two costs two trips
              onSelect={(event) => event.preventDefault()}
              onCheckedChange={(on) => {
                const next = new Set(value);
                if (on) next.add(key);
                else next.delete(key);
                onChange(next);
              }}
              className={cn(
                focusRing,
                'flex cursor-pointer items-center gap-3 rounded-lg px-3 py-2 text-sm outline-none data-highlighted:bg-accent',
              )}
            >
              <span className="border-input grid size-4 shrink-0 place-items-center rounded-sm border">
                <DropdownMenu.ItemIndicator>
                  <Check className="size-3" />
                </DropdownMenu.ItemIndicator>
              </span>
              {t(`filter.${key}`)}
            </DropdownMenu.CheckboxItem>
          ))}
        </DropdownMenu.Content>
      </DropdownMenu.Portal>
    </DropdownMenu.Root>
  );
}

/** The filter button shows a count, not which filters. Each chip names one and removes it. */
function ActiveFilters({
  value,
  onChange,
}: {
  value: Set<FilterKey>;
  onChange: (next: Set<FilterKey>) => void;
}) {
  const { t } = useI18n();

  const without = (key: FilterKey) => {
    const next = new Set(value);
    next.delete(key);
    return next;
  };

  return (
    <div className="mb-4 flex flex-wrap items-center gap-2">
      {FILTERS.filter((key) => value.has(key)).map((key) => (
        <button
          key={key}
          onClick={() => onChange(without(key))}
          aria-label={t('feed.removeFilter', { name: t(`filter.${key}`) })}
          className={cn(
            focusRing,
            'bg-secondary hover:bg-input flex h-8 items-center gap-2 rounded-full pr-2 pl-3 text-xs font-medium',
          )}
        >
          {t(`filter.${key}`)}
          <X className="size-3" />
        </button>
      ))}

      <Button variant="ghost" size="sm" onClick={() => onChange(new Set())}>
        {t('feed.clearFilters')}
      </Button>
    </div>
  );
}

function SortHead({
  column,
  sort,
  onSort,
  modelled,
}: {
  column: (typeof COLUMNS)[number];
  sort: { field: SortField; asc: boolean };
  onSort: (next: { field: SortField; asc: boolean }) => void;
  modelled: boolean;
}) {
  const { t } = useI18n();
  const active = sort.field === column.field;
  const Arrow = active && sort.asc ? ChevronUp : ChevronDown;

  return (
    <TableHead
      aria-sort={active ? (sort.asc ? 'ascending' : 'descending') : 'none'}
      className={column.align}
    >
      <button
        onClick={() => onSort({ field: column.field, asc: active ? !sort.asc : false })}
        title={t('feed.sortBy', { col: t(column.key) })}
        className={cn(
          focusRing,
          'hover:text-foreground inline-flex items-center gap-1 rounded-md',
          active && 'text-foreground',
        )}
      >
        {modelled ? <Modelled>{t(column.key)}</Modelled> : t(column.key)}
        <Arrow className={cn('size-3', !active && 'opacity-30')} />
      </button>
    </TableHead>
  );
}

function Row({
  post,
  benchmark,
  hidden,
  onArchive,
  picked,
  onPick,
}: {
  post: FeedPost;
  benchmark: { ctrPct: Band; avgViewPct: Band };
  hidden: boolean;
  onArchive: () => void;
  picked: boolean;
  onPick: () => void;
}) {
  const { t } = useI18n();
  const f = useFormat();
  const href = `#/post/${encodeURIComponent(post.ytVideoId)}`;

  return (
    <TableRow className={cn('group', picked && 'bg-accent')}>
      <TableCell className="align-top">
        <Tick checked={picked} label={t('feed.selectRow', { title: post.title })} onChange={onPick} />
      </TableCell>
      <TableCell className="py-3 whitespace-normal">
        <div className="flex gap-4">
          {/* the title link beside it goes to the same place, so this one stays out of the
              tab order rather than costing every row two identical stops */}
          <a href={href} tabIndex={-1} aria-hidden className={cn(focusRing, 'shrink-0')}>
            <Thumb
              url={post.thumbnailUrl}
              title={post.title}
              duration={post.durationS == null ? undefined : f.clock(post.durationS)}
              className="w-24"
            />
          </a>

          <div className="min-w-0 flex-1">
            <a
              href={href}
              title={post.title}
              className={cn(focusRing, 'line-clamp-2 rounded-md font-medium hover:underline')}
            >
              {post.title}
            </a>

            <RowActions post={post} hidden={hidden} onArchive={onArchive} />
          </div>
        </div>
      </TableCell>

      <TableCell className="text-muted-foreground align-top text-xs">
        {f.shortDate(post.publishedAt)}
      </TableCell>
      <TableCell className="tabular align-top text-right font-medium">{f.int(post.views)}</TableCell>
      <TableCell className="align-top text-right">
        <Mark value={post.ctrPct} band={benchmark.ctrPct} format={(v) => f.pct(v, 1)} />
      </TableCell>
      <TableCell className="align-top text-right">
        <Mark value={post.avgViewPct} band={benchmark.avgViewPct} format={(v) => f.pct(v)} />
      </TableCell>
      <TableCell className="tabular text-muted-foreground align-top text-right">
        {post.commentCount}
      </TableCell>
    </TableRow>
  );
}

/**
 * The three things a creator does to a video they have just found in the table. They sit under
 * the title because that is where the pointer already is, and they hold their space whether or
 * not they are showing, so a row never moves under the cursor.
 */
function RowActions({
  post,
  hidden,
  onArchive,
}: {
  post: FeedPost;
  hidden: boolean;
  onArchive: () => void;
}) {
  const { t } = useI18n();
  const href = `#/post/${encodeURIComponent(post.ytVideoId)}`;
  const action = cn(
    focusRing,
    'text-muted-foreground hover:bg-secondary hover:text-foreground grid size-8 place-items-center rounded-full',
  );
  const label = t(hidden ? 'feed.unhide' : 'feed.hide');

  return (
    <div className="pointer-coarse:opacity-100 mt-2 flex gap-1 opacity-0 transition-opacity group-focus-within:opacity-100 group-hover:opacity-100">
      <a href={`${href}/ask`} title={t('feed.ask')} aria-label={t('feed.ask')} className={action}>
        <Sparkles className="size-4" />
      </a>

      <button onClick={onArchive} title={label} aria-label={label} className={action}>
        {hidden ? <ArchiveRestore className="size-4" /> : <Archive className="size-4" />}
      </button>

      <a
        href={`https://youtu.be/${post.ytVideoId}`}
        target="_blank"
        rel="noreferrer"
        title={t('feed.onYouTube')}
        aria-label={t('feed.onYouTube')}
        className={action}
      >
        <ExternalLink className="size-4" />
      </a>
    </div>
  );
}

/**
 * A number is only good or bad next to what this channel usually does, so the arrow says
 * which side of the normal range it fell on and the tooltip names the range itself.
 */
function Mark({
  value,
  band,
  format,
}: {
  value: number | null;
  band: Band;
  format: (value: number) => string;
}) {
  const { t } = useI18n();

  if (value == null) return <span className="text-muted-foreground">{DASH}</span>;
  if (!band) return <span className="tabular">{format(value)}</span>;

  const above = value > band.high;
  const below = value < band.low;
  const Arrow = above ? MoveUp : MoveDown;

  return (
    <span
      title={t('bench.range', { low: format(band.low), high: format(band.high) })}
      className={cn(
        'tabular inline-flex items-center gap-1 rounded-full px-2 py-1 text-xs font-medium',
        above && 'bg-success/12 text-success',
        below && 'bg-destructive/12 text-destructive',
      )}
    >
      {format(value)}
      {(above || below) && <Arrow className="size-3" />}
    </span>
  );
}

export const SEGMENT_STYLE: Record<string, string> = {
  superfan: 'bg-secondary text-foreground',
  potential: 'bg-secondary text-muted-foreground',
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
  const { t } = useI18n();
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
            <a href={profile} className={cn(focusRing, 'text-sm font-semibold hover:underline')}>
              {comment.displayName}
            </a>
            <SegmentBadge segment={comment.segment} />
          </div>
          <p className="mt-1 text-[15px] leading-relaxed">{comment.text}</p>
        </div>
        <p className="text-muted-foreground mt-1 px-1 text-xs">{f.since(comment.publishedAt)}</p>

        {comment.repliedAt && (
          <div className="mt-2 flex gap-2 pl-4">
            <CornerDownRight className="text-muted-foreground mt-1 size-4 shrink-0" />
            <div className="min-w-0">
              <p className="text-muted-foreground text-xs font-medium">
                {t('comment.youReplied', { when: f.since(comment.repliedAt) })}
              </p>
              {comment.replyText && (
                <p className="text-muted-foreground mt-1 text-sm text-pretty">{comment.replyText}</p>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
