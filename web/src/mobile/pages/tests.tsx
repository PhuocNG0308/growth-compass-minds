import { useState } from 'react';
import { Trend, type TrendPoint } from '@/components/trend';
import { Thumb } from '@/components/thumb';
import { Empty, Failed, Fold, Group, Skeletons, Stat, Strip } from '@/mobile/kit';
import { api } from '@/lib/api';
import { useFormat } from '@/lib/format';
import { useI18n } from '@/lib/i18n';
import { useAsync } from '@/lib/use-async';
import { cn } from '@/lib/utils';
import type { Me, OpenExperiment, Rule, ScoredExperiment, SettledExperiment } from '@/lib/types';

const THRESHOLD = 3;

export function MobileTests({ me }: { me: Me }) {
  const { t } = useI18n();
  const [round, setRound] = useState(0);
  const { data, loading, error } = useAsync(() => api.ledger(), [round]);
  const { counts } = me;

  if (error) return <Failed onRetry={() => setRound((n) => n + 1)} />;

  return (
    <>
      {/* five tiles stacked is a wall of numbers; flicked through, it is a summary */}
      <Strip snap="none">
        <Stat value={counts.running} label={t('stat.running')} tone="lead" />
        <Stat value={counts.overdue} label={t('stat.overdue')} tone={counts.overdue > 0 ? 'alert' : undefined} />
        <Stat value={counts.settled} label={t('stat.settled')} />
        <Stat value={counts.tenets} label={t('stat.rules')} />
        <Stat value={counts.videos} label={t('stat.videos')} />
      </Strip>

      {data && data.scores.length >= 2 && (
        <Group title={t('section.accuracy')}>
          <div className="bg-card mx-4 rounded-2xl border p-4">
            <Accuracy scores={data.scores} />
          </div>
        </Group>
      )}

      {loading ? (
        <div className="mt-8">
          <Skeletons rows={2} />
        </div>
      ) : (
        <div className="mt-8">
          {/* only the thing you came for is open */}
          <Fold title={t('section.running')} count={data?.openExperiments.length} defaultOpen>
            {data?.openExperiments.length ? (
              <div className="space-y-3 px-4 pt-3">
                {data.openExperiments.map((experiment) => (
                  <Running key={experiment.id} experiment={experiment} />
                ))}
              </div>
            ) : (
              <Empty>{t('empty.running')}</Empty>
            )}
          </Fold>

          <Fold title={t('section.settled')} count={data?.settledExperiments.length}>
            {data?.settledExperiments.length ? (
              <div className="space-y-3 px-4 pt-3">
                {data.settledExperiments.map((experiment, index) => (
                  <Settled key={index} experiment={experiment} />
                ))}
              </div>
            ) : (
              <Empty>{t('empty.settled')}</Empty>
            )}
          </Fold>

          <Fold title={t('section.tenets')} count={data?.channelRules.tenets.length}>
            <p className="text-muted-foreground px-4 pt-2 pb-1 text-xs">
              {t('rule.hint', { n: THRESHOLD })}
            </p>
            {data?.channelRules.tenets.length ? (
              <div className="divide-y border-t">
                {data.channelRules.tenets.map((rule) => (
                  <RuleRow key={rule.id} rule={rule} />
                ))}
              </div>
            ) : (
              <Empty>{t('empty.tenets')}</Empty>
            )}
          </Fold>

          <Fold title={t('section.candidates')} count={data?.channelRules.candidates.length}>
            {data?.channelRules.candidates.length ? (
              <div className="divide-y border-t">
                {data.channelRules.candidates.map((rule) => (
                  <RuleRow key={rule.id} rule={rule} />
                ))}
              </div>
            ) : (
              <Empty>{t('empty.candidates')}</Empty>
            )}
          </Fold>
        </div>
      )}
    </>
  );
}

function Accuracy({ scores }: { scores: ScoredExperiment[] }) {
  const { t } = useI18n();
  const f = useFormat();

  return (
    <Trend
      points={scores.map<TrendPoint>((score) => ({
        label: f.shortDate(score.closedAt),
        value: Math.abs(score.ctrDelta ?? 0),
      }))}
      caption={t('chart.accuracy')}
      format={(value) => (value == null ? '' : f.dec(value, 2))}
    />
  );
}

