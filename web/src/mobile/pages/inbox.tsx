import { useState } from 'react';
import { Check, TriangleAlert, X } from 'lucide-react';
import { ReactionWindow, useDecide, type Decide } from '@/components/proposals';
import {
  Disclosure,
  Empty,
  Failed,
  Fold,
  Group,
  Skeletons,
  Strip,
  StripItem,
} from '@/mobile/kit';
import { api } from '@/lib/api';
import { useFormat } from '@/lib/format';
import { useI18n } from '@/lib/i18n';
import { useAsync } from '@/lib/use-async';
import { cn, focusRing } from '@/lib/utils';
import type { Activity, Concept, Me, Proposal } from '@/lib/types';

export function MobileInbox({ me }: { me: Me }) {
  const { t, plural } = useI18n();
  const f = useFormat();
  const [round, setRound] = useState(0);
  const proposals = useAsync(() => api.proposals(), [round]);
  const activity = useAsync(() => api.activity(), [round]);
  const chats = useAsync(() => api.chats(), [round]);
  const retry = () => setRound((n) => n + 1);
  const { decide, pending } = useDecide(retry);

  const waiting = (proposals.data ?? []).filter((proposal) => !pending.has(proposal.id));

  return (
    <>
      {me.counts.overdue > 0 && (
        <div className="border-warning/30 bg-warning/10 text-warning mx-4 mb-4 flex items-center gap-3 rounded-2xl border px-4 py-3">
          <TriangleAlert className="size-5 shrink-0" />
          <span className="text-sm font-medium">{plural('alert.overdue', me.counts.overdue)}</span>
        </div>
      )}

      <Group title={t('section.needsYou')}>
        {proposals.loading ? (
          <Skeletons rows={2} />
        ) : proposals.error ? (
          <Failed onRetry={retry} />
        ) : waiting.length ? (
          <div className="space-y-3 px-4">
            {waiting.map((proposal) => (
              <ProposalCard key={proposal.id} proposal={proposal} onDecide={decide} />
            ))}
          </div>
        ) : (
          <Empty>{t('empty.proposals')}</Empty>
        )}
      </Group>

      <div className="mt-8">
        <Fold title={t('section.activity')} count={activity.data?.length}>
          {activity.loading ? (
            <Skeletons rows={2} />
          ) : activity.error ? (
            <Failed onRetry={retry} />
          ) : activity.data?.length ? (
            <div className="divide-y border-t">
              {activity.data.slice(0, 12).map((item) => (
                <ActivityRow key={item.checkpointId} item={item} />
              ))}
            </div>
          ) : (
            <Empty>{t('empty.activity')}</Empty>
          )}
        </Fold>

        <Fold title={t('section.chats')} count={chats.data?.length}>
          {chats.data?.length ? (
            <div className="divide-y border-t">
              {chats.data.slice(0, 6).map((thread) => (
                <a
                  key={thread.id}
                  href={
                    thread.subjectKind === 'video'
                      ? `#/post/${encodeURIComponent(thread.subjectId)}`
                      : `#/viewer/${encodeURIComponent(thread.subjectId)}`
                  }
                  className={cn(focusRing, 'block px-4 py-4')}
                >
                  <div className="flex items-center justify-between gap-3">
                    <span className="truncate text-[15px] font-medium">{thread.title}</span>
                    <span className="text-muted-foreground shrink-0 text-xs">
                      {f.since(thread.lastMessageAt)}
                    </span>
                  </div>
                  <p className="text-muted-foreground mt-1 line-clamp-2 text-sm">{thread.lastBody}</p>
                </a>
              ))}
            </div>
          ) : (
            <Empty>{t('empty.chats')}</Empty>
          )}
          <a
            href="#/chats"
            className={cn(focusRing, 'text-primary block min-h-12 px-4 pt-3 text-sm font-medium')}
          >
            {t('rail.allChats')}
          </a>
        </Fold>
      </div>
    </>
  );
}

/**
 * Summary first: type, video, the change and what it commits to. Rationale and the other
 * concepts fold away, so a queue of four fits a phone screen instead of one card filling it.
 */
