import { useState } from 'react';
import { ArrowLeft } from 'lucide-react';
import { AskPanel } from '@/components/ask-panel';
import { Card } from '@/components/ui/card';
import { Chips, Empty, Failed, List, Loading, SectionTitle } from '@/components/shell';
import { RetentionChart } from '@/components/retention';
import { Trend, type TrendPoint } from '@/components/trend';
import { Thumb } from '@/components/thumb';
import { CommentLine } from '@/pages/feed';
import { api } from '@/lib/api';
import { useFormat } from '@/lib/format';
import { useI18n } from '@/lib/i18n';
import { useAsync } from '@/lib/use-async';
import { cn, focusRing } from '@/lib/utils';
import type { PostComment, Snapshot } from '@/lib/types';

const FILTERS = ['all', 'superfan', 'potential', 'question', 'criticism'] as const;
type Filter = (typeof FILTERS)[number];

function keep(comment: PostComment, filter: Filter) {
  if (filter === 'all') return true;
  if (filter === 'superfan' || filter === 'potential') return comment.segment === filter;
  return comment.triage === filter;
}

export function Post({ ytVideoId, focusAsk }: { ytVideoId: string; focusAsk?: boolean }) {
  const { t } = useI18n();
  const f = useFormat();
  const [filter, setFilter] = useState<Filter>('all');
  const [round, setRound] = useState(0);
  const { data, loading, error } = useAsync(() => api.post(ytVideoId), [ytVideoId, round]);

  if (loading) return <Loading rows={3} />;
  if (error || !data) return <Failed onRetry={() => setRound((n) => n + 1)} />;

  const { post, comments, retention, history } = data;
  const shown = comments.filter((comment) => keep(comment, filter));

  return (
    <>
      <a href="#/" className={cn(focusRing, 'text-muted-foreground hover:text-primary mb-4 inline-flex items-center gap-2 text-sm')}>
        <ArrowLeft className="size-4" />
        {t('post.back')}
      </a>

      <Card className="gap-0 overflow-hidden py-0">
        <div className="px-4 pt-4">
          <h1 className="text-xl leading-snug font-semibold">{post.title}</h1>
          <p className="text-muted-foreground mt-1 text-sm">
            {f.longDate(post.publishedAt)} · {f.clock(post.durationS)}
          </p>
        </div>

        <Thumb
          url={post.thumbnailUrl}
          title={post.title}
          duration={post.durationS == null ? undefined : f.clock(post.durationS)}
          className="mt-3 rounded-none"
        />

        <div className="grid grid-cols-2 gap-px border-t @md:grid-cols-4">
          <Cell label={t('metric.views')} value={f.int(post.views)} />
          <Cell label={t('metric.ctrPct')} value={f.pct(post.ctrPct, 1)} />
          <Cell label={t('metric.avgViewPct')} value={f.pct(post.avgViewPct)} />
          <Cell label={t('metric.comments')} value={f.int(post.commentCount)} />
        </div>
      </Card>

      <AskPanel
        subject={{
          ask: (question, mentions) => api.ask(ytVideoId, question, mentions),
          chat: () => api.chat(ytVideoId),
        }}
        suggestions={SUGGESTIONS}
        autoFocus={focusAsk}
      />

      <SectionTitle>{t('section.trajectory')}</SectionTitle>
      <Trajectory history={history} />

      <SectionTitle>{t('section.retention')}</SectionTitle>
      {retention ? (
        <div className="border-y">
          <RetentionChart retention={retention} durationS={post.durationS} />
        </div>
      ) : (
        <Empty>{t('empty.retention')}</Empty>
      )}

      <div className="mt-6 mb-3 flex items-center justify-between gap-3">
        <h2 className="text-xl font-semibold tracking-tight">{t('section.comments')}</h2>
        <span className="text-muted-foreground text-sm">{shown.length}</span>
      </div>

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
        <Empty>{t('empty.filter')}</Empty>
      )}
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

function Cell({ label, value }: { label: string; value: string }) {
  return (
    <div className="bg-card px-4 py-3">
      <div className="text-muted-foreground text-xs">{label}</div>
      <div className="tabular text-xl font-medium">{value}</div>
    </div>
  );
}

const SUGGESTIONS = ['ask.who', 'ask.why', 'ask.next'];