function Running({ experiment }: { experiment: OpenExperiment }) {
  const { t } = useI18n();
  const f = useFormat();
  const next = experiment.checkpoints.find((checkpoint) => !checkpoint.overdue);
  const overdue = experiment.checkpoints.filter((checkpoint) => checkpoint.overdue).length;

  return (
    <article className="bg-card rounded-2xl border p-4">
      <div className="flex items-center gap-2">
        <span className="bg-muted rounded-full px-3 py-1 text-xs font-semibold">
          {f.lever(experiment.lever)}
        </span>
        {overdue > 0 && (
          <span className="bg-warning/15 text-warning rounded-full px-3 py-1 text-xs font-semibold">
            {t('stat.overdue')} {overdue}
          </span>
        )}
      </div>

      <p className="mt-2 leading-snug font-medium text-pretty">{experiment.hypothesis}</p>

      {experiment.video && (
        <div className="mt-3 flex items-center gap-3">
          <Thumb url={experiment.video.thumbnailUrl} title={experiment.video.title} className="w-16" />
          <span className="text-muted-foreground line-clamp-2 text-xs">{experiment.video.title}</span>
        </div>
      )}

      <div className="mt-3 flex flex-wrap gap-4">
        {Object.entries(experiment.prediction).map(([metric, value]) => (
          <div key={metric}>
            <div className="text-muted-foreground text-[11px]">{f.metric(metric)}</div>
            <div className="tabular text-primary mt-1 font-semibold">
              {f.metricValue(metric, value)}
            </div>
          </div>
        ))}
      </div>

      <p className="text-muted-foreground mt-3 text-xs">
        {next
          ? t('exp.next', { at: f.checkpoint(next.kind), when: f.since(next.dueAt) })
          : t('exp.waiting')}
      </p>
    </article>
  );
}

function Settled({ experiment }: { experiment: SettledExperiment }) {
  const { t } = useI18n();
  const f = useFormat();
  const verdict = experiment.verdict ?? 'inconclusive';

  return (
    <article className="bg-card rounded-2xl border p-4">
      <div className="flex flex-wrap items-center gap-2">
        <span className="bg-muted rounded-full px-3 py-1 text-xs font-semibold">
          {f.lever(experiment.lever)}
        </span>
        <span
          className={cn(
            'rounded-full px-3 py-1 text-xs font-semibold',
            verdict === 'confirmed' && 'bg-success/12 text-success',
            verdict === 'refuted' && 'bg-destructive/12 text-destructive',
            verdict === 'inconclusive' && 'bg-muted text-muted-foreground',
          )}
        >
          {t(`exp.${verdict}`)}
        </span>
        <span className="text-muted-foreground ml-auto text-xs">{f.shortDate(experiment.closedAt)}</span>
      </div>

      <p className="mt-2 leading-snug font-medium text-pretty">{experiment.hypothesis}</p>

      <div className="mt-3 divide-y border-t">
        {Object.entries(experiment.prediction).map(([metric, predicted]) => {
          const actual = experiment.outcome?.[metric];
          const real = typeof actual === 'number' ? actual : null;
          const delta = real == null ? null : real - predicted;

          return (
            <div key={metric} className="flex items-baseline gap-3 pt-2 pb-2 first:pt-3">
              <span className="text-muted-foreground flex-1 text-xs">{f.metric(metric)}</span>
              <span className="tabular text-muted-foreground text-sm">
                {f.metricValue(metric, predicted)}
              </span>
              <span className="text-muted-foreground text-xs">→</span>
              <span className="tabular text-sm font-semibold">{f.metricValue(metric, real)}</span>
              {delta != null && (
                <span
                  className={cn(
                    'tabular w-14 text-right text-xs font-medium',
                    delta >= 0 ? 'text-primary' : 'text-destructive',
                  )}
                >
                  {delta >= 0 ? '+' : ''}
                  {f.dec(delta, 1)}
                </span>
              )}
            </div>
          );
        })}
      </div>
    </article>
  );
}

function RuleRow({ rule }: { rule: Rule }) {
  const { t } = useI18n();

  return (
    <div className="px-4 py-4">
      <p className="leading-snug text-pretty">{rule.statement}</p>
      <div className="mt-2 flex items-center gap-2">
        {rule.isTenet && (
          <span className="bg-primary/15 text-primary rounded-full px-3 py-1 text-xs font-semibold">
            {t('rule.inSoul')}
          </span>
        )}
        <span className="text-muted-foreground text-xs">
          {t('rule.evidence', { n: rule.evidenceCount })}
          {rule.contradictionCount > 0 && ` · ${t('rule.against', { n: rule.contradictionCount })}`}
        </span>
      </div>
    </div>
  );
}
