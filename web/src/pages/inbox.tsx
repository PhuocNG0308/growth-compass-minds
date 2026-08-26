import { useState } from 'react';
import { ArrowRight, TriangleAlert, X } from 'lucide-react';
import { Alert, AlertTitle } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Empty, Failed, List, Loading, SectionTitle, SubTitle } from '@/components/shell';
import { ProposalList, useDecide } from '@/components/proposals';
import { api } from '@/lib/api';
import { useFormat } from '@/lib/format';
import { useI18n } from '@/lib/i18n';
import { cn, focusRing } from '@/lib/utils';
import { useAsync } from '@/lib/use-async';
import type { Activity, Me } from '@/lib/types';

export function Inbox({ me }: { me: Me }) {
  const { t, plural } = useI18n();
  const [round, setRound] = useState(0);
  const proposals = useAsync(() => api.proposals(), [round]);
  const activity = useAsync(() => api.activity(), [round]);
  const retry = () => setRound((n) => n + 1);
  const { decide, dismissAll, pending } = useDecide(retry);

  const waiting = (proposals.data ?? []).filter((proposal) => !pending.has(proposal.id));

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
            <div className="flex items-center gap-2">
              <span className="bg-secondary tabular rounded-full px-3 py-1 text-sm font-medium">
                {waiting.length}
              </span>
              {waiting.length > 1 && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => dismissAll(waiting.map((proposal) => proposal.id))}
                >
                  <X />
                  {t('proposal.dismissAll')}
                </Button>
              )}
            </div>
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
        <>
          {waiting.length > 1 && (
            <p className="text-muted-foreground -mt-1 mb-3 text-xs">{t('proposal.keys')}</p>
          )}
          <ProposalList proposals={waiting} onDecide={decide} />
        </>
      ) : (
        <p className="text-muted-foreground text-[15px]">{t('empty.proposals')}</p>
      )}

      <a
        href="#/chats"
        className={cn(
          focusRing,
          'text-muted-foreground hover:text-primary mt-6 inline-flex items-center gap-2 rounded-md text-sm font-medium',
        )}
      >
        {t('rail.allChats')}
        <ArrowRight className="size-4" />
      </a>

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
