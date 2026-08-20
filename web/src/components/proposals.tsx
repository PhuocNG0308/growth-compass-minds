import { useState } from 'react';
import { Check, X } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Thumb } from '@/components/thumb';
import { api } from '@/lib/api';
import { useFormat } from '@/lib/format';
import { useI18n } from '@/lib/i18n';
import type { Proposal } from '@/lib/types';

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
  const [busy, setBusy] = useState(false);
  const [choice, setChoice] = useState<string | null>(proposal.options[0] ?? null);

  async function decide(status: 'approved' | 'dismissed') {
    setBusy(true);
    try {
      await api.decide(proposal.id, status, choice ?? undefined);
      onDecided();
    } finally {
      setBusy(false);
    }
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

        {proposal.options.length > 0 && (
          <div className="mt-3 flex flex-wrap gap-2">
            {proposal.options.map((option) => (
              <button
                key={option}
                onClick={() => setChoice(option)}
                className={
                  option === choice
                    ? 'border-primary bg-primary/12 text-primary rounded-lg border px-3 py-2 text-sm'
                    : 'text-muted-foreground hover:text-foreground rounded-lg border px-3 py-2 text-sm'
                }
              >
                {option}
              </button>
            ))}
          </div>
        )}

        <div className="mt-4 flex gap-2">
          <Button size="sm" disabled={busy} onClick={() => decide('approved')}>
            <Check />
            {t('proposal.approve')}
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
