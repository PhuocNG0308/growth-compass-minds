import { useState } from 'react';
import { ArrowLeft } from 'lucide-react';
import { AskPanel } from '@/components/ask-panel';
import { Card } from '@/components/ui/card';
import { Chips, Empty, List, Loading, SectionTitle } from '@/components/shell';
import { RetentionChart } from '@/components/retention';
import { Thumb } from '@/components/thumb';
import { CommentLine } from '@/pages/feed';
import { api } from '@/lib/api';
import { useFormat } from '@/lib/format';
import { useI18n } from '@/lib/i18n';
import { useAsync } from '@/lib/use-async';
import { cn, focusRing } from '@/lib/utils';
import type { PostComment } from '@/lib/types';

const FILTERS = ['all', 'superfan', 'potential', 'question', 'criticism'] as const;
type Filter = (typeof FILTERS)[number];

function keep(comment: PostComment, filter: Filter) {
  if (filter === 'all') return true;
  if (filter === 'superfan' || filter === 'potential') return comment.segment === filter;
  return comment.triage === filter;
}

export function Post({ ytVideoId }: { ytVideoId: string }) {
  const { t } = useI18n();
  const f = useFormat();
  const [filter, setFilter] = useState<Filter>('all');
  const { data, loading, error } = useAsync(() => api.post(ytVideoId), [ytVideoId]);

  if (loading) return <Loading />;
  if (error || !data) return <Empty>{t('state.error')}</Empty>;

  const { post, comments, retention } = data;
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
      />

      {retention && (
        <>
          <SectionTitle>{t('section.retention')}</SectionTitle>
          <div className="border-y">
            <RetentionChart retention={retention} durationS={post.durationS} />
          </div>
        </>
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

function Cell({ label, value }: { label: string; value: string }) {
  return (
    <div className="bg-card px-4 py-3">
      <div className="text-muted-foreground text-xs">{label}</div>
      <div className="tabular text-xl font-medium">{value}</div>
    </div>
  );
}

const SUGGESTIONS = ['ask.who', 'ask.why', 'ask.next'];
