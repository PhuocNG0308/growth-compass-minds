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
  confirmed: 'bg-success/12 text-success border-success/35',
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

      <p className="text-muted-foreground mt-3 text-xs">{t('exp.gaugeKey', { n: MISS * 100 })}</p>
    </article>
  );
}

// the half-track: a prediction this far out sits at the end of it, and further out stays there
const MISS = 0.6;

/**
 * Per-row scaling put the committed number in a different place on every row, so a 2% miss
 * and a 40% miss looked alike. The scale is the miss itself: centre is always the prediction.
 */
function Gauge({ metric, predicted, actual }: { metric: string; predicted: number; actual: number | null }) {
  const { t } = useI18n();
  const f = useFormat();
  const off = actual == null || !predicted ? null : (actual - predicted) / predicted;
  const over = off != null && off >= 0;
  const at = off == null ? 50 : 50 + (Math.max(Math.min(off, MISS), -MISS) / MISS) * 50;

  return (
    <div className="grid items-center gap-x-4 gap-y-2 sm:grid-cols-[8rem_1fr_auto]">
      <span className="text-sm text-muted-foreground">{f.metric(metric)}</span>

      <span className="relative flex h-4 items-center">
        <span className="bg-muted h-2 w-full rounded-full" />
        <i
          aria-hidden
          className="bg-muted-foreground absolute left-1/2 h-4 w-1 -translate-x-1/2 rounded-full"
        />
        {off != null && (
          <i
            title={t('exp.gaugeOff', { n: f.dec(Math.abs(off) * 100, 0) })}
            className={cn(
              'ring-card absolute size-4 -translate-x-1/2 rounded-full ring-2',
              over ? 'bg-success' : 'bg-destructive',
            )}
            style={{ left: `${at.toFixed(1)}%` }}
          />
        )}
      </span>

      <span className="tabular text-sm whitespace-nowrap text-muted-foreground">
        <b className="font-medium text-foreground">{f.metricValue(metric, actual)}</b>
        {' / '}
        {f.metricValue(metric, predicted)}
        {off != null && (
          <span className={cn('ml-2', over ? 'text-primary' : 'text-destructive')}>
            {over ? '+' : '−'}
            {f.dec(Math.abs(off) * 100, 0)}%
          </span>
        )}
      </span>
    </div>
  );
}
