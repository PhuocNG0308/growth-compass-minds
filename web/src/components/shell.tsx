import { useState, type ReactNode } from 'react';
import {
  BrainCircuit,
  FlaskConical,
  Inbox as InboxIcon,
  LayoutGrid,
  LogOut,
  Menu,
  RefreshCw,
  RotateCw,
  Smartphone,
  Users,
} from 'lucide-react';
import { LocaleToggle, ThemeToggle } from '@/components/controls';
import { useToast } from '@/components/toast';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Tooltip, TooltipProvider } from '@/components/ui/tooltip';
import { api } from '@/lib/api';
import { useI18n } from '@/lib/i18n';
import { cn, focusRing } from '@/lib/utils';
import type { Me } from '@/lib/types';

const TABS = [
  { href: '#/', key: 'nav.feed', icon: LayoutGrid },
  { href: '#/inbox', key: 'nav.inbox', icon: InboxIcon },
  { href: '#/lab', key: 'nav.lab', icon: FlaskConical },
  { href: '#/memory', key: 'nav.memory', icon: BrainCircuit },
  { href: '#/audience', key: 'nav.audience', icon: Users },
] as const;

/**
 * Navigation lives in one column down the left, the way a studio console does, so the top
 * edge carries only the channel and the few controls that act on all of it, and the content
 * starts at a clean left margin instead of underneath a row of tabs.
 */
export function Shell({
  me,
  route,
  title,
  banner,
  nav,
  rail,
  onPreview,
  children,
}: {
  me: Me;
  route: string;
  title?: string;
  banner?: ReactNode;
  // a screen about one video swaps the channel nav out for its own rather than sitting under
  // a menu that no longer describes where you are
  nav?: (wide: boolean) => ReactNode;
  rail?: ReactNode;
  onPreview: () => void;
  children: ReactNode;
}) {
  const { t } = useI18n();
  const [wide, setWide] = useState(true);
  const { sync, syncing } = useSync();

  const waitingCount = me.counts.waiting + me.counts.overdue;

  return (
    // The console holds its own height and scrolls the content pane, not the window, so the
    // sidebar and the rail never have to guess how tall the header grew with the banner in it.
    <TooltipProvider delayDuration={250}>
    <div className="flex h-dvh flex-col">
      <header className="bg-background safe-x z-30 shrink-0 border-b">
        <div className="@container flex items-center gap-2 px-4">
          <button
            onClick={() => setWide((on) => !on)}
            aria-label={t('shell.menu')}
            aria-expanded={wide}
            className={cn(
              focusRing,
              'hover:bg-accent grid size-10 place-items-center rounded-full',
            )}
          >
            <Menu className="size-5" />
          </button>

          <div className="mr-auto flex min-w-0 items-center gap-2 py-3">
            <Logo />
            <span className="truncate text-lg font-medium tracking-tight">{me.title}</span>
          </div>

          <LocaleToggle />
          <ThemeToggle />

          <Button
            variant="ghost"
            size="icon"
            aria-label={t('shell.viewport')}
            title={t('shell.viewport')}
            onClick={onPreview}
          >
            <Smartphone />
          </Button>

          <Button
            variant="ghost"
            size="icon"
            aria-label={t('shell.signOut')}
            title={t('shell.signOut')}
            onClick={async () => {
              await api.signOut();
              location.reload();
            }}
          >
            <LogOut />
          </Button>

          <Button variant="outline" onClick={sync} disabled={syncing} size="icon" className="@md:w-auto @md:px-4">
            <RefreshCw className={cn(syncing && 'animate-spin')} />
            <span className="hidden @md:inline">{syncing ? t('shell.syncing') : t('shell.sync')}</span>
          </Button>
        </div>
        {banner}
      </header>

      <div className="safe-x flex min-h-0 flex-1">
        <aside
          className={cn(
            'flex shrink-0 flex-col overflow-y-auto border-r py-3',
            wide ? 'w-60' : 'w-20',
          )}
        >
          {nav ? (
            nav(wide)
          ) : (
            <>
              {wide && (
                <div className="flex flex-col items-center gap-1 px-4 pt-4 pb-6">
                  <span className="bg-muted text-muted-foreground grid size-20 place-items-center rounded-full text-2xl font-medium">
                    {me.title.trim().charAt(0).toUpperCase()}
                  </span>
                  <span className="mt-3 text-sm font-medium">{t('shell.yourChannel')}</span>
                  <span className="text-muted-foreground max-w-full truncate text-xs">{me.title}</span>
                </div>
              )}

              <nav className="flex flex-col">
                {TABS.map(({ href, key, icon: Icon }) => {
                  const active = route === href;
                  return (
                    <NavTip key={href} label={t(key)} wide={wide}>
                      <a
                        href={href}
                        aria-current={active ? 'page' : undefined}
                        className={navItem(active, wide)}
                      >
                        <span className="relative">
                          <Icon className={cn('size-5 shrink-0', active && 'text-foreground')} />
                          {!wide && href === '#/inbox' && waitingCount > 0 && (
                            <span className="bg-brand absolute -top-1 -right-1 size-2 rounded-full" />
                          )}
                        </span>
                        <span className={cn(navLabel(wide), active && 'text-foreground')}>
                          {t(key)}
                        </span>
                        {wide && href === '#/inbox' && <Waiting me={me} />}
                      </a>
                    </NavTip>
                  );
                })}
              </nav>
            </>
          )}

          <MindState me={me} wide={wide} />
        </aside>

        <div className="flex min-w-0 flex-1 overflow-y-auto">
          <main className="@container min-w-0 flex-1 px-6 pt-6 pb-16">
            {title && <h1 className="mb-6 text-2xl font-normal tracking-tight">{title}</h1>}
            {children}
          </main>

          {/* the empty margin on a wide screen carries context instead of stretching the feed */}
          {rail && (
            <aside className="hidden w-80 shrink-0 py-6 pr-6 xl:block">
              <div className="sticky top-0 space-y-8">{rail}</div>
            </aside>
          )}
        </div>
      </div>
    </div>
    </TooltipProvider>
  );
}

