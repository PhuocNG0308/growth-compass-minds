import { useState } from 'react';
import { Check, X } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Thumb } from '@/components/thumb';
import { useToast } from '@/components/toast';
import { api } from '@/lib/api';
import { useFormat } from '@/lib/format';
import { useI18n } from '@/lib/i18n';
import { cn, focusRing } from '@/lib/utils';
import type { Concept, Proposal } from '@/lib/types';

export function ProposalList({ proposals, onDecided }: { proposals: Proposal[]; onDecided: () => void }) {
  return (
    <Card className="gap-0 py-0">
      {proposals.map((proposal) => (
        <ProposalRow key={proposal.id} proposal={proposal} onDecided={onDecided} />
      ))}
    </Card>
  );
}

function ProposalRow({ proposal, onDecided }: { proposal: Proposal; onDecided: () => void }) {
  const { t } = useI18n();
  const f = useFormat();
  const notify = useToast();
  const [busy, setBusy] = useState(false);
  const concepts = proposal.payload?.concepts ?? [];
  // a radio group with nothing selected looks broken, and the server would silently fall
  // back to the first concept anyway — so say which one that is
  const [choice, setChoice] = useState<string | null>(
    concepts[0]?.label ?? proposal.options[0] ?? null,
  );

  async function decide(status: 'approved' | 'dismissed') {
    setBusy(true);
    try {
      const result = await api.decide(proposal.id, status, choice ?? undefined);
      if (result.opened) {
        notify(
          result.opened.checkpoints > 0
            ? t('proposal.opened', { n: String(result.opened.checkpoints) })
            : t('proposal.openedUnattached'),
        );
      }
      onDecided();
    } catch {
      notify(t('proposal.failed'), 'error');
      setBusy(false);
      return;
    }
    setBusy(false);
  }

  return (
    <div className="flex flex-col gap-4 border-b p-5 last:border-b-0 sm:flex-row">
      {proposal.videoTitle && (
        <Thumb url={proposal.thumbnailUrl} title={proposal.videoTitle} className="w-full self-start sm:w-40" />
      )}

      <div className="min-w-0 flex-1">
        <div className="mb-2 flex flex-wrap items-center gap-2">
          <Badge variant="secondary" className="bg-primary/20 text-primary">
            {t(`proposal.${proposal.kind}`)}
          </Badge>
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
                      ? 'border-primary bg-primary/12 text-primary'
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
          <Button size="sm" disabled={busy} onClick={() => decide('approved')}>
            <Check />
            {t(concepts.length > 0 ? 'proposal.commit' : 'proposal.approve')}
          </Button>
          <Button size="sm" variant="ghost" disabled={busy} onClick={() => decide('dismissed')}>
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
