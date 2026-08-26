import { useRef, useState } from 'react';
import { Check, Clock, TriangleAlert, X } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Thumb } from '@/components/thumb';
import { UNDO_MS, useToast } from '@/components/toast';
import { api } from '@/lib/api';
import { useFormat } from '@/lib/format';
import { useI18n } from '@/lib/i18n';
import { cn, focusRing } from '@/lib/utils';
import type { Concept, Proposal } from '@/lib/types';

export type Decide = (id: string, status: 'approved' | 'dismissed', choice?: string) => void;

// the same window the checkpoint runner treats as rescuable, seen from the creator's side
const REACTION_WINDOW_H = 72;
const CRITICAL_H = 6;
const SOON_H = 24;
const PACKAGING: ReadonlySet<Proposal['kind']> = new Set(['title', 'thumbnail', 'hook', 'community']);

/**
 * Repackaging only pays while YouTube is still choosing who to show the video to. Three
 * tiers, and only the two that can still be missed get a filled badge.
 */
export function ReactionWindow({ proposal }: { proposal: Proposal }) {
  const { t } = useI18n();
  const f = useFormat();

  if (!proposal.videoPublishedAt || !PACKAGING.has(proposal.kind)) return null;
  const closesAt = new Date(proposal.videoPublishedAt).getTime() + REACTION_WINDOW_H * 3_600_000;
  const hoursLeft = (closesAt - Date.now()) / 3_600_000;
  if (hoursLeft <= 0) return null;

  const when = f.since(new Date(closesAt).toISOString());
  if (hoursLeft >= SOON_H) {
    return (
      <span className="text-muted-foreground flex items-center gap-2 text-xs">
        <Clock className="size-4" />
        {t('proposal.window', { when })}
      </span>
    );
  }

  const critical = hoursLeft < CRITICAL_H;
  const Icon = critical ? TriangleAlert : Clock;

  return (
    <span
      className={cn(
        'flex items-center gap-2 rounded-full border px-3 py-1 text-xs font-medium',
        critical
          ? 'border-destructive/35 bg-destructive/10 text-destructive'
          : 'border-warning/35 bg-warning/10 text-warning',
      )}
    >
      <Icon className="size-4" />
      {t(critical ? 'proposal.windowNow' : 'proposal.window', { when })}
    </span>
  );
}

/**
 * A decision is spent attention, and a misclick that cannot be taken back makes a creator
 * slow down on every card after it. The server has no way to un-decide, so the card leaves
 * the list at once and the request is held back for as long as the toast offers to undo it.
 */
export function useDecide(onCommitted: () => void): {
  decide: Decide;
  dismissAll: (ids: string[]) => void;
  pending: Set<string>;
} {
  const { t, plural } = useI18n();
  const notify = useToast();
  const [pending, setPending] = useState<Set<string>>(new Set());

  const drop = (ids: string[]) =>
    setPending((current) => {
      const next = new Set(current);
      for (const id of ids) next.delete(id);
      return next;
    });

  /** Held for the undo window, whether it covers one card or forty. */
  const hold = (ids: string[], message: string, send: () => Promise<void>) => {
    setPending((current) => new Set([...current, ...ids]));

    let sent = false;
    const timer = setTimeout(async () => {
      sent = true;
      try {
        await send();
        onCommitted();
      } catch {
        notify(t('proposal.failed'), 'error');
        drop(ids);
      }
    }, UNDO_MS);

    notify(message, 'ok', () => {
      if (sent) return;
      clearTimeout(timer);
      drop(ids);
    });
  };

  const decide: Decide = (id, status, choice) =>
    hold(
      [id],
      t(status === 'approved' ? 'proposal.didApprove' : 'proposal.didDismiss'),
      async () => {
        const result = await api.decide(id, status, choice);
        if (result.opened) {
          notify(
            result.opened.checkpoints > 0
              ? t('proposal.opened', { n: String(result.opened.checkpoints) })
              : t('proposal.openedUnattached'),
          );
        }
      },
    );

  // dismissal only: a bulk approve would open experiments on predictions nobody read
  const dismissAll = (ids: string[]) =>
    hold(ids, plural('proposal.didDismissMany', ids.length), async () => {
      await Promise.all(ids.map((id) => api.decide(id, 'dismissed')));
    });

  return { decide, dismissAll, pending };
}

export function ProposalList({ proposals, onDecide }: { proposals: Proposal[]; onDecide: Decide }) {
  const rows = useRef<Array<HTMLDivElement | null>>([]);

  return (
    <Card className="gap-0 py-0">
      {proposals.map((proposal, index) => (
        <ProposalRow
          key={proposal.id}
          proposal={proposal}
          onDecide={onDecide}
          first={index === 0}
          bind={(node) => {
            rows.current[index] = node;
          }}
          onMove={(delta) =>
            rows.current[Math.min(Math.max(index + delta, 0), proposals.length - 1)]?.focus()
          }
        />
      ))}
    </Card>
  );
}

