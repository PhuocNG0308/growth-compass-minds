import { useState, type ReactNode } from 'react';
import { FastForward, SlidersHorizontal } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Failed, Loading } from '@/components/shell';
import { Sheet } from '@/mobile/kit';
import { api, MIND_STATES, type Sandbox } from '@/lib/api';
import { useI18n, type Translate } from '@/lib/i18n';
import { useAsync } from '@/lib/use-async';
import { cn, focusRing } from '@/lib/utils';

const TABS = ['time', 'mind', 'data'] as const;
type Tab = (typeof TABS)[number];

/**
 * The states this product spends most of its life in take a day to arrive: a checkpoint at
 * 24h, a Mind that has run out of cognition, a stream that happens to be on air. Anyone
 * evaluating it has minutes. These are the switches that put it in one of those states now.
 *
 * Every action reloads the page. The alternative is a refetch channel threaded through every
 * screen for the sake of a demo tool, and a stale figure left on screen after a switch is
 * flipped is worse than a reload nobody is surprised by.
 */
export function SandboxStudio({ mobile }: { mobile: boolean }) {
  const { t } = useI18n();
  const [resumed] = useState(resume);
  const [open, setOpen] = useState(resumed !== null);
  const [tab, setTab] = useState<Tab>(resumed?.tab ?? 'time');
  const [note, setNote] = useState(resumed?.note ?? '');
  const [busy, setBusy] = useState(false);
  const state = useAsync(() => (open ? api.sandbox() : Promise.resolve(null)), [open]);

  const run = async (action: () => Promise<string>) => {
    setBusy(true);
    try {
      sessionStorage.setItem(RESUME, JSON.stringify({ tab, note: await action() }));
      location.reload();
    } catch {
      setNote(t('sandbox.failed'));
      setBusy(false);
    }
  };

  const body = (
    <div className="px-4 pb-4 desktop:px-0 desktop:pb-0">
      <Chips value={tab} onChange={setTab} t={t} />

      {state.loading ? (
        <Loading rows={1} height="h-40" />
      ) : state.error || !state.data ? (
        <Failed />
      ) : tab === 'time' ? (
        <Time state={state.data} busy={busy} run={run} />
      ) : tab === 'mind' ? (
        <Mind state={state.data} busy={busy} run={run} />
      ) : (
        <Data state={state.data} busy={busy} run={run} />
      )}

      {note && (
        <p role="status" className="text-muted-foreground mt-4 border-t pt-4 text-xs text-pretty">
          {note}
        </p>
      )}
    </div>
  );

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className={cn(
          focusRing,
          'bg-card text-muted-foreground hover:text-foreground fixed bottom-20 left-4 z-40',
          'flex h-11 items-center gap-2 rounded-full border px-4 text-xs font-medium shadow-lg',
          // the desktop shell keeps the Mind's status in the bottom-left corner of the nav
          'desktop:bottom-6 desktop:left-auto desktop:right-6 desktop:h-9',
        )}
      >
        <SlidersHorizontal className="size-4" />
        {t('sandbox.open')}
      </button>

      {mobile ? (
        <Sheet open={open} onOpenChange={setOpen} title={t('sandbox.title')}>
          {body}
        </Sheet>
      ) : (
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogContent className="max-h-[80dvh] max-w-2xl overflow-y-auto">
            <DialogHeader>
              <DialogTitle>{t('sandbox.title')}</DialogTitle>
              <DialogDescription>{t('sandbox.lead')}</DialogDescription>
            </DialogHeader>
            {body}
          </DialogContent>
        </Dialog>
      )}
    </>
  );
}

const RESUME = 'sandbox-studio';

/** A reload is how the panel applies a change, so it has to survive one. */
function resume(): { tab: Tab; note: string } | null {
  const stored = sessionStorage.getItem(RESUME);
  if (!stored) return null;
  sessionStorage.removeItem(RESUME);
  const parsed = JSON.parse(stored) as { tab: Tab; note: string };
  return TABS.includes(parsed.tab) ? parsed : null;
}

type PanelProps = {
  state: Sandbox;
  busy: boolean;
  run: (action: () => Promise<string>) => void;
};

