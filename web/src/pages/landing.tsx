import { useEffect, useState, type ReactNode } from 'react';
import { ArrowRight, Check, Compass, Eye, FlaskConical, Loader2, Lock, Target, X } from 'lucide-react';
import { LocaleToggle, ThemeToggle } from '@/components/controls';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { api } from '@/lib/api';
import { useI18n } from '@/lib/i18n';
import { cn } from '@/lib/utils';

type GateError = 'popup' | 'cancelled' | 'unconfigured' | 'server' | 'demo' | null;

const ERRORS: Record<Exclude<GateError, null>, string> = {
  popup: 'gate.errPopup',
  cancelled: 'gate.errCancelled',
  unconfigured: 'gate.errUnconfigured',
  server: 'gate.errServer',
  demo: 'gate.errDemo',
};

export function Landing({
  googleConfigured,
  demoAvailable,
  serverDown,
}: {
  googleConfigured: boolean;
  demoAvailable: boolean;
  serverDown: boolean;
}) {
  const { t } = useI18n();
  const [error, setError] = useState<GateError>(serverDown ? 'server' : null);
  const [connecting, setConnecting] = useState(false);
  const [confirmDemo, setConfirmDemo] = useState(false);

  // the popup posts its result back; without this listener the window just closes and the
  // creator is left staring at the same screen wondering whether it worked
  useEffect(() => {
    function onMessage(event: MessageEvent) {
      if (event.origin !== location.origin || event.data?.type !== 'youtube-connect') return;
      setConnecting(false);
      if (event.data.ok) return location.reload();
      setError(event.data.error === 'google-unconfigured' ? 'unconfigured' : 'cancelled');
    }

    addEventListener('message', onMessage);
    return () => removeEventListener('message', onMessage);
  }, []);

  function connect() {
    setError(null);
    if (!googleConfigured) return setError('unconfigured');

    const popup = open('/auth/youtube', 'connect', 'width=520,height=700');
    if (!popup) return setError('popup');
    setConnecting(true);
  }

  async function enterDemo() {
    setConfirmDemo(false);
    try {
      await api.demoSignIn();
      location.reload();
    } catch (err) {
      setError(err instanceof Error && err.message === 'demo' ? 'demo' : 'server');
    }
  }

  return (
    <div className="min-h-dvh">
      <header className="bg-background/85 safe-x sticky top-0 z-20 border-b backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center gap-3 px-4 py-4 sm:px-6">
          <Compass className="text-primary size-5 shrink-0" />
          <span className="mr-auto text-base font-semibold tracking-tight">{t('gate.brand')}</span>
          <LocaleToggle />
          <ThemeToggle />
        </div>
      </header>

      <main className="safe-x mx-auto max-w-6xl px-4 sm:px-6">
        <section className="grid items-center gap-12 py-16 lg:grid-cols-[1.1fr_1fr] lg:gap-16 lg:py-24">
          <div>
            <p className="text-muted-foreground text-xs font-semibold tracking-[0.12em] uppercase">
              {t('gate.eyebrow')}
            </p>
            <h1 className="mt-4 text-4xl font-semibold tracking-tight text-balance sm:text-5xl lg:text-6xl">
              {t('gate.title')}
            </h1>
            <p className="text-muted-foreground mt-6 max-w-xl text-lg text-pretty">{t('gate.lede')}</p>

            <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:items-center">
              <Button size="lg" className="h-12 px-6 text-base" onClick={connect} disabled={connecting}>
                {connecting ? <Loader2 className="animate-spin" /> : <Compass />}
                {connecting ? t('gate.connecting') : t('gate.connect')}
              </Button>

              {demoAvailable && (
                <Button
                  variant="ghost"
                  size="lg"
                  className="text-muted-foreground hover:text-foreground h-12"
                  onClick={() => setConfirmDemo(true)}
                >
                  {t('gate.demo')}
                  <ArrowRight />
                </Button>
              )}
            </div>

            <p className="text-muted-foreground mt-5 flex items-start gap-2 text-sm">
              <Lock className="mt-1 size-4 shrink-0" />
              {t('gate.readOnly')}
            </p>

            {error && (
              <p
                role="alert"
                className="text-destructive border-destructive/30 bg-destructive/5 mt-6 max-w-xl rounded-lg border px-4 py-3 text-sm"
              >
                {t(ERRORS[error])}
              </p>
            )}
          </div>

          <PredictionCard />
        </section>

        <Section title={t('gate.proofTitle')}>
          <div className="grid gap-8 sm:grid-cols-3">
            <Proof icon={Target} title={t('gate.proof1')} body={t('gate.proof1Body')} />
            <Proof icon={FlaskConical} title={t('gate.proof2')} body={t('gate.proof2Body')} />
            <Proof icon={Eye} title={t('gate.proof3')} body={t('gate.proof3Body')} />
          </div>
        </Section>

        <Section title={t('gate.loopTitle')}>
          <ol className="grid gap-8 sm:grid-cols-2 lg:grid-cols-4">
            {[t('gate.loop1'), t('gate.loop2'), t('gate.loop3'), t('gate.loop4')].map((step, index) => (
              <li key={step} className="border-t pt-4">
                <span className="text-primary tabular text-sm font-semibold">
                  {String(index + 1).padStart(2, '0')}
                </span>
                <p className="mt-2 text-pretty">{step}</p>
              </li>
            ))}
          </ol>
        </Section>

        <Section title={t('gate.promiseTitle')}>
          <dl className="grid gap-8 sm:grid-cols-2">
            <Guarantee icon={Check} tone="allow" term={t('gate.can')} body={t('gate.canBody')} />
            <Guarantee icon={X} tone="deny" term={t('gate.cannot')} body={t('gate.cannotBody')} />
          </dl>
        </Section>

        <footer className="text-muted-foreground border-t py-8 text-sm">{t('gate.consent')}</footer>
      </main>

      <Dialog open={confirmDemo} onOpenChange={setConfirmDemo}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t('gate.demoTitle')}</DialogTitle>
            <DialogDescription>{t('gate.demoBody')}</DialogDescription>
          </DialogHeader>
          <p className="text-muted-foreground text-sm">{t('gate.demoMind')}</p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirmDemo(false)}>
              {t('gate.cancel')}
            </Button>
            <Button onClick={enterDemo}>{t('gate.demoGo')}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="border-t py-12 lg:py-16">
      <h2 className="text-muted-foreground mb-8 text-xs font-semibold tracking-[0.12em] uppercase">
        {title}
      </h2>
      {children}
    </section>
  );
}