function ProposalRow({
  proposal,
  onDecide,
  first,
  bind,
  onMove,
}: {
  proposal: Proposal;
  onDecide: Decide;
  first: boolean;
  bind: (node: HTMLDivElement | null) => void;
  onMove: (delta: number) => void;
}) {
  const { t } = useI18n();
  const f = useFormat();
  const concepts = proposal.payload?.concepts ?? [];
  // a radio group with nothing selected looks broken, and the server would silently fall
  // back to the first concept anyway — so say which one that is
  const [choice, setChoice] = useState<string | null>(
    concepts[0]?.label ?? proposal.options[0] ?? null,
  );

  const decide = (status: 'approved' | 'dismissed') =>
    onDecide(proposal.id, status, choice ?? undefined);

  const SHORTCUTS: Record<string, () => void> = {
    j: () => onMove(1),
    k: () => onMove(-1),
    a: () => decide('approved'),
    x: () => decide('dismissed'),
  };

  return (
    <div
      ref={bind}
      // one tab stop for the queue; j/k move within it
      tabIndex={first ? 0 : -1}
      aria-keyshortcuts="j k a x"
      onKeyDown={(event) => {
        // the card only owns the keys while nothing inside it does
        if (event.target !== event.currentTarget) return;
        const act = SHORTCUTS[event.key.toLowerCase()];
        if (!act) return;
        event.preventDefault();
        act();
      }}
      className={cn(
        focusRing,
        'flex flex-col gap-4 border-b p-5 last:border-b-0 sm:flex-row',
      )}
    >
      {proposal.videoTitle && (
        <Thumb url={proposal.thumbnailUrl} title={proposal.videoTitle} className="w-full self-start sm:w-40" />
      )}

      <div className="min-w-0 flex-1">
        <div className="mb-2 flex flex-wrap items-center gap-2">
          <Badge variant="secondary" className="bg-primary/20 text-primary">
            {t(`proposal.${proposal.kind}`)}
          </Badge>
          <ReactionWindow proposal={proposal} />
          <span className="text-xs text-muted-foreground">{f.since(proposal.createdAt)}</span>
        </div>

        <p className="text-lg leading-snug font-medium">{proposal.summary}</p>
        <p className="bg-muted mt-3 rounded-lg px-4 py-3 text-[15px] leading-relaxed">{proposal.detail}</p>
        <p className="mt-3 text-sm text-muted-foreground">{proposal.rationale}</p>

        {concepts.length > 0 ? (
          <fieldset className="mt-4">
            <legend className="text-muted-foreground mb-2 text-xs font-semibold tracking-wide uppercase">
              {t('proposal.pick')}
            </legend>
            <div className="divide-y border-y">
              {concepts.map((concept) => (
                <ConceptRow
                  key={concept.label}
                  concept={concept}
                  name={proposal.id}
                  selected={concept.label === choice}
                  onSelect={() => setChoice(concept.label)}
                />
              ))}
            </div>
          </fieldset>
        ) : (
          proposal.options.length > 0 && (
            <div className="mt-3 flex flex-wrap gap-2">
              {proposal.options.map((option) => (
                <button
                  key={option}
                  onClick={() => setChoice(option)}
                  aria-pressed={option === choice}
                  className={cn(
                    focusRing,
                    'rounded-lg border px-3 py-2 text-sm',
                    option === choice
                      ? 'bg-foreground text-background'
                      : 'text-muted-foreground hover:text-foreground',
                  )}
                >
                  {option}
                </button>
              ))}
            </div>
          )
        )}

        <div className="mt-4 flex gap-2">
          <Button size="sm" onClick={() => decide('approved')}>
            <Check />
            {t(concepts.length > 0 ? 'proposal.commit' : 'proposal.approve')}
          </Button>
          <Button size="sm" variant="ghost" onClick={() => decide('dismissed')}>
            <X />
            {t('proposal.dismiss')}
          </Button>
        </div>
      </div>
    </div>
  );
}

/**
 * The number is the point. A concept the Mind will not put a figure against is a suggestion,
 * and the ledger has no use for suggestions — so the prediction is set beside the label, not
 * hidden behind a disclosure.
 */
function ConceptRow({
  concept,
  name,
  selected,
  onSelect,
}: {
  concept: Concept;
  name: string;
  selected: boolean;
  onSelect: () => void;
}) {
  const { t } = useI18n();
  const f = useFormat();
  const entries = Object.entries(concept.prediction);

  return (
    <label
      className={cn(
        'flex cursor-pointer gap-3 p-4 transition-colors',
        selected ? 'bg-primary/8' : 'hover:bg-accent',
      )}
    >
      <input
        type="radio"
        name={name}
        checked={selected}
        onChange={onSelect}
        className={cn(focusRing, 'accent-primary mt-1 size-4 shrink-0')}
      />
      <div className="min-w-0 flex-1">
        <div className="font-medium">{concept.label}</div>
        <p className="text-muted-foreground mt-1 text-sm text-pretty">{concept.hypothesis}</p>

        <div className="mt-3 flex flex-wrap gap-6">
          {entries.map(([metric, value]) => (
            <div key={metric}>
              <div className="text-muted-foreground text-xs">
                {t('proposal.commits')} {f.metric(metric)}
              </div>
              <div className="tabular text-primary text-lg font-semibold">
                {f.metricValue(metric, value)}
              </div>
            </div>
          ))}
        </div>
      </div>
    </label>
  );
}
