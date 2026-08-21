import { useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { RunningExperiment, SettledExperimentCard } from '@/components/experiment';
import { Empty, Failed, List, Loading, SectionTitle } from '@/components/shell';
import { Trend, type TrendPoint } from '@/components/trend';
import { StatGrid } from '@/components/stats';
import { api } from '@/lib/api';
import { useFormat } from '@/lib/format';
import { useI18n } from '@/lib/i18n';
import { useAsync } from '@/lib/use-async';
import { cn } from '@/lib/utils';
import type { Me, Rule, ScoredExperiment } from '@/lib/types';

const THRESHOLD = 3;

export function Lab({ me }: { me: Me }) {
  const { t } = useI18n();
  const [round, setRound] = useState(0);
  const { data, loading, error } = useAsync(() => api.ledger(), [round]);
  const { counts } = me;

  if (error) return <Failed onRetry={() => setRound((n) => n + 1)} />;

  return (
    <>
      <StatGrid
        stats={[
          { value: counts.videos, label: t('stat.videos') },
          { value: counts.running, label: t('stat.running') },
          { value: counts.settled, label: t('stat.settled') },
          { value: counts.overdue, label: t('stat.overdue'), alert: counts.overdue > 0 },
          { value: counts.tenets, label: t('stat.rules') },
        ]}
      />

      {data && data.scores.length >= 2 && (
        <>
          <SectionTitle>{t('section.accuracy')}</SectionTitle>
          <div className="border-y py-5">
            <Accuracy scores={data.scores} />
          </div>
        </>
      )}

      <SectionTitle>{t('section.running')}</SectionTitle>
      {loading ? (
        <Loading rows={2} height="h-32" />
      ) : data?.openExperiments.length ? (
        <List>
          {data.openExperiments.map((experiment) => (
            <RunningExperiment key={experiment.id} experiment={experiment} />
          ))}
        </List>
      ) : (
        <Empty>{t('empty.running')}</Empty>
      )}

      <SectionTitle>{t('section.settled')}</SectionTitle>
      {data?.settledExperiments.length ? (
        <List>
          {data.settledExperiments.map((experiment, i) => (
            <SettledExperimentCard key={i} experiment={experiment} />
          ))}
        </List>
      ) : (
        loading ? <Loading rows={1} height="h-24" /> : <Empty>{t('empty.settled')}</Empty>
      )}

      <SectionTitle>{t('section.tenets')}</SectionTitle>
      <p className="text-muted-foreground -mt-1 mb-3 text-sm">{t('rule.hint', { n: THRESHOLD })}</p>
      {data?.channelRules.tenets.length ? (
        <List>
          {data.channelRules.tenets.map((rule) => (
            <RuleRow key={rule.id} rule={rule} />
          ))}
        </List>
      ) : (
        loading ? <Loading rows={1} height="h-24" /> : <Empty>{t('empty.tenets')}</Empty>
      )}

      <SectionTitle>{t('section.candidates')}</SectionTitle>
      {data?.channelRules.candidates.length ? (
        <List>
          {data.channelRules.candidates.map((rule) => (
            <RuleRow key={rule.id} rule={rule} />
          ))}
        </List>
      ) : (
        loading ? <Loading rows={1} height="h-24" /> : <Empty>{t('empty.candidates')}</Empty>
      )}
    </>
  );
}

/**
 * Absolute error per settled test, oldest first. A downward line is the product's whole
 * claim, and it needs one series to say it — predicted and actual as two lines would put
 * the reader in charge of subtracting.
 */
function Accuracy({ scores }: { scores: ScoredExperiment[] }) {
  const { t } = useI18n();
  const f = useFormat();

  const points: TrendPoint[] = scores.map((score) => ({
    label: f.shortDate(score.closedAt),
    value: Math.abs(score.ctrDelta ?? 0),
  }));

  return (
    <Trend
      points={points}
      caption={t('chart.accuracy')}
      format={(value) => (value == null ? '' : f.dec(value, 2))}
    />
  );
}

function RuleRow({ rule }: { rule: Rule }) {
  const { t } = useI18n();

  return (
    <div className="flex flex-wrap items-center gap-x-6 gap-y-3 p-5">
      <p className="flex-1 basis-72 leading-relaxed">{rule.statement}</p>

      <div className="ml-auto flex items-center gap-3">
        {rule.isTenet ? (
          <Badge variant="outline" className="bg-primary/20 text-primary border-primary/35">
            {t('rule.inSoul')}
          </Badge>
        ) : (
          <span className="flex gap-1">
            {Array.from({ length: THRESHOLD }, (_, i) => (
              <i
                key={i}
                className={cn('h-2 w-6 rounded-full', i < rule.evidenceCount ? 'bg-primary' : 'bg-border')}
              />
            ))}
          </span>
        )}
        <span className="text-muted-foreground text-xs whitespace-nowrap">
          {t('rule.evidence', { n: rule.evidenceCount })}
          {rule.contradictionCount > 0 && (
            <span className="text-destructive"> · {t('rule.against', { n: rule.contradictionCount })}</span>
          )}
        </span>
      </div>
    </div>
  );
}
