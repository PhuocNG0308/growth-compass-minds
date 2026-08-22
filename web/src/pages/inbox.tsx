import { useState } from 'react';
import { TriangleAlert } from 'lucide-react';
import { Alert, AlertTitle } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Empty, Failed, List, Loading, SectionTitle, SubTitle } from '@/components/shell';
import { ProposalList } from '@/components/proposals';
import { api } from '@/lib/api';
import { useFormat } from '@/lib/format';
import { useI18n } from '@/lib/i18n';
import { cn, focusRing } from '@/lib/utils';
import { useAsync } from '@/lib/use-async';
import type { Activity, Me } from '@/lib/types';

export function Inbox({ me }: { me: Me }) {
  const { t, plural } = useI18n();
  const f = useFormat();
  const [round, setRound] = useState(0);
  const proposals = useAsync(() => api.proposals(), [round]);
  const activity = useAsync(() => api.activity(), [round]);
  const chats = useAsync(() => api.chats(), [round]);
  const retry = () => setRound((n) => n + 1);

  const waiting = proposals.data ?? [];

  return (
    <>
      {me.counts.overdue > 0 && (
        <Alert className="border-warning/40 text-warning mb-6 xl:hidden">
          <TriangleAlert />
          <AlertTitle className="text-[15px]">{plural('alert.overdue', me.counts.overdue)}</AlertTitle>
        </Alert>
      )}

      <SectionTitle
        action={
          waiting.length > 0 && (
            <span className="bg-secondary tabular rounded-full px-3 py-1 text-sm font-medium">
              {waiting.length}
            </span>
          )
        }
      >
        {t('section.needsYou')}
      </SectionTitle>
      {proposals.loading ? (
        <Loading rows={2} height="h-32" />
      ) : proposals.error ? (
        <Failed onRetry={retry} />
      ) : waiting.length ? (
        <ProposalList proposals={waiting} onDecided={() => setRound((n) => n + 1)} />
      ) : (
        <p className="text-muted-foreground text-[15px]">{t('empty.proposals')}</p>
      )}

      <SubTitle
        action={
          <a
            href="#/chats"
            className={cn(focusRing, 'text-muted-foreground hover:text-primary rounded-md text-xs font-medium')}
          >
            {t('rail.allChats')}
          </a>
        }
      >
        {t('section.chats')}
      </SubTitle>
      {chats.loading ? (
        <Loading rows={2} height="h-20" />
      ) : chats.error ? (
        <Failed onRetry={retry} />
      ) : chats.data?.length ? (
        <List>
          {chats.data.slice(0, 6).map((thread) => (
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
                <span className="text-muted-foreground shrink-0 text-xs">{f.since(thread.lastMessageAt)}</span>
              </div>
              <p className="text-muted-foreground mt-1 line-clamp-2 text-sm">{thread.lastBody}</p>
            </a>
          ))}
        </List>
      ) : (
        <Empty>{t('empty.chats')}</Empty>
      )}

      <SubTitle>{t('section.activity')}</SubTitle>
      {activity.loading ? (
        <Loading rows={2} height="h-20" />
      ) : activity.error ? (
        <Failed onRetry={retry} />
      ) : activity.data?.length ? (
        <List>
          {activity.data.map((item) => (
            <ActivityRow key={item.checkpointId} item={item} />
          ))}
        </List>
      ) : (
        <Empty>{t('empty.activity')}</Empty>
      )}
    </>
  );
}

function ActivityRow({ item }: { item: Activity }) {
  const { t } = useI18n();
  const f = useFormat();
  const note = summarise(item.observation);

  return (
    <div className="flex items-start gap-4 p-4">
      <Badge variant="secondary" className="tabular shrink-0">
        {f.checkpoint(item.kind)}
      </Badge>
      <div className="min-w-0">
        <div className="text-[15px] font-medium">{item.videoTitle ?? item.hypothesis}</div>
        {note && <p className="text-muted-foreground mt-1 text-sm">{note}</p>}
        <div className="text-muted-foreground mt-1 text-xs">
          {item.observedAt ? t('act.read') : t('act.sent')} · {f.since(item.firedAt)}
        </div>
      </div>
    </div>
  );
}

/**
 * The Mind writes `summary` when it has something to say. Anything else in the observation
 * is our own storage shape, and dumping `ctrPct 5.81` at a creator is not a sentence.
 */
function summarise(observation: Record<string, unknown> | null): string {
  return observation && typeof observation.summary === 'string' ? observation.summary : '';
}
