import { useEffect, useState } from 'react';
import { ArrowRight, Check, Compass, Eye, FlaskConical, Loader2, Lock, Target, X } from 'lucide-react';
import { LocaleToggle, ThemeToggle } from '@/components/controls';
import { Disclosure, Sheet, Strip, StripItem } from '@/mobile/kit';
import { api } from '@/lib/api';
import { useI18n } from '@/lib/i18n';
import { cn, focusRing } from '@/lib/utils';

type GateError = 'popup' | 'cancelled' | 'unconfigured' | 'server' | 'demo' | null;

const ERRORS: Record<Exclude<GateError, null>, string> = {
  popup: 'gate.errPopup',
  cancelled: 'gate.errCancelled',
  unconfigured: 'gate.errUnconfigured',
  server: 'gate.errServer',
  demo: 'gate.errDemo',
};

const PROOFS = [
  { icon: Target, title: 'gate.proof1', body: 'gate.proof1Body' },
  { icon: FlaskConical, title: 'gate.proof2', body: 'gate.proof2Body' },
  { icon: Eye, title: 'gate.proof3', body: 'gate.proof3Body' },
] as const;

export function MobileLanding({
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
    } catch {
      setError('demo');
    }
  }

  return (
    <div className="safe-x min-h-dvh pb-40">
      <header className="flex items-center gap-3 px-4 py-4">
        <Compass className="text-primary size-5 shrink-0" />
        <span className="mr-auto font-semibold tracking-tight">{t('gate.brand')}</span>
        <LocaleToggle />
        <ThemeToggle />
      </header>

      <section className="px-4 pt-6">
        <p className="text-muted-foreground text-[11px] font-semibold tracking-[0.12em] uppercase">
          {t('gate.eyebrow')}
        </p>
        <h1 className="mt-3 text-4xl leading-[1.1] font-semibold tracking-tight text-balance">
          {t('gate.title')}
        </h1>

        {/* the desktop lede is three sentences; here one carries it and the rest folds away */}
        <p className="text-muted-foreground mt-4 text-[17px] text-pretty">{t('gate.ledeShort')}</p>
        <Disclosure label={t('gate.more')} openLabel={t('proposal.hideWhy')}>
          <p className="text-muted-foreground text-[15px] text-pretty">{t('gate.lede')}</p>
        </Disclosure>
      </section>

      <div className="mt-6">
        <Strip dots align="stretch">
          <StripItem className="bg-card w-[82vw] rounded-2xl border p-5">
            <p className="text-muted-foreground text-[11px] font-semibold tracking-[0.12em] uppercase">
              {t('gate.cardWhen')}
            </p>
            <div className="mt-4 flex items-end gap-6">
              <Figure label={t('gate.cardPredicted')} value="6.2%" muted />
              <span className="text-muted-foreground pb-2">→</span>
              <Figure label={t('gate.cardActual')} value="5.8%" />
            </div>
            <p className="text-muted-foreground mt-3 text-sm">
              {t('gate.cardDelta', { delta: '0.4' })}
            </p>
            <div className="mt-4 border-t pt-4">
              <p className="text-primary text-[11px] font-semibold tracking-[0.12em] uppercase">
                {t('gate.cardRuleLabel')}
              </p>
              <p className="mt-2 text-[15px] text-pretty">{t('gate.cardRule')}</p>
            </div>
          </StripItem>

          {PROOFS.map((proof) => (
            <StripItem key={proof.title} className="bg-card w-[82vw] rounded-2xl border p-5">
              <proof.icon className="text-primary size-5" />
              <h2 className="mt-3 font-semibold">{t(proof.title)}</h2>
              <p className="text-muted-foreground mt-2 text-[15px] text-pretty">{t(proof.body)}</p>
            </StripItem>
          ))}
        </Strip>
      </div>

      <section className="mt-8 px-4">
        <h2 className="text-muted-foreground text-[11px] font-semibold tracking-[0.12em] uppercase">
          {t('gate.loopTitle')}
        </h2>
        <ol className="mt-3 divide-y border-y">
          {['gate.loop1', 'gate.loop2', 'gate.loop3', 'gate.loop4'].map((key, index) => (
            <li key={key} className="flex gap-3 py-3">
              <span className="text-primary tabular text-sm font-semibold">
                {String(index + 1).padStart(2, '0')}
              </span>
              <span className="text-[15px] text-pretty">{t(key)}</span>
            </li>
          ))}
        </ol>
      </section>

      <section className="mt-8 space-y-4 px-4">
        <Guarantee icon={Check} tone="allow" term={t('gate.can')} body={t('gate.canBody')} />
        <Guarantee icon={X} tone="deny" term={t('gate.cannot')} body={t('gate.cannotBody')} />
        <p className="text-muted-foreground pt-2 text-sm text-pretty">{t('gate.consent')}</p>
      </section>

      {/* the one decision this screen exists for, where the thumb already is */}
      <div className="safe-x safe-b bg-background/95 fixed inset-x-0 bottom-0 z-30 border-t px-4 pt-3 pb-4 backdrop-blur">
        {error && (
          <p role="alert" className="text-destructive mb-3 text-sm text-pretty">
            {t(ERRORS[error])}
          </p>
        )}

        <button
          onClick={connect}
          disabled={connecting}
          className={cn(
            focusRing,
            'bg-primary text-primary-foreground flex min-h-13 w-full items-center justify-center gap-2 rounded-full text-base font-semibold disabled:opacity-60',
          )}
        >
          {connecting ? <Loader2 className="size-5 animate-spin" /> : <Compass className="size-5" />}
          {connecting ? t('gate.connecting') : t('gate.connect')}
        </button>

        <p className="text-muted-foreground mt-3 flex items-center justify-center gap-2 text-xs">
          <Lock className="size-4 shrink-0" />
          {t('gate.readOnly')}
        </p>

        {demoAvailable && (
          <button
            onClick={() => setConfirmDemo(true)}
            className={cn(
              focusRing,
              'text-muted-foreground mt-1 flex min-h-11 w-full items-center justify-center gap-1 rounded-full text-sm font-medium',
            )}
          >
            {t('gate.demo')}
            <ArrowRight className="size-4" />
          </button>
        )}
      </div>

      <Sheet
        open={confirmDemo}
        onOpenChange={setConfirmDemo}
        title={t('gate.demoTitle')}
        footer={
          <button
            onClick={enterDemo}
            className={cn(
              focusRing,
              'bg-primary text-primary-foreground min-h-12 w-full rounded-full font-semibold',
            )}
          >
            {t('gate.demoGo')}
          </button>
        }
      >
        <div className="space-y-3 px-4 pb-4">
          <p className="text-[15px] text-pretty">{t('gate.demoBody')}</p>
          <p className="text-muted-foreground text-sm text-pretty">{t('gate.demoMind')}</p>
        </div>
      </Sheet>
    </div>
  );
}

function Figure({ label, value, muted }: { label: string; value: string; muted?: boolean }) {
  return (
    <div>
      <p className="text-muted-foreground text-xs">{label}</p>
      <p className={cn('tabular mt-1 text-3xl font-semibold', muted && 'text-muted-foreground')}>
        {value}
      </p>
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
    <div className="flex gap-3">
      <Icon
        className={cn('mt-1 size-5 shrink-0', tone === 'allow' ? 'text-primary' : 'text-destructive')}
      />
      <div>
        <p className="font-semibold">{term}</p>
        <p className="text-muted-foreground mt-1 text-[15px] text-pretty">{body}</p>
      </div>
    </div>
  );
}
