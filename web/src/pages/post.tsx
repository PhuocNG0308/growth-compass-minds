import { useId, useState } from 'react';
import { AskPanel } from '@/components/ask-panel';
import { X } from 'lucide-react';
import { Chips, Empty, Failed, List, Loading, Modelled, SectionTitle } from '@/components/shell';
import { RetentionChart } from '@/components/retention';
import { Crumbs, postHref, type PostSection } from '@/components/video-nav';
import { Trend, type TrendPoint } from '@/components/trend';
import { CommentLine } from '@/pages/feed';
import { api } from '@/lib/api';
import { askSuggestions } from '@/lib/ask-suggestions';
import { useFormat } from '@/lib/format';
import { useI18n } from '@/lib/i18n';
import { useAsync, type Async } from '@/lib/use-async';
import { cn, focusRing } from '@/lib/utils';
import type { PostComment, PostDetail, Snapshot } from '@/lib/types';

// how many comments the ask route puts in front of the Mind, which is what its citations index
const BRIEFED = 40;

const FILTERS = ['all', 'superfan', 'potential', 'question', 'criticism'] as const;
type Filter = (typeof FILTERS)[number];

function keep(comment: PostComment, filter: Filter) {
  if (filter === 'all') return true;
  if (filter === 'superfan' || filter === 'potential') return comment.segment === filter;
  return comment.triage === filter;
}

/**
 * One video, split the way the questions about it are: how did it do, where did people leave,
 * what did they say. The column on the left says which video and holds the switch between them,
 * so each of these screens can be about one thing.
 */
export function Post({
  ytVideoId,
  section,
  behind,
  video,
  demo,
  onRetry,
}: {
  ytVideoId: string;
  section: PostSection;
  behind: Exclude<PostSection, 'ask'>;
  video: Async<PostDetail | null>;
  /** The sample channel cannot measure click-through or retention, and has to say so. */
  demo: boolean;
  onRetry: () => void;
}) {
  const { t } = useI18n();
  const f = useFormat();
  const [filter, setFilter] = useState<Filter>('all');
  const [draft, setDraft] = useState('');
  const [moment, setMoment] = useState<number | null>(null);
  const [hovered, setHovered] = useState<number | null>(null);

  if (video.loading) return <Loading rows={3} />;
  if (video.error || !video.data) return <Failed onRetry={onRetry} />;

  const { post, comments, retention, history } = video.data;
  const shown = comments.filter((comment) => keep(comment, filter));
  const asking = section === 'ask';

  const panel = (
    // its own scroll and its own height: the numbers beside it must not move while you read
    <aside className="sticky top-0 flex h-[calc(100dvh-11rem)] min-w-0 flex-col overflow-hidden rounded-xl border">
      <div className="flex shrink-0 items-center gap-3 border-b px-4 py-3">
        <h2 className="flex-1 truncate font-medium">{t('ask.title')}</h2>
        <a
          href={postHref(ytVideoId)}
          aria-label={t('reply.cancel')}
          className={cn(focusRing, 'hover:bg-accent grid size-9 place-items-center rounded-full')}
        >
          <X className="size-5" />
        </a>
      </div>

      <AskPanel
        fill
        subject={{
          ask: (question, mentions) => api.ask(ytVideoId, question, mentions),
          chat: () => api.chat(ytVideoId),
        }}
        suggestions={askSuggestions(video.data)}
        draft={draft}
        highlight={hovered}
        sources={{
          // the same slice, in the same order, that the ask route briefs the Mind with:
          // both read `commentsForVideo`, so [c3] means the third of these
          comments: comments.slice(0, BRIEFED),
          at: (ratio) =>
            post.durationS ? f.clock(ratio * post.durationS) : `${Math.round(ratio * 100)}%`,
          onSeek: (ratio) => {
            setMoment(ratio);
            location.hash = postHref(ytVideoId, 'retention');
          },
        }}
        autoFocus
      />
    </aside>
  );

  const body = (
    <>
      {behind === 'analytics' && (
        <>
          <dl className="bg-border grid grid-cols-2 gap-px overflow-hidden rounded-xl border @md:grid-cols-4">
            <Cell label={t('metric.views')} value={f.int(post.views)} />
            <Cell label={t('metric.ctrPct')} value={f.pct(post.ctrPct, 1)} modelled={demo} />
            <Cell label={t('metric.avgViewPct')} value={f.pct(post.avgViewPct)} modelled={demo} />
            <Cell label={t('metric.comments')} value={f.int(post.commentCount)} />
          </dl>

          <SectionTitle>{t('section.trajectory')}</SectionTitle>
          <Trajectory history={history} />
        </>
      )}

      {behind === 'retention' &&
        (retention ? (
          <Retention
            ytVideoId={ytVideoId}
            retention={retention}
            durationS={post.durationS}
            demo={demo}
            focus={moment}
            onCursor={setHovered}
            onAsk={(question) => {
              setDraft(question);
              location.hash = postHref(ytVideoId, 'ask');
            }}
          />
        ) : (
          <Empty>{t('empty.retention')}</Empty>
        ))}

      {behind === 'comments' && (
        <>
          <Chips
            options={FILTERS.map((key) => ({
              key,
              label: t(`filter.${key}`),
              count: key === 'all' ? undefined : comments.filter((c) => keep(c, key)).length,
            }))}
            value={filter}
            onChange={(key) => setFilter(key as Filter)}
          />

          {shown.length ? (
            <List>
              {shown.map((comment) => (
                <CommentLine key={comment.ytCommentId} comment={comment} />
              ))}
            </List>
          ) : (
            <Empty>{t(comments.length ? 'empty.filter' : 'empty.comments')}</Empty>
          )}
        </>
      )}
    </>
  );

  return (
    <>
      <Crumbs title={post.title} section={behind} />
      <h1 className="mb-6 text-2xl font-normal tracking-tight">{t(`section.${behind}`)}</h1>

      {/* asking is a conversation held against the numbers, so the numbers stay on screen */}
      {asking ? (
        <div className="grid gap-6 @3xl:grid-cols-[3fr_2fr]">
          <div className="min-w-0">{body}</div>
          {panel}
        </div>
      ) : (
        body
      )}
    </>
  );
}

