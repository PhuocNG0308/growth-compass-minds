import { useState } from 'react';
import { ArrowLeft, Sparkles } from 'lucide-react';
import { AskPanel } from '@/components/ask-panel';
import { RetentionChart } from '@/components/retention';
import { Trend, type TrendPoint } from '@/components/trend';
import { Thumb } from '@/components/thumb';
import { SegmentBadge } from '@/pages/feed';
import {
  Empty,
  Failed,
  Group,
  Pills,
  Sheet,
  Skeletons,
  StickyBar,
  STICKY_ROOM,
  Strip,
  StripItem,
} from '@/mobile/kit';
import { api } from '@/lib/api';
import { useFormat } from '@/lib/format';
import { useI18n } from '@/lib/i18n';
import { useAsync } from '@/lib/use-async';
import { cn, focusRing } from '@/lib/utils';
import type { PostComment, PostDetail, Snapshot } from '@/lib/types';

const TRIAGE = ['all', 'superfan', 'potential', 'question', 'criticism'] as const;
const METRICS = ['views', 'ctrPct', 'avgViewPct'] as const;
const FIELD = { views: 'views', ctrPct: 'ctr', avgViewPct: 'avgViewPct' } as const;

const PAGE = 12;

export function MobilePost({ ytVideoId, focusAsk }: { ytVideoId: string; focusAsk?: boolean }) {
  const { t } = useI18n();
  const f = useFormat();
  const [round, setRound] = useState(0);
  const [filter, setFilter] = useState<(typeof TRIAGE)[number]>('all');
  const [shown, setShown] = useState(PAGE);
  const [ask, setAsk] = useState(Boolean(focusAsk));
  const { data, loading, error } = useAsync(() => api.post(ytVideoId), [ytVideoId, round]);

  if (loading) return <Skeletons />;
  if (error || !data) return <Failed onRetry={() => setRound((n) => n + 1)} />;

  const { post, comments, retention, history } = data;
  const shownComments = comments.filter((comment) => keep(comment, filter));

  return (
    <div className={STICKY_ROOM}>
      <a
        href="#/"
        className={cn(
          focusRing,
          'text-muted-foreground mx-4 mb-3 inline-flex min-h-11 items-center gap-2 text-sm',
        )}
      >
        <ArrowLeft className="size-4" />
        {t('post.back')}
      </a>

      <div className="px-4">
        <Thumb
          url={post.thumbnailUrl}
          title={post.title}
          duration={post.durationS == null ? undefined : f.clock(post.durationS)}
          className="rounded-2xl"
        />
        <h1 className="mt-3 text-lg leading-snug font-semibold text-pretty">{post.title}</h1>
        <p className="text-muted-foreground mt-1 text-xs">{f.longDate(post.publishedAt)}</p>
      </div>

      <div className="mt-3">
        <Pills
          items={[
            { label: t('metric.views'), value: f.int(post.views) },
            { label: t('metric.ctrPct'), value: f.pct(post.ctrPct, 1) },
            { label: t('metric.avgViewPct'), value: f.pct(post.avgViewPct) },
            { label: t('metric.comments'), value: f.int(post.commentCount) },
          ]}
        />
      </div>

      {/* two charts, one at a time, swiped — never side by side on a 390px screen */}
      <Group title={t('section.charts')}>
        <Strip dots align="stretch">
          <StripItem className="bg-card w-[86vw] rounded-2xl border p-4">
            <Trajectory history={history} />
          </StripItem>
          <StripItem className="bg-card w-[86vw] rounded-2xl border p-4">
            {retention ? (
              <>
                <p className="text-muted-foreground mb-2 text-sm">{t('section.retention')}</p>
                <RetentionChart retention={retention} durationS={post.durationS} width={360} />
              </>
            ) : (
              <Empty>{t('empty.retention')}</Empty>
            )}
          </StripItem>
        </Strip>
      </Group>

      <Group title={t('section.comments')}>
        <Strip snap="none" className="pb-3">
          {TRIAGE.map((key) => {
            const count = comments.filter((comment) => keep(comment, key)).length;
            if (key !== 'all' && count === 0) return null;
            return (
              <StripItem key={key}>
                <button
                  onClick={() => {
                    setFilter(key);
                    setShown(PAGE);
                  }}
                  aria-pressed={key === filter}
                  className={cn(
                    focusRing,
                    'min-h-11 rounded-full border px-4 text-sm font-medium',
                    key === filter
                      ? 'border-primary bg-primary/12 text-primary'
                      : 'text-muted-foreground',
                  )}
                >
                  {t(`filter.${key}`)}
                  <span className="tabular ml-2 opacity-70">{count}</span>
                </button>
              </StripItem>
            );
          })}
        </Strip>

        {shownComments.length ? (
          <>
            <div className="divide-y border-y">
              {shownComments.slice(0, shown).map((comment) => (
                <Comment key={comment.ytCommentId} comment={comment} />
              ))}
            </div>
            {shownComments.length > shown && (
              <button
                onClick={() => setShown((n) => n + PAGE)}
                className={cn(focusRing, 'text-primary min-h-12 w-full text-sm font-medium')}
              >
                {t('queue.more', { n: String(shownComments.length - shown) })}
              </button>
            )}
          </>
        ) : (
          <Empty>{t('empty.filter')}</Empty>
        )}
      </Group>

      <StickyBar>
        <button
          onClick={() => setAsk(true)}
          className={cn(
            focusRing,
            'bg-primary text-primary-foreground flex min-h-12 w-full items-center justify-center gap-2 rounded-full font-semibold',
          )}
        >
          <Sparkles className="size-5" />
          {t('ask.title')}
        </button>
      </StickyBar>

      <Sheet open={ask} onOpenChange={setAsk} title={t('ask.title')}>
        <div className="px-2 pb-4">
          <AskPanel
            subject={{
              ask: (question, mentions) => api.ask(ytVideoId, question, mentions),
              chat: () => api.chat(ytVideoId),
            }}
            suggestions={['ask.who', 'ask.why', 'ask.next']}
            autoFocus={ask}
          />
        </div>
      </Sheet>
    </div>
  );
}