function Time({ state, busy, run }: PanelProps) {
  const { t } = useI18n();

  return (
    <div className="divide-y">
      <Row
        label={t('sandbox.checkpoint')}
        hint={state.next ? `${state.next.kind} · ${state.next.hypothesis}` : t('sandbox.checkpointNone')}
      >
        <Button
          size="sm"
          disabled={busy || !state.next}
          onClick={() =>
            run(async () => {
              const { fired } = await api.fastForward();
              return fired ? t('demo.fired', { at: fired.kind }) : t('demo.nothingDue');
            })
          }
        >
          <FastForward />
          {t('sandbox.fire')}
        </Button>
      </Row>

      <Row label={t('sandbox.live')} hint={t('sandbox.liveHint')}>
        <Segmented
          value={state.live ? 'on' : 'off'}
          disabled={busy}
          options={[
            { key: 'off', label: t('sandbox.off') },
            { key: 'on', label: t('sandbox.on') },
          ]}
          onChange={(key) =>
            run(async () => {
              await api.holdLive(key === 'on');
              return t(key === 'on' ? 'sandbox.liveOn' : 'sandbox.liveOff');
            })
          }
        />
      </Row>

      <Row label={t('sandbox.reset')} hint={t('sandbox.resetHint')}>
        <Button
          variant="outline"
          size="sm"
          disabled={busy}
          className="text-destructive"
          onClick={() =>
            run(async () => {
              const done = await api.resetSandbox();
              return t('sandbox.resetDone', {
                restored: done.restored,
                rows: done.proposals + done.experiments + done.viewers,
              });
            })
          }
        >
          {t('sandbox.resetDo')}
        </Button>
      </Row>
    </div>
  );
}

function Mind({ state, busy, run }: PanelProps) {
  const { t } = useI18n();

  return (
    <div role="radiogroup" aria-label={t('sandbox.tabMind')} className="divide-y">
      {MIND_STATES.map((key) => (
        <button
          key={key}
          role="radio"
          aria-checked={key === state.mind}
          disabled={busy}
          onClick={() =>
            run(async () => {
              await api.holdMind(key);
              return t('sandbox.mindHeld', { state: t(`sandbox.mind.${key}`) });
            })
          }
          className={cn(
            focusRing,
            'hover:bg-accent flex w-full items-start gap-3 px-3 py-4 text-left disabled:opacity-50',
          )}
        >
          <span
            className={cn(
              'mt-1 size-4 shrink-0 rounded-full border-2',
              key === state.mind ? 'border-primary bg-primary' : 'border-input',
            )}
          />
          <span className="min-w-0">
            <span className="block text-sm font-medium">{t(`sandbox.mind.${key}`)}</span>
            <span className="text-muted-foreground mt-1 block text-xs text-pretty">
              {t(`sandbox.mind.${key}Hint`)}
            </span>
          </span>
        </button>
      ))}
    </div>
  );
}

const FLAVOURS = ['mixed', 'question', 'criticism', 'superfan'] as const;
const KINDS = ['thumbnail', 'title', 'hook', 'community', 'reply', 'experiment'] as const;

function Data({ state, busy, run }: PanelProps) {
  const { t } = useI18n();
  const [flavour, setFlavour] = useState<string>('mixed');
  const [count, setCount] = useState('5');
  const [commentOn, setCommentOn] = useState('');
  const [kind, setKind] = useState<string>('thumbnail');
  const [proposeOn, setProposeOn] = useState('');
  const [summary, setSummary] = useState('');
  const [predicted, setPredicted] = useState('8.2');
  const [observed, setObserved] = useState('5.1');

  return (
    <div className="divide-y">
      <section className="pb-6">
        <h3 className="text-sm font-medium">{t('sandbox.comments')}</h3>
        <p className="text-muted-foreground mt-1 text-xs text-pretty">{t('sandbox.commentsHint')}</p>

        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          <Field label={t('sandbox.flavour')}>
            <select value={flavour} onChange={(e) => setFlavour(e.target.value)} className={control}>
              {FLAVOURS.map((key) => (
                <option key={key} value={key}>
                  {t(`sandbox.flavour.${key}`)}
                </option>
              ))}
            </select>
          </Field>

          <Field label={t('sandbox.count')}>
            <input
              type="number"
              min={1}
              max={20}
              value={count}
              onChange={(e) => setCount(e.target.value)}
              className={control}
            />
          </Field>

          <Field label={t('sandbox.video')} className="sm:col-span-2">
            <VideoPicker videos={state.videos} value={commentOn} onChange={setCommentOn} t={t} />
          </Field>
        </div>

        <Button
          variant="outline"
          size="sm"
          disabled={busy}
          className="mt-4"
          onClick={() =>
            run(async () => {
              const done = await api.injectComments({
                flavour,
                count: Number(count) || 5,
                ...(commentOn ? { ytVideoId: commentOn } : {}),
              });
              return t('sandbox.commentsDone', { n: done.people, title: done.videoTitle });
            })
          }
        >
          {t('sandbox.addComments')}
        </Button>
      </section>

      <section className="pt-6">
        <h3 className="text-sm font-medium">{t('sandbox.proposal')}</h3>
        <p className="text-muted-foreground mt-1 text-xs text-pretty">{t('sandbox.proposalHint')}</p>

        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          <Field label={t('sandbox.kind')}>
            <select value={kind} onChange={(e) => setKind(e.target.value)} className={control}>
              {KINDS.map((key) => (
                <option key={key} value={key}>
                  {t(`proposal.${key}`)}
                </option>
              ))}
            </select>
          </Field>

          <Field label={t('sandbox.video')}>
            <VideoPicker videos={state.videos} value={proposeOn} onChange={setProposeOn} t={t} />
          </Field>

          <Field label={t('sandbox.summary')} className="sm:col-span-2">
            <input
              value={summary}
              onChange={(e) => setSummary(e.target.value)}
              placeholder={t('sandbox.summaryExample')}
              className={control}
            />
          </Field>

          <Field label={t('sandbox.predicted')}>
            <input
              type="number"
              step="0.1"
              min={0}
              value={predicted}
              onChange={(e) => setPredicted(e.target.value)}
              className={control}
            />
          </Field>

          <Field label={t('sandbox.observed')}>
            <input
              type="number"
              step="0.1"
              min={0}
              value={observed}
              onChange={(e) => setObserved(e.target.value)}
              className={control}
            />
          </Field>
        </div>

        <Button
          variant="outline"
          size="sm"
          disabled={busy}
          className="mt-4"
          onClick={() =>
            run(async () => {
              const done = await api.injectProposal({
                kind,
                summary,
                predictedCtr: Number(predicted),
                observedCtr: Number(observed),
                ...(proposeOn ? { ytVideoId: proposeOn } : {}),
              });
              return t('sandbox.pushed', { summary: done.summary });
            })
          }
        >
          {t('sandbox.push')}
        </Button>
      </section>
    </div>
  );
}

