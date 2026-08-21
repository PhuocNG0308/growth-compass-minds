import { useState } from 'react';
import {
  Bot,
  CircleCheck,
  FlaskConical,
  Scale,
  Sparkles,
  Timer,
  User,
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Chips, Empty, Failed, List, Loading, SectionTitle } from '@/components/shell';
import { StatGrid } from '@/components/stats';
import { api } from '@/lib/api';
import { DASH, useFormat } from '@/lib/format';
import { useI18n } from '@/lib/i18n';
import { useAsync } from '@/lib/use-async';
import { cn, focusRing } from '@/lib/utils';
import type { TimelineEvent } from '@/lib/types';

const FILTERS = ['all', 'automated', 'learning', 'chat'] as const;
type Filter = (typeof FILTERS)[number];

const LEARNING_KINDS = ['experiment_opened', 'experiment_closed', 'tenet_written'];

const ICONS: Record<string, typeof Timer> = {
  experiment_opened: FlaskConical,
  experiment_closed: Scale,
  checkpoint_fired: Timer,
  checkpoint_observed: CircleCheck,
  tenet_written: Sparkles,
  proposal_decided: CircleCheck,
  chat_creator: User,
  chat_mind: Bot,
};

export function Memory() {
  const { t } = useI18n();
  const f = useFormat();
  const [filter, setFilter] = useState<Filter>('all');
  const [round, setRound] = useState(0);
  const [older, setOlder] = useState<TimelineEvent[]>([]);
  const [exhausted, setExhausted] = useState(false);
  const { data, loading, error } = useAsync(
    () => api.timeline(filter === 'automated'),
    [filter, round],
  );

  if (loading) return <Loading rows={3} />;
  if (error || !data) return <Failed onRetry={() => setRound((n) => n + 1)} />;

  const { accuracy, totals } = data;
  const all = [...data.events, ...older];

  async function loadOlder() {
    const last = all.at(-1);
    if (!last) return;
    const page = await api.timeline(filter === 'automated', last.at);
    setOlder((current) => [...current, ...page.events]);
    if (page.events.length === 0) setExhausted(true);
  }

  const events = all.filter((event) =>
    filter === 'learning'
      ? LEARNING_KINDS.includes(event.kind)
      : filter === 'chat'
        ? event.kind.startsWith('chat_')
        : true,
  );

  return (
    <>
      <StatGrid
        stats={[
          { value: totals.sessions, label: t('memory.sessions') },
          { value: accuracy.graded, label: t('memory.graded') },
          { value: f.dec(accuracy.meanAbsCtrError, 2), label: t('memory.error'), lead: true },
          { value: totals.automated, label: t('memory.automated') },
          { value: totals.tenets, label: t('memory.tenets') },
        ]}
      />

      <p className="text-muted-foreground mt-4 text-[15px] text-pretty">{trend(accuracy, f, t)}</p>

      <SectionTitle>{t('memory.title')}</SectionTitle>
      <Chips
        options={FILTERS.map((key) => ({ key, label: t(`memory.filter.${key}`) }))}
        value={filter}
        onChange={(key) => {
          setFilter(key as Filter);
          setOlder([]);
          setExhausted(false);
        }}
      />

      {events.length ? (
        <div className="space-y-8">
          {group(events).map(([day, rows]) => (
            <section key={day}>
              <h3 className="text-muted-foreground mb-2 text-xs font-semibold tracking-wide uppercase">
                {f.longDate(day)}
              </h3>
              <List>
                {rows.map((event) => (
                  <Event key={`${event.kind}-${event.refId}-${event.at}`} event={event} />
                ))}
              </List>
            </section>
          ))}
        </div>
      ) : (
        <Empty>{t('memory.empty')}</Empty>
      )}

      {events.length > 0 && !exhausted && (
        <button
          onClick={loadOlder}
          className={cn(
            focusRing,
            'text-muted-foreground hover:text-foreground mt-6 w-full rounded-md py-4 text-sm font-medium',
          )}
        >
          {t('memory.more')}
        </button>
      )}
    </>
  );
}

