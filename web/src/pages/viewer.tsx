import { ArrowLeft } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { AskPanel } from '@/components/ask-panel';
import { Empty, List, Loading, SectionTitle } from '@/components/shell';
import { StatGrid } from '@/components/stats';
import { Thumb } from '@/components/thumb';
import { SegmentBadge } from '@/pages/feed';
import { api } from '@/lib/api';
import { useFormat } from '@/lib/format';
import { useI18n } from '@/lib/i18n';
import { useAsync } from '@/lib/use-async';
import { cn, focusRing } from '@/lib/utils';

const SUGGESTIONS = ['ask.viewerWho', 'ask.viewerKeep', 'ask.viewerIdea'];

export function ViewerProfile({ ytAuthorId }: { ytAuthorId: string }) {
  const { t, plural } = useI18n();
  const f = useFormat();
  const { data, loading, error } = useAsync(() => api.viewer(ytAuthorId), [ytAuthorId]);

  if (loading) return <Loading />;
  if (error || !data) return <Empty>{t('state.error')}</Empty>;

  const { viewer, comments } = data;
  const tenure = Math.round(
    (new Date(viewer.lastSeenAt).getTime() - new Date(viewer.firstSeenAt).getTime()) / 86_400_000,
  );

  return (
    <>
      <button
        onClick={() => (history.length > 1 ? history.back() : (location.hash = '#/audience'))}
        className="text-muted-foreground hover:text-primary mb-4 inline-flex items-center gap-2 text-sm"
      >
        <ArrowLeft className="size-4" />
        {t('viewer.back')}
      </button>

      <div className="mb-5 flex items-center gap-4">
        <span className="bg-primary/20 text-primary grid size-14 shrink-0 place-items-center rounded-full text-xl font-semibold">
          {viewer.displayName.trim().charAt(0).toUpperCase()}
        </span>
        <div className="min-w-0">
          <h1 className="truncate text-2xl font-semibold tracking-tight">{viewer.displayName}</h1>
          <div className="mt-1 flex flex-wrap items-center gap-2">
            <SegmentBadge segment={viewer.segment} />
            <span className="text-muted-foreground text-sm">
              {t('viewer.since', { date: f.longDate(viewer.firstSeenAt) })}
            </span>
          </div>
        </div>
      </div>

      <StatGrid
        stats={[
          { value: viewer.commentCount, label: t('viewer.comments'), lead: true },
          { value: viewer.videosTouched, label: t('viewer.videos') },
          { value: viewer.totalLikes, label: t('viewer.likes') },
          { value: tenure, label: t('viewer.tenureDays') },
        ]}
      />

      <AskPanel
        subject={{
          ask: (question, mentions) => api.askViewer(ytAuthorId, question, mentions),
          chat: () => api.viewerChat(ytAuthorId),
        }}
        suggestions={SUGGESTIONS}
        title="ask.viewerTitle"
      />

      <ThreadList ytAuthorId={ytAuthorId} />

      <SectionTitle>{plural('viewer.history', comments.length)}</SectionTitle>
      {comments.length ? (
        <List>
          {comments.map((comment) => (
            <div key={comment.ytCommentId} className="flex gap-4 p-4">
              <a href={`#/post/${encodeURIComponent(comment.ytVideoId)}`} className={cn(focusRing, 'w-24 shrink-0 self-start')}>
                <Thumb url={comment.thumbnailUrl} title={comment.videoTitle} />
              </a>
              <div className="min-w-0 flex-1">
                <a
                  href={`#/post/${encodeURIComponent(comment.ytVideoId)}`}
                  className={cn(focusRing, 'hover:text-primary text-muted-foreground block truncate text-xs')}
                >
                  {comment.videoTitle}
                </a>
                <p className="mt-1 text-[15px] leading-relaxed">{comment.text}</p>
                <div className="text-muted-foreground mt-2 flex items-center gap-3 text-xs">
                  <span>{f.since(comment.publishedAt)}</span>
                  <span>{plural('viewer.likeCount', comment.likeCount)}</span>
                  {comment.triage && (
                    <Badge variant="secondary" className="text-[11px]">
                      {t(`filter.${comment.triage}`)}
                    </Badge>
                  )}
                </div>
              </div>
            </div>
          ))}
        </List>
      ) : (
        <Empty>{t('empty.viewerHistory')}</Empty>
      )}
    </>
  );
}

function ThreadList({ ytAuthorId }: { ytAuthorId: string }) {
  const { t, plural } = useI18n();
  const f = useFormat();
  const { data } = useAsync(() => api.viewerThreads(ytAuthorId), [ytAuthorId]);

  if (!data?.length) return null;

  return (
    <>
      <SectionTitle>{t('viewer.threads')}</SectionTitle>
      <List>
        {data.map((thread) => (
          <a
            key={thread.id}
            href={
              thread.subjectKind === 'video'
                ? `#/post/${encodeURIComponent(thread.subjectId)}`
                : `#/viewer/${encodeURIComponent(thread.subjectId)}`
            }
            className={cn(focusRing, 'hover:bg-accent block p-4')}
          >
            <div className="flex items-center justify-between gap-3">
              <span className="truncate text-[15px] font-medium">{thread.title}</span>
              <span className="text-muted-foreground shrink-0 text-xs">
                {plural('chat.messages', thread.messageCount)}
              </span>
            </div>
            <p className="text-muted-foreground mt-1 line-clamp-2 text-sm">{thread.lastBody}</p>
            <p className="text-muted-foreground mt-1 text-xs">{f.since(thread.lastMessageAt)}</p>
          </a>
        ))}
      </List>
    </>
  );
}