const control = cn(
  focusRing,
  'bg-background focus-visible:border-primary h-11 w-full rounded-lg border px-3 text-sm desktop:h-10',
);

function VideoPicker({
  videos,
  value,
  onChange,
  t,
}: {
  videos: Sandbox['videos'];
  value: string;
  onChange: (next: string) => void;
  t: Translate;
}) {
  return (
    <select value={value} onChange={(event) => onChange(event.target.value)} className={control}>
      <option value="">{t('sandbox.videoNewest')}</option>
      {videos.map((video) => (
        <option key={video.ytVideoId} value={video.ytVideoId}>
          {video.title}
        </option>
      ))}
    </select>
  );
}

function Chips({ value, onChange, t }: { value: Tab; onChange: (next: Tab) => void; t: Translate }) {
  return (
    <div className="mb-2 flex gap-2">
      {TABS.map((key) => (
        <button
          key={key}
          onClick={() => onChange(key)}
          aria-pressed={key === value}
          className={cn(
            focusRing,
            'rounded-full px-4 py-2 text-sm font-medium transition-colors',
            key === value
              ? 'bg-foreground text-background'
              : 'bg-secondary text-foreground hover:bg-input',
          )}
        >
          {t(`sandbox.tab${key[0]!.toUpperCase()}${key.slice(1)}`)}
        </button>
      ))}
    </div>
  );
}

function Row({ label, hint, children }: { label: string; hint: string; children: ReactNode }) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-3 py-4">
      <div className="min-w-48 flex-1">
        <p className="text-sm font-medium">{label}</p>
        <p className="text-muted-foreground mt-1 text-xs text-pretty">{hint}</p>
      </div>
      {children}
    </div>
  );
}

function Field({
  label,
  className,
  children,
}: {
  label: string;
  className?: string;
  children: ReactNode;
}) {
  return (
    <label className={cn('block', className)}>
      <span className="text-muted-foreground text-xs font-medium">{label}</span>
      <span className="mt-2 block">{children}</span>
    </label>
  );
}

function Segmented({
  options,
  value,
  onChange,
  disabled,
}: {
  options: Array<{ key: string; label: string }>;
  value: string;
  onChange: (key: string) => void;
  disabled?: boolean;
}) {
  return (
    <div className="bg-secondary flex items-center rounded-full p-1">
      {options.map(({ key, label }) => (
        <button
          key={key}
          onClick={() => onChange(key)}
          aria-pressed={key === value}
          disabled={disabled}
          className={cn(
            focusRing,
            'rounded-full px-4 py-2 text-xs font-medium transition-colors disabled:opacity-50',
            key === value
              ? 'bg-background text-foreground'
              : 'text-muted-foreground hover:text-foreground',
          )}
        >
          {label}
        </button>
      ))}
    </div>
  );
}