function Event({ event }: { event: TimelineEvent }) {
  const { t } = useI18n();
  const f = useFormat();
  const [open, setOpen] = useState(false);
  const Icon = ICONS[event.kind] ?? Timer;
  const backing = (event.detail.backing as string[] | undefined) ?? [];

  return (
    <div className="flex gap-4 py-4">
      <Icon
        className={cn('mt-1 size-4 shrink-0', event.automated ? 'text-primary' : 'text-muted-foreground')}
      />

      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-[15px] font-medium">{headline(event, f, t)}</span>
          {event.automated && (
            <Badge variant="secondary" className="text-primary">
              {t('memory.unattended')}
            </Badge>
          )}
          <span className="text-muted-foreground ml-auto shrink-0 text-xs">
            {f.since(event.at)}
          </span>
        </div>

        <p className="text-muted-foreground mt-1 text-sm text-pretty">{body(event, f, t)}</p>

        {backing.length > 0 && (
          <>
            <button
              onClick={() => setOpen((on) => !on)}
              aria-expanded={open}
              className={cn(focusRing, 'text-primary mt-2 rounded-md text-xs font-medium')}
            >
              {t(open ? 'memory.hideBacking' : 'memory.showBacking', { n: String(backing.length) })}
            </button>
            {open && (
              <ul className="text-muted-foreground mt-2 space-y-1 border-l pl-4 text-sm">
                {backing.map((line) => (
                  <li key={line}>{line}</li>
                ))}
              </ul>
            )}
          </>
        )}
      </div>
    </div>
  );
}

type Fmt = ReturnType<typeof useFormat>;
type T = ReturnType<typeof useI18n>['t'];

/** The claim in words, because a row of numbers does not say whether it is working. */
function trend(accuracy: TimelineData['accuracy'], f: Fmt, t: T): string {
  if (accuracy.graded === 0) return t('memory.trendNone');
  if (accuracy.recentAbsCtrError == null || accuracy.earlierAbsCtrError == null) {
    return t('memory.trendThin', { error: f.dec(accuracy.meanAbsCtrError, 2) });
  }

  const key =
    accuracy.recentAbsCtrError < accuracy.earlierAbsCtrError
      ? 'memory.trendBetter'
      : 'memory.trendWorse';

  return t(key, {
    recent: f.dec(accuracy.recentAbsCtrError, 2),
    earlier: f.dec(accuracy.earlierAbsCtrError, 2),
  });
}

function headline(event: TimelineEvent, f: Fmt, t: T): string {
  const detail = event.detail;

  if (event.kind === 'experiment_opened') {
    return t('memory.opened', { lever: f.lever(String(detail.lever ?? '')) });
  }
  if (event.kind === 'experiment_closed') {
    return t('memory.closed', { verdict: t(`exp.${String(detail.verdict)}`) });
  }
  if (event.kind === 'checkpoint_fired') {
    return t('memory.fired', { at: f.checkpoint(String(detail.checkpoint)) });
  }
  if (event.kind === 'checkpoint_observed') {
    return t('memory.observed', { at: f.checkpoint(String(detail.checkpoint)) });
  }
  if (event.kind === 'proposal_decided') {
    return t(detail.status === 'approved' ? 'memory.approved' : 'memory.dismissed');
  }
  if (event.kind === 'tenet_written') return t('memory.tenet');
  return t(event.kind === 'chat_mind' ? 'memory.mindSaid' : 'memory.youAsked');
}

function body(event: TimelineEvent, f: Fmt, t: T): string {
  const detail = event.detail;

  if (event.kind === 'experiment_opened') {
    const ctr = detail.predictedCtr as number | null;
    const avp = detail.predictedAvp as number | null;
    return ctr == null && avp == null
      ? event.title
      : t('memory.predicted', { ctr: f.pct(ctr), avp: f.pct(avp) }) + ` · ${event.title}`;
  }

  if (event.kind === 'experiment_closed') {
    const delta = detail.ctrDelta as number | null;
    return delta == null
      ? event.title
      : t('memory.against', {
          actual: f.pct(detail.actualCtr as number | null),
          predicted: f.pct(detail.predictedCtr as number | null),
          delta: delta > 0 ? `+${f.dec(delta, 2)}` : f.dec(delta, 2),
        }) + ` · ${event.title}`;
  }

  if (event.kind === 'checkpoint_observed') {
    return (detail.summary as string | null) ?? event.title;
  }

  if (event.kind.startsWith('chat_')) return (detail.excerpt as string | null) ?? DASH;

  if (event.kind === 'tenet_written') {
    return `${event.title} — ${t('memory.evidence', { n: String(detail.evidenceCount ?? 0) })}`;
  }

  return event.title;
}

/** Grouped by calendar day so the trail reads as a diary rather than a log file. */
function group(events: TimelineEvent[]): Array<[string, TimelineEvent[]]> {
  const days = new Map<string, TimelineEvent[]>();
  for (const event of events) {
    const day = event.at.slice(0, 10);
    days.set(day, [...(days.get(day) ?? []), event]);
  }
  return [...days];
}

type TimelineData = Awaited<ReturnType<typeof api.timeline>>;
