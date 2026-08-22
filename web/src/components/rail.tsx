import { ArrowRight, TriangleAlert } from 'lucide-react';
import { RailTitle } from '@/components/shell';
import { api } from '@/lib/api';
import { useFormat } from '@/lib/format';
import { useI18n } from '@/lib/i18n';
import { useAsync } from '@/lib/use-async';
import { cn, focusRing } from '@/lib/utils';
import type { Me } from '@/lib/types';

/** Context that would otherwise cost a tab switch, parked in space the feed cannot use. */
export function Rail({ me }: { me: Me }) {
  const { t, plural } = useI18n();
  const f = useFormat();
  const proposals = useAsync(() => api.proposals(), []);
  const chats = useAsync(() => api.chats(), []);

  const waiting = proposals.data ?? [];
  const threads = chats.data ?? [];

  return (
    <>
      {me.counts.overdue > 0 && (
        <a
          href="#/inbox"
          className={cn(
            focusRing,
            'text-warning border-warning/40 hover:bg-accent flex items-center gap-3 rounded-xl border px-4 py-3 text-sm font-medium',
          )}
        >
          <TriangleAlert className="size-4 shrink-0" />
          {plural('alert.overdue', me.counts.overdue)}
        </a>
      )}

      <section>
        <RailTitle>{t('rail.channel')}</RailTitle>
        <dl className="divide-y border-y">
          <Row label={t('stat.videos')} value={me.counts.videos} />
          <Row label={t('stat.running')} value={me.counts.running} />
          <Row label={t('stat.settled')} value={me.counts.settled} />
          <Row label={t('stat.rules')} value={me.counts.tenets} />
        </dl>
        <p className="text-muted-foreground mt-3 text-xs">
          {me.reachThrough ? t('ctr.through', { date: f.longDate(me.reachThrough) }) : t('ctr.pending')}
        </p>
        {me.syncFailing && (
          <p className="text-destructive mt-2 text-xs">
            {me.lastSyncAt
              ? t('sync.stale', { when: f.since(me.lastSyncAt) })
              : t('sync.never')}
          </p>
        )}
      </section>

      {waiting.length > 0 && (
        <section>
          <RailTitle>{t('section.needsYou')}</RailTitle>
          <div className="divide-y border-y">
            {waiting.slice(0, 3).map((proposal) => (
              <a
                key={proposal.id}
                href="#/inbox"
                className={cn(focusRing, 'hover:bg-accent block py-3')}
              >
                <p className="line-clamp-2 text-sm font-medium">{proposal.summary}</p>
                <p className="text-muted-foreground mt-1 text-xs">{t(`proposal.${proposal.kind}`)}</p>
              </a>
            ))}
          </div>
        </section>
      )}

      {threads.length > 0 && (
        <section>
          <RailTitle>{t('section.chats')}</RailTitle>
          <div className="divide-y border-y">
            {threads.slice(0, 4).map((thread) => (
              <a
                key={thread.id}
                href={
                  thread.subjectKind === 'video'
                    ? `#/post/${encodeURIComponent(thread.subjectId)}`
                    : `#/viewer/${encodeURIComponent(thread.subjectId)}`
                }
                className={cn(focusRing, 'hover:bg-accent block py-3')}
              >
                <p className="truncate text-sm font-medium">{thread.title}</p>
                <p className="text-muted-foreground mt-1 text-xs">{f.since(thread.lastMessageAt)}</p>
              </a>
            ))}
          </div>
          <a
            href="#/chats"
            className={cn(
              focusRing,
              'text-muted-foreground hover:text-primary mt-3 inline-flex items-center gap-1 text-xs font-medium',
            )}
          >
            {t('rail.allChats')}
            <ArrowRight className="size-3" />
          </a>
        </section>
      )}
    </>
  );
}

function Row({ label, value }: { label: string; value: number }) {
  return (
    <div className="flex items-baseline justify-between py-3">
      <dt className="text-muted-foreground text-sm">{label}</dt>
      <dd className="tabular font-medium">{value}</dd>
    </div>
  );
}