/** Marks a derived number. On the label, not the value, so the column still scans. */
export function Modelled({ children }: { children: ReactNode }) {
  const { t } = useI18n();

  return (
    <Tooltip label={t('demo.modelledWhy')} side="top">
      <span className="decoration-muted-foreground cursor-help underline decoration-dotted underline-offset-4">
        {children}
      </span>
    </Tooltip>
  );
}

/** One row of the left column, so a second-level nav sits at exactly the same rhythm. */
export const navItem = (active: boolean, wide: boolean) =>
  cn(
    focusRing,
    'flex items-center transition-colors',
    active ? 'bg-accent font-medium' : 'text-muted-foreground hover:bg-accent',
    wide ? 'h-10 gap-6 px-6 text-sm' : 'h-12 justify-center',
  );

/** Collapsed: icons only, name on hover, label kept in the accessible name. */
export const navLabel = (wide: boolean) => (wide ? 'truncate' : 'sr-only');

export function NavTip({
  label,
  wide,
  children,
}: {
  label: string;
  wide: boolean;
  children: ReactNode;
}) {
  return wide ? children : <Tooltip label={label}>{children}</Tooltip>;
}

/** Shared by the header button and the empty feed's call to action. */
export function useSync(): { sync: () => void; syncing: boolean } {
  const { t } = useI18n();
  const notify = useToast();
  const [syncing, setSyncing] = useState(false);

  return {
    syncing,
    sync: async () => {
      setSyncing(true);
      try {
        await api.sync();
        location.reload();
      } catch (err) {
        const reason = err instanceof Error ? err.message : '';
        notify(reason === 'demo-read-only' ? t('demo.readOnly') : t('shell.syncFailed'), 'error');
        setSyncing(false);
      }
    },
  };
}

/** The one place the brand red is allowed to appear. */
export function Logo() {
  return (
    <span className="bg-brand grid h-5 w-7 shrink-0 place-items-center rounded-sm">
      <span className="border-y-4 border-l-[7px] border-y-transparent border-l-white" />
    </span>
  );
}

