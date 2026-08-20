import { useState } from 'react';
import { TriangleAlert } from 'lucide-react';
import { Alert, AlertTitle } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Empty, List, Loading, SectionTitle, SubTitle } from '@/components/shell';
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
  const activity = useAsync(() => api.activity(), []);
  const chats = useAsync(() => api.chats(), []);

  const waiting = proposals.data ?? [];

  return (
    <>
      {me.counts.overdue > 0 && (
        <Alert className="border-warning/30 bg-warning/10 text-warning mb-5">
          <TriangleAlert />
          <AlertTitle className="text-[15px]">{plural('alert.overdue', me.counts.overdue)}</AlertTitle>
        </Alert>
      )}

      <SectionTitle
        action={
          waiting.length > 0 && (
            <span className="bg-primary text-primary-foreground tabular rounded-full px-3 py-1 text-sm font-semibold">
              {waiting.length}
            </span>
          )
        }
      >
        {t('section.needsYou')}
      </SectionTitle>
      {proposals.loading ? (
        <Loading />
      ) : waiting.length ? (
        <ProposalList proposals={waiting} onDecided={() => setRound((n) => n + 1)} />
      ) : (
        <p className="text-muted-foreground text-[15px]">{t('empty.proposals')}</p>
      )}

      <SubTitle>{t('section.chats')}</SubTitle>
      {chats.data?.length ? (
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
        <Loading />
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

function summarise(observation: Record<string, unknown> | null): string {
  if (!observation) return '';
  if (typeof observation.summary === 'string') return observation.summary;
  return Object.entries(observation)
    .slice(0, 3)
    .map(([key, value]) => `${key} ${String(value)}`)
    .join(' · ');
}