function Proof({
  icon: Icon,
  title,
  body,
}: {
  icon: typeof Target;
  title: string;
  body: string;
}) {
  return (
    <div>
      <Icon className="text-primary size-5" />
      <h3 className="mt-3 font-semibold">{title}</h3>
      <p className="text-muted-foreground mt-2 text-pretty">{body}</p>
    </div>
  );
}

function Guarantee({
  icon: Icon,
  tone,
  term,
  body,
}: {
  icon: typeof Check;
  tone: 'allow' | 'deny';
  term: string;
  body: string;
}) {
  return (
    <div className="flex gap-4">
      <Icon className={cn('mt-1 size-5 shrink-0', tone === 'allow' ? 'text-primary' : 'text-destructive')} />
      <div>
        <dt className="font-semibold">{term}</dt>
        <dd className="text-muted-foreground mt-1 text-pretty">{body}</dd>
      </div>
    </div>
  );
}

/** The mechanism the product is built on, shown rather than described. */
function PredictionCard() {
  const { t } = useI18n();

  return (
    <div className="bg-card rounded-xl border p-6 shadow-sm">
      <p className="text-muted-foreground text-xs font-semibold tracking-[0.12em] uppercase">
        {t('gate.cardWhen')}
      </p>

      <div className="mt-6 flex items-end gap-8">
        <Figure label={t('gate.cardPredicted')} value="6.2%" muted />
        <span className="text-muted-foreground pb-2">→</span>
        <Figure label={t('gate.cardActual')} value="5.8%" />
      </div>

      <p className="text-muted-foreground mt-3 text-sm">
        {t('gate.cardDelta', { delta: '0.4' })}
      </p>

      <div className="mt-6 border-t pt-6">
        <p className="text-primary text-xs font-semibold tracking-[0.12em] uppercase">
          {t('gate.cardRuleLabel')}
        </p>
        <p className="mt-2 text-pretty">{t('gate.cardRule')}</p>
      </div>
    </div>
  );
}

function Figure({ label, value, muted }: { label: string; value: string; muted?: boolean }) {
  return (
    <div>
      <p className="text-muted-foreground text-sm">{label}</p>
      <p className={cn('tabular mt-1 text-3xl font-semibold', muted && 'text-muted-foreground')}>
        {value}
      </p>
    </div>
  );
}