/**
 * A curve on its own says how many stayed; it takes a second curve to say whether that was
 * good for this channel. The one being compared against is the creator's own choice, because
 * only they know which of their videos is the one that worked.
 */
function Retention({
  ytVideoId,
  retention,
  durationS,
  demo,
  focus,
  onCursor,
  onAsk,
}: {
  ytVideoId: string;
  retention: NonNullable<PostDetail['retention']>;
  durationS: number | null;
  demo: boolean;
  focus: number | null;
  onCursor: (ratio: number | null) => void;
  onAsk: (question: string) => void;
}) {
  const { t } = useI18n();
  const [against, setAgainst] = useState('');
  const pickerId = useId();

  const feed = useAsync(() => api.feed(), []);
  const other = useAsync(() => (against ? api.post(against) : Promise.resolve(null)), [against]);

  const curve = other.data?.retention;
  const compare = curve ? { title: other.data!.post.title, points: curve.points } : null;

  return (
    <>
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <label htmlFor={pickerId} className="text-muted-foreground text-sm">
          {t('video.compareWith')}
        </label>
        <select
          id={pickerId}
          value={against}
          onChange={(event) => setAgainst(event.target.value)}
          className={cn(focusRing, 'bg-background h-10 max-w-80 rounded-full border px-4 text-sm')}
        >
          <option value="">{t('video.compareNone')}</option>
          {(feed.data ?? [])
            .filter((post) => post.ytVideoId !== ytVideoId)
            .map((post) => (
              <option key={post.ytVideoId} value={post.ytVideoId}>
                {post.title}
              </option>
            ))}
        </select>

        <p role="status" className="text-muted-foreground text-xs empty:hidden">
          {other.loading
            ? t('state.loading')
            : against && !curve
              ? t('video.compareNoData')
              : compare
                ? t('video.compareBy')
                : ''}
        </p>
      </div>

      {demo && <p className="text-muted-foreground mb-3 text-xs">{t('demo.modelledCurve')}</p>}

      <div className="border-y">
        <RetentionChart
          retention={retention}
          durationS={durationS}
          compare={compare}
          focus={focus}
          onCursor={onCursor}
          onAsk={onAsk}
        />
      </div>
    </>
  );
}

const METRICS = ['views', 'ctrPct', 'avgViewPct'] as const;
type Metric = (typeof METRICS)[number];

// the snapshot column names differ from the metric labels the rest of the app uses
const FIELD: Record<Metric, 'views' | 'ctr' | 'avgViewPct'> = {
  views: 'views',
  ctrPct: 'ctr',
  avgViewPct: 'avgViewPct',
};

/**
 * One metric at a time. Views and CTR on shared axes would need two y-scales, and the gap
 * between them is arbitrary — the chart would imply a relationship the data never showed.
 */
function Trajectory({ history }: { history: Snapshot[] }) {
  const { t } = useI18n();
  const f = useFormat();
  const [metric, setMetric] = useState<Metric>('views');

  const points: TrendPoint[] = [...history]
    .sort((a, b) => a.ageHours - b.ageHours)
    .map((snapshot) => ({ label: age(snapshot.ageHours), value: snapshot[FIELD[metric]] }));

  return (
    <div className="border-y py-5">
      <Chips
        options={METRICS.map((key) => ({ key, label: t(`metric.${key}`) }))}
        value={metric}
        onChange={(key) => setMetric(key as Metric)}
      />
      <Trend
        points={points}
        caption={`${t(`metric.${metric}`)} — ${t('chart.trajectory')}`}
        format={(value) =>
          value == null ? '' : metric === 'views' ? f.int(Math.round(value)) : f.pct(value)
        }
      />
    </div>
  );
}

const age = (hours: number) => (hours < 48 ? `${hours}h` : `${Math.round(hours / 24)}d`);

function Cell({ label, value, modelled }: { label: string; value: string; modelled?: boolean }) {
  return (
    <div className="bg-card px-4 py-3">
      <dt className="text-muted-foreground text-xs">
        {modelled ? <Modelled>{label}</Modelled> : label}
      </dt>
      <dd className="tabular text-xl font-medium">{value}</dd>
    </div>
  );
}