function Trajectory({ history }: { history: Snapshot[] }) {
  const { t } = useI18n();
  const f = useFormat();
  const [metric, setMetric] = useState<(typeof METRICS)[number]>('views');

  const points: TrendPoint[] = [...history]
    .sort((a, b) => a.ageHours - b.ageHours)
    .map((snapshot) => ({ label: age(snapshot.ageHours), value: snapshot[FIELD[metric]] }));

  return (
    <>
      <div className="mb-3 flex gap-2">
        {METRICS.map((key) => (
          <button
            key={key}
            onClick={() => setMetric(key)}
            aria-pressed={key === metric}
            className={cn(
              focusRing,
              'min-h-9 flex-1 rounded-full border px-2 text-xs font-medium',
              key === metric ? 'border-primary bg-primary/12 text-primary' : 'text-muted-foreground',
            )}
          >
            {t(`metric.${key}`)}
          </button>
        ))}
      </div>
      <Trend
        points={points}
        caption={t('chart.trajectory')}
        format={(value) =>
          value == null ? '' : metric === 'views' ? f.int(Math.round(value)) : f.pct(value)
        }
      />
    </>
  );
}

function Comment({ comment }: { comment: PostComment }) {
  const { t } = useI18n();
  const f = useFormat();

  return (
    <div className="px-4 py-4">
      <div className="flex flex-wrap items-center gap-2">
        <a
          href={`#/viewer/${encodeURIComponent(comment.ytAuthorId)}`}
          className={cn(focusRing, 'text-sm font-semibold')}
        >
          {comment.displayName}
        </a>
        <SegmentBadge segment={comment.segment} />
        <span className="text-muted-foreground ml-auto text-xs">{f.since(comment.publishedAt)}</span>
      </div>
      <p className="mt-1 text-[15px] leading-relaxed text-pretty">{comment.text}</p>
      {comment.repliedAt && (
        <p className="text-muted-foreground mt-2 text-xs">
          {t('comment.youReplied', { when: f.since(comment.repliedAt) })}
        </p>
      )}
    </div>
  );
}

const age = (hours: number) => (hours < 48 ? `${hours}h` : `${Math.round(hours / 24)}d`);

function keep(comment: PostDetail['comments'][number], filter: (typeof TRIAGE)[number]) {
  if (filter === 'all') return true;
  if (filter === 'superfan' || filter === 'potential') return comment.segment === filter;
  return comment.triage === filter;
}