function ProposalCard({ proposal, onDecide }: { proposal: Proposal; onDecide: Decide }) {
  const { t } = useI18n();
  const f = useFormat();
  const concepts = proposal.payload?.concepts ?? [];
  const [choice, setChoice] = useState(concepts[0]?.label ?? proposal.options[0] ?? null);

  const decide = (status: 'approved' | 'dismissed') =>
    onDecide(proposal.id, status, choice ?? undefined);

  const picked = concepts.find((concept) => concept.label === choice);

  return (
    <article className="bg-card overflow-hidden rounded-2xl border">
      <div className="flex flex-wrap items-center gap-2 px-4 pt-4">
        <span className="bg-primary/15 text-primary rounded-full px-3 py-1 text-xs font-semibold">
          {t(`proposal.${proposal.kind}`)}
        </span>
        <ReactionWindow proposal={proposal} />
        <span className="text-muted-foreground text-xs">{f.since(proposal.createdAt)}</span>
      </div>

      {proposal.videoTitle && (
        <p className="text-muted-foreground mt-2 truncate px-4 text-xs">{proposal.videoTitle}</p>
      )}

      {proposal.viewerYtAuthorId && (
        <a
          href={`#/viewer/${encodeURIComponent(proposal.viewerYtAuthorId)}`}
          // 44px is the tap target, not a spacing choice
          className={cn(focusRing, 'text-muted-foreground mt-1 flex min-h-11 items-center truncate px-4 text-xs')}
        >
          {proposal.viewerName}
        </a>
      )}

      <h3 className="mt-1 px-4 leading-snug font-medium text-pretty">{proposal.summary}</h3>
      <p className="text-muted-foreground mt-1 px-4 text-sm text-pretty">{proposal.detail}</p>

      {picked && (
        <p className="mt-2 flex flex-wrap items-center gap-x-3 px-4 text-xs">
          <span className="text-muted-foreground">{t('proposal.commits')}</span>
          {Object.entries(picked.prediction).map(([metric, value]) => (
            <span key={metric} className="tabular text-primary font-semibold">
              {f.metricValue(metric, value)} {f.metric(metric)}
            </span>
          ))}
        </p>
      )}

      <div className="px-4">
        <Disclosure label={t('proposal.showDetail')} openLabel={t('proposal.hideDetail')}>
          <p className="text-muted-foreground text-sm text-pretty">{proposal.rationale}</p>

          {concepts.length > 0 && (
            <>
              <p className="text-muted-foreground mt-3 text-xs font-semibold tracking-wide uppercase">
                {t('proposal.pick')}
              </p>
              <Strip dots align="stretch" className="mt-2">
                {concepts.map((concept) => (
                  <StripItem key={concept.label} className="w-64">
                    <ConceptCard
                      concept={concept}
                      selected={concept.label === choice}
                      onSelect={() => setChoice(concept.label)}
                    />
                  </StripItem>
                ))}
              </Strip>
            </>
          )}
        </Disclosure>
      </div>

      <div className="mt-3 grid grid-cols-[1fr_auto] gap-2 border-t p-3">
        <button
          onClick={() => decide('approved')}
          className={cn(
            focusRing,
            'bg-primary text-primary-foreground flex min-h-12 items-center justify-center gap-2 rounded-full text-sm font-semibold',
          )}
        >
          <Check className="size-5" />
          {t(concepts.length > 0 ? 'proposal.commit' : 'proposal.approve')}
        </button>
        <button
          onClick={() => decide('dismissed')}
          aria-label={t('proposal.dismiss')}
          className={cn(
            focusRing,
            'text-muted-foreground grid size-12 place-items-center rounded-full border',
          )}
        >
          <X className="size-5" />
        </button>
      </div>
    </article>
  );
}

function ConceptCard({
  concept,
  selected,
  onSelect,
}: {
  concept: Concept;
  selected: boolean;
  onSelect: () => void;
}) {
  const { t } = useI18n();
  const f = useFormat();

  return (
    <button
      onClick={onSelect}
      aria-pressed={selected}
      className={cn(
        focusRing,
        'h-full w-full rounded-2xl border p-4 text-left transition-colors',
        selected ? 'border-primary bg-primary/8' : 'text-muted-foreground',
      )}
    >
      <div className={cn('font-medium', selected && 'text-foreground')}>{concept.label}</div>
      <p className="mt-1 line-clamp-3 text-xs text-pretty">{concept.hypothesis}</p>

      {/* "commits to" is a prefix, not a caption — it heads the row it belongs to */}
      <p className="mt-3 text-[11px] font-semibold tracking-wide uppercase">
        {t('proposal.commits')}
      </p>
      <div className="mt-1 flex flex-wrap gap-4">
        {Object.entries(concept.prediction).map(([metric, value]) => (
          <div key={metric}>
            <div className="text-[11px] leading-none">{f.metric(metric)}</div>
            <div className={cn('tabular mt-1 text-lg font-semibold', selected && 'text-primary')}>
              {f.metricValue(metric, value)}
            </div>
          </div>
        ))}
      </div>
    </button>
  );
}

function ActivityRow({ item }: { item: Activity }) {
  const { t } = useI18n();
  const f = useFormat();
  const note = item.observation && typeof item.observation.summary === 'string' ? item.observation.summary : '';

  return (
    <div className="px-4 py-3">
      <div className="flex items-center gap-2">
        <span className="bg-muted tabular rounded-full px-2 py-1 text-xs font-semibold">
          {f.checkpoint(item.kind)}
        </span>
        <span className="truncate text-sm font-medium">{item.videoTitle ?? item.hypothesis}</span>
        <span className="text-muted-foreground ml-auto shrink-0 text-xs">{f.since(item.firedAt)}</span>
      </div>
      {note && <p className="text-muted-foreground mt-1 line-clamp-2 text-sm">{note}</p>}
      <p className="text-muted-foreground mt-1 text-xs">
        {item.observedAt ? t('act.read') : t('act.sent')}
      </p>
    </div>
  );
}
