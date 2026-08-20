import { Badge } from '@/components/ui/badge';
import { Thumb } from '@/components/thumb';
import { useFormat } from '@/lib/format';
import { useI18n } from '@/lib/i18n';
import { cn } from '@/lib/utils';
import type { OpenExperiment, SettledExperiment, Verdict } from '@/lib/types';

export function RunningExperiment({ experiment }: { experiment: OpenExperiment }) {
  const { t } = useI18n();
  const f = useFormat();

  return (
    <article className="flex flex-col gap-4 border-b p-5 last:border-b-0 sm:flex-row">
      {experiment.video && (
        <Thumb
          url={experiment.video.thumbnailUrl}
          title={experiment.video.title}
          className="w-full self-start sm:w-40"
        />
      )}

      <div className="min-w-0 flex-1">
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <Badge variant="secondary" className="bg-primary/20 text-primary">
          {f.lever(experiment.lever)}
        </Badge>
        <span className="text-sm text-muted-foreground">
          {experiment.video ? experiment.video.title : t('exp.notPublished')}
        </span>
      </div>

      <h3 className="mb-4 max-w-[62ch] text-lg leading-snug font-medium">{experiment.hypothesis}</h3>

      <div className="flex flex-wrap gap-x-8 gap-y-2">
        {Object.entries(experiment.prediction).map(([key, value]) => (
          <div key={key}>
            <div className="text-xs text-muted-foreground">{f.metric(key)}</div>
            <div className="tabular text-lg">{f.metricValue(key, value)}</div>
          </div>
        ))}
      </div>

      <div className="mt-4 flex flex-wrap gap-2">
        {experiment.checkpoints.length === 0 ? (
          <Badge variant="outline" className="font-normal">
            {t('exp.noCheckpoints')}
          </Badge>
        ) : (
          experiment.checkpoints.map((cp) => (
            <Badge
              key={cp.id}
              variant="secondary"
              className={cn(
                'font-normal',
                cp.overdue && 'bg-warning/15 text-warning border-warning/30 border',
              )}
            >
              <span className="tabular font-medium">{f.checkpoint(cp.kind)}</span>
              <span className="text-muted-foreground">{f.since(cp.dueAt)}</span>
            </Badge>
          ))
        )}
      </div>
      </div>
    </article>
  );
}

const VERDICT_STYLE: Record<Verdict, string> = {
  confirmed: 'bg-primary/20 text-primary border-primary/35',
  refuted: 'bg-destructive/20 text-destructive border-destructive/35',
  inconclusive: 'bg-muted text-muted-foreground',
};

export function SettledExperimentCard({ experiment }: { experiment: SettledExperiment }) {
  const { t } = useI18n();
  const f = useFormat();
  const verdict: Verdict = experiment.verdict ?? 'inconclusive';

  return (
    <article className="border-b p-5 last:border-b-0">
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <Badge variant="secondary" className="bg-primary/20 text-primary">
          {f.lever(experiment.lever)}
        </Badge>
        <Badge variant="outline" className={cn('border', VERDICT_STYLE[verdict])}>
          {t(`exp.${verdict}`)}
        </Badge>
        <span className="text-sm text-muted-foreground">{f.shortDate(experiment.closedAt)}</span>
      </div>

      <h3 className="mb-4 max-w-[62ch] text-lg leading-snug font-medium">{experiment.hypothesis}</h3>

      <div className="space-y-4">
        {Object.entries(experiment.prediction).map(([key, predicted]) => (
          <Gauge
            key={key}
            metric={key}
            predicted={predicted}
            actual={typeof experiment.outcome?.[key] === 'number' ? (experiment.outcome[key] as number) : null}
          />
        ))}
      </div>
    </article>
  );
}

function Gauge({ metric, predicted, actual }: { metric: string; predicted: number; actual: number | null }) {
  const f = useFormat();
  const scale = Math.max(predicted, actual ?? 0) * 1.3 || 1;
  const at = (value: number) => `${Math.min(Math.max((value / scale) * 100, 0), 100).toFixed(1)}%`;
  const over = actual != null && actual >= predicted;
  const delta = actual == null || !predicted ? null : ((actual - predicted) / predicted) * 100;

  return (
    <div className="grid items-center gap-x-4 gap-y-2 sm:grid-cols-[8rem_1fr_auto]">
      <span className="text-sm text-muted-foreground">{f.metric(metric)}</span>

      <span className="relative flex h-4 items-center">
        <span className="bg-muted h-2 w-full rounded-full" />
        <i
          className="bg-muted-foreground absolute h-4 w-1 -translate-x-1/2 rounded-full"
          style={{ left: at(predicted) }}
        />
        {actual != null && (
          <i
            className={cn(
              'ring-card absolute size-4 -translate-x-1/2 rounded-full ring-2',
              over ? 'bg-primary' : 'bg-destructive',
            )}
            style={{ left: at(actual) }}
          />
        )}
      </span>

      <span className="tabular text-sm whitespace-nowrap text-muted-foreground">
        <b className="font-medium text-foreground">{f.metricValue(metric, actual)}</b>
        {' / '}
        {f.metricValue(metric, predicted)}
        {delta != null && (
          <span className={cn('ml-2', over ? 'text-primary' : 'text-destructive')}>
            {delta >= 0 ? '+' : '−'}
            {f.dec(Math.abs(delta), 0)}%
          </span>
        )}
      </span>
    </div>
  );
}