/** Configured and able to answer are different states; a Mind at zero cognition is not "on". */
function MindState({ me, wide }: { me: Me; wide: boolean }) {
  const { t } = useI18n();
  const broke = me.mindEnabled && me.mindCognition != null && me.mindCognition <= 0;
  const key = !me.mindEnabled ? 'shell.mindOff' : broke ? 'shell.mindBroke' : 'shell.mindOn';

  return (
    <div
      title={wide ? undefined : t(key)}
      className={cn(
        'mt-auto flex items-center gap-2 border-t pt-4 text-xs',
        broke ? 'text-warning' : 'text-muted-foreground',
        wide ? 'px-6' : 'justify-center px-2',
      )}
    >
      <span
        className={cn(
          'size-2 shrink-0 rounded-full',
          !me.mindEnabled ? 'bg-muted-foreground' : broke ? 'bg-warning' : 'bg-success',
        )}
      />
      {wide && <span className="truncate">{t(key)}</span>}
    </div>
  );
}

/** The count of things asking for the creator, so the Inbox tab is not a blind door. */
function Waiting({ me }: { me: Me }) {
  const count = me.counts.waiting + me.counts.overdue;
  if (count === 0) return null;

  return (
    <span className="bg-brand tabular ml-auto rounded-full px-2 py-1 text-xs leading-none font-medium text-white">
      {count}
    </span>
  );
}

export function SectionTitle({ children, action }: { children: ReactNode; action?: ReactNode }) {
  return (
    <div className="mt-8 mb-4 flex items-center justify-between gap-4 first:mt-0">
      <h2 className="text-base font-medium">{children}</h2>
      {action}
    </div>
  );
}

/** Quiet heading for the parts of a page that are reference, not the job to be done. */
export function SubTitle({ children, action }: { children: ReactNode; action?: ReactNode }) {
  return (
    <div className="mt-10 mb-3 flex items-center justify-between gap-4">
      <h2 className="text-muted-foreground text-xs font-medium tracking-wide uppercase">{children}</h2>
      {action}
    </div>
  );
}

export function Chips({
  options,
  value,
  onChange,
}: {
  options: Array<{ key: string; label: string; count?: number }>;
  value: string;
  onChange: (key: string) => void;
}) {
  return (
    <div className="mb-6 flex gap-3 overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
      {options.map(({ key, label, count }) => (
        <button
          key={key}
          onClick={() => onChange(key)}
          aria-pressed={key === value}
          className={cn(
            focusRing,
            'shrink-0 rounded-full px-4 py-2 text-sm font-medium transition-colors',
            key === value
              ? 'bg-foreground text-background'
              : 'bg-secondary text-foreground hover:bg-input',
          )}
        >
          {label}
          {count != null && <span className="tabular ml-2 opacity-70">{count}</span>}
        </button>
      ))}
    </div>
  );
}

export function RailTitle({ children }: { children: ReactNode }) {
  return <h3 className="mb-3 text-base font-medium">{children}</h3>;
}

/**
 * Lists are separated by rules and whitespace, not card chrome. A card is reserved for a
 * discrete object you could pick up and move: a post, a proposal, the chat surface.
 */
export function List({ children }: { children: ReactNode }) {
  return <div className="divide-y border-y">{children}</div>;
}

/** Empty states carry the next action where there is one. */
export function Empty({ children, action }: { children: ReactNode; action?: ReactNode }) {
  return (
    <div className="text-muted-foreground rounded-xl border px-4 py-8 text-center">
      {children}
      {action && <div className="mt-4 flex justify-center">{action}</div>}
    </div>
  );
}

/** A failed request is not an empty one, so it never borrows the empty state's wording. */
export function Failed({ onRetry }: { onRetry?: () => void }) {
  const { t } = useI18n();

  return (
    <div className="border-destructive/30 rounded-xl border px-4 py-6">
      <p className="text-destructive">{t('state.error')}</p>
      {onRetry && (
        <Button variant="outline" size="sm" className="mt-4" onClick={onRetry}>
          <RotateCw />
          {t('state.retry')}
        </Button>
      )}
    </div>
  );
}

export function Loading({ rows = 2, height = 'h-56' }: { rows?: number; height?: string }) {
  return (
    <div className="space-y-4" aria-busy="true">
      {Array.from({ length: rows }, (_, index) => (
        <Skeleton key={index} className={cn('w-full rounded-xl', height)} />
      ))}
    </div>
  );
}
