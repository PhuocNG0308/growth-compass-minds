import { useState } from 'react';
import { Bot, CircleCheck, FlaskConical, Scale, Sparkles, Timer, User } from 'lucide-react';
import { Disclosure, Empty, Failed, Group, Skeletons, Stat, Strip, StripItem } from '@/mobile/kit';
import { api } from '@/lib/api';
import { DASH, useFormat } from '@/lib/format';
import { useI18n } from '@/lib/i18n';
import { useAsync } from '@/lib/use-async';
import { cn, focusRing } from '@/lib/utils';
import type { TimelineEvent } from '@/lib/types';

const FILTERS = ['all', 'automated', 'learning', 'chat'] as const;
const LEARNING = ['experiment_opened', 'experiment_closed', 'tenet_written'];

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

export function MobileMemory() {
  const { t } = useI18n();
  const f = useFormat();
  const [filter, setFilter] = useState<(typeof FILTERS)[number]>('all');
  const [round, setRound] = useState(0);
  const [older, setOlder] = useState<TimelineEvent[]>([]);
  const [done, setDone] = useState(false);
  const { data, loading, error } = useAsync(() => api.timeline(filter === 'automated'), [filter, round]);

  if (loading) return <Skeletons />;
  if (error || !data) return <Failed onRetry={() => setRound((n) => n + 1)} />;

  const { totals } = data;
  const all = [...data.events, ...older];
  const events = all.filter((event) =>
    filter === 'learning'
      ? LEARNING.includes(event.kind)
      : filter === 'chat'
        ? event.kind.startsWith('chat_')
        : true,
  );

  async function loadOlder() {
    const last = all.at(-1);
    if (!last) return;
    const page = await api.timeline(filter === 'automated', last.at);
    setOlder((current) => [...current, ...page.events]);
    if (page.events.length === 0) setDone(true);
  }

  return (
    <>
      {/* volume only; prediction accuracy lives with the tests that produced it */}
      <Strip snap="none">
        <Stat value={totals.automated} label={t('memory.automated')} tone="lead" />
        <Stat value={totals.tenets} label={t('memory.tenets')} />
        <Stat value={totals.sessions} label={t('memory.sessions')} />
      </Strip>

      <Group title={t('memory.title')}>
        <Strip snap="none" className="pb-3">
          {FILTERS.map((key) => (
            <StripItem key={key}>
              <button
                onClick={() => {
                  setFilter(key);
                  setOlder([]);
                  setDone(false);
                }}
                aria-pressed={key === filter}
                className={cn(
                  focusRing,
                  'min-h-11 rounded-full border px-4 text-sm font-medium',
                  key === filter
                    ? 'bg-foreground text-background'
                    : 'text-muted-foreground',
                )}
              >
                {t(`memory.filter.${key}`)}
              </button>
            </StripItem>
          ))}
        </Strip>

        {events.length ? (
          <>
            {group(events).map(([day, rows]) => (
              <section key={day} className="mb-6">
                <h3 className="text-muted-foreground bg-background/90 sticky top-[var(--chrome)] z-10 px-4 py-2 text-xs font-semibold tracking-wide uppercase backdrop-blur">
                  {f.longDate(day)}
                </h3>
                <div className="divide-y border-y">
                  {rows.map((event) => (
                    <Row key={`${event.kind}-${event.refId}-${event.at}`} event={event} />
                  ))}
                </div>
              </section>
            ))}
            {!done && (
              <button
                onClick={loadOlder}
                className={cn(focusRing, 'text-primary min-h-12 w-full text-sm font-medium')}
              >
                {t('memory.more')}
              </button>
            )}
          </>
        ) : (
          <Empty>{t('memory.empty')}</Empty>
        )}
      </Group>
    </>
  );
}

function Row({ event }: { event: TimelineEvent }) {
  const { t } = useI18n();
  const f = useFormat();
  const Icon = ICONS[event.kind] ?? Timer;
  const backing = (event.detail.backing as string[] | undefined) ?? [];

  return (
    <div className="flex gap-3 px-4 py-4">
      <Icon
        className={cn('mt-1 size-4 shrink-0', event.automated ? 'text-primary' : 'text-muted-foreground')}
      />
      <div className="min-w-0 flex-1">
        <div className="flex items-start gap-2">
          <span className="flex-1 text-[15px] leading-snug font-medium">{headline(event, f, t)}</span>
          <span className="text-muted-foreground shrink-0 text-xs">{f.since(event.at)}</span>
        </div>

        {event.automated && (
          <span className="bg-primary/12 text-primary mt-1 inline-block rounded-full px-2 py-1 text-[11px] font-semibold">
            {t('memory.unattended')}
          </span>
        )}

        <p className="text-muted-foreground mt-1 line-clamp-3 text-sm text-pretty">
          {body(event, f, t)}
        </p>

        {backing.length > 0 && (
          <Disclosure
            label={t('memory.showBacking', { n: String(backing.length) })}
            openLabel={t('memory.hideBacking')}
          >
            <ul className="text-muted-foreground space-y-2 border-l pl-3 text-sm">
              {backing.map((line) => (
                <li key={line}>{line}</li>
              ))}
            </ul>
          </Disclosure>
        )}
      </div>
    </div>
  );
}

type Fmt = ReturnType<typeof useFormat>;
type T = ReturnType<typeof useI18n>['t'];

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
      : `${t('memory.predicted', { ctr: f.pct(ctr), avp: f.pct(avp) })} · ${event.title}`;
  }
  if (event.kind === 'experiment_closed') {
    const delta = detail.ctrDelta as number | null;
    return delta == null
      ? event.title
      : `${t('memory.against', {
          actual: f.pct(detail.actualCtr as number | null),
          predicted: f.pct(detail.predictedCtr as number | null),
          delta: delta > 0 ? `+${f.dec(delta, 2)}` : f.dec(delta, 2),
        })} · ${event.title}`;
  }
  if (event.kind === 'checkpoint_observed') return (detail.summary as string | null) ?? event.title;
  if (event.kind.startsWith('chat_')) return (detail.excerpt as string | null) ?? DASH;
  if (event.kind === 'tenet_written') {
    return `${event.title} — ${t('memory.evidence', { n: String(detail.evidenceCount ?? 0) })}`;
  }
  return event.title;
}

function group(events: TimelineEvent[]): Array<[string, TimelineEvent[]]> {
  const days = new Map<string, TimelineEvent[]>();
  for (const event of events) {
    const day = event.at.slice(0, 10);
    days.set(day, [...(days.get(day) ?? []), event]);
  }
  return [...days];
}
