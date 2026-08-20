import { useState, type ReactNode } from 'react';
import {
  FlaskConical,
  Home,
  Inbox as InboxIcon,
  Monitor,
  Moon,
  RefreshCw,
  Smartphone,
  Sun,
  Users,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { api } from '@/lib/api';
import { LOCALES, useI18n } from '@/lib/i18n';
import { currentTheme, setTheme } from '@/lib/theme';
import { cn, focusRing } from '@/lib/utils';
import type { Me } from '@/lib/types';

const TABS = [
  { href: '#/', key: 'nav.feed', icon: Home },
  { href: '#/inbox', key: 'nav.inbox', icon: InboxIcon },
  { href: '#/lab', key: 'nav.lab', icon: FlaskConical },
  { href: '#/audience', key: 'nav.audience', icon: Users },
] as const;

const COLUMN = 'mx-auto w-[420px] max-w-full';

export function Shell({
  me,
  route,
  banner,
  rail,
  children,
}: {
  me: Me;
  route: string;
  banner?: ReactNode;
  rail?: ReactNode;
  children: ReactNode;
}) {
  const { t, locale, setLocale } = useI18n();
  const [theme, applyTheme] = useState(currentTheme);
  const [narrow, setNarrow] = useState(false);
  const [syncing, setSyncing] = useState(false);

  async function sync() {
    setSyncing(true);
    try {
      await api.sync();
      location.reload();
    } finally {
      setSyncing(false);
    }
  }

  // forcing the phone layout on a desktop means forcing its navigation too
  const topNav = narrow ? 'hidden' : 'hidden desktop:flex';
  const bottomNav = narrow ? 'flex' : 'flex desktop:hidden';

  return (
    <div className={cn('min-h-dvh', narrow && 'bg-muted/40')}>
      <header
        className={cn(
          'bg-background/85 safe-x sticky top-0 z-20 border-b backdrop-blur',
          narrow && `${COLUMN} border-x`,
        )}
      >
        <div className="@container mx-auto max-w-7xl px-4 @2xl:px-6">
          <div className="flex items-center gap-2 py-4">
            <div className="mr-auto flex min-w-0 items-center gap-3">
              <span className="bg-primary size-3 shrink-0 rounded-full" />
              <span className="truncate text-lg font-semibold tracking-tight">{me.title}</span>
            </div>

            <div className="flex items-center rounded-lg border p-1">
              {LOCALES.map(([code, label]) => (
                <button
                  key={code}
                  onClick={() => setLocale(code)}
                  aria-pressed={code === locale}
                  className={cn(
                    focusRing,
                    'rounded-md px-2 py-1 text-xs font-semibold transition-colors @md:px-3',
                    code === locale
                      ? 'bg-primary text-primary-foreground'
                      : 'text-muted-foreground hover:text-foreground',
                  )}
                >
                  {label}
                </button>
              ))}
            </div>

            <Button
              variant="outline"
              size="icon"
              aria-label={t('shell.theme')}
              onClick={() => {
                const next = theme === 'dark' ? 'light' : 'dark';
                setTheme(next);
                applyTheme(next);
              }}
            >
              {theme === 'dark' ? <Sun /> : <Moon />}
            </Button>

            <Button
              variant="outline"
              size="icon"
              aria-label={t('shell.viewport')}
              title={t('shell.viewport')}
              onClick={() => setNarrow((on) => !on)}
              className="hidden desktop:inline-flex"
            >
              {narrow ? <Monitor /> : <Smartphone />}
            </Button>

            <Button
              variant="outline"
              onClick={sync}
              disabled={syncing}
              size="icon"
              className="@md:w-auto @md:px-4"
            >
              <RefreshCw className={cn(syncing && 'animate-spin')} />
              <span className="hidden @md:inline">{syncing ? t('shell.syncing') : t('shell.sync')}</span>
            </Button>
          </div>

          <nav className={cn('gap-1', topNav)}>
            {TABS.map(({ href, key }) => (
              <a
                key={href}
                href={href}
                className={cn(
                  focusRing,
                  'border-b-[3px] px-4 py-3 text-[15px] font-medium transition-colors',
                  route === href
                    ? 'border-primary text-primary'
                    : 'text-muted-foreground border-transparent hover:text-foreground',
                )}
              >
                {t(key)}
              </a>
            ))}
          </nav>
        </div>
        {banner}
      </header>

      <div
        className={cn(
          'safe-x mx-auto flex max-w-7xl gap-8 px-4 @2xl:px-6',
          narrow && `${COLUMN} !px-0`,
        )}
      >
        <main
          className={cn(
            '@container min-w-0 flex-1 pt-6 pb-32',
            narrow ? 'border-x px-4' : 'desktop:pb-16',
          )}
        >
          {children}

          <div className="text-muted-foreground mt-12 flex items-center gap-2 text-xs">
            <span
              className={cn('size-2 rounded-full', me.mindEnabled ? 'bg-primary' : 'bg-muted-foreground')}
            />
            {me.mindEnabled ? t('shell.mindOn') : t('shell.mindOff')}
          </div>
        </main>

        {/* the empty margins on a wide screen carry context instead of stretching the feed */}
        {rail && !narrow && (
          <aside className="hidden w-80 shrink-0 py-6 xl:block">
            <div className="sticky top-32 space-y-8">{rail}</div>
          </aside>
        )}
      </div>

      <nav
        className={cn(
          'bg-background/95 safe-b safe-x fixed inset-x-0 bottom-0 z-30 border-t backdrop-blur',
          bottomNav,
          narrow && 'left-1/2 w-[420px] max-w-full -translate-x-1/2 border-x',
        )}
      >
        {TABS.map(({ href, key, icon: Icon }) => (
          <a
            key={href}
            href={href}
            aria-current={route === href ? 'page' : undefined}
            className={cn(
              focusRing,
              'flex flex-1 flex-col items-center gap-1 py-3 text-[11px] font-medium transition-colors',
              route === href ? 'text-primary' : 'text-muted-foreground',
            )}
          >
            <span className={cn('rounded-full px-4 py-1 transition-colors', route === href && 'bg-primary/15')}>
              <Icon className="size-5" />
            </span>
            {t(key)}
          </a>
        ))}
      </nav>
    </div>
  );
}

export function SectionTitle({ children, action }: { children: ReactNode; action?: ReactNode }) {
  return (
    <div className="mt-8 mb-4 flex items-center justify-between gap-4 first:mt-0">
      <h2 className="text-xl font-semibold tracking-tight @md:text-2xl">{children}</h2>
      {action}
    </div>
  );
}

/** Quiet heading for the parts of a page that are reference, not the job to be done. */
export function SubTitle({ children, action }: { children: ReactNode; action?: ReactNode }) {
  return (
    <div className="mt-10 mb-3 flex items-center justify-between gap-4">
      <h2 className="text-muted-foreground text-xs font-semibold tracking-wide uppercase">{children}</h2>
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
    <div className="mb-4 flex gap-2 overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
      {options.map(({ key, label, count }) => (
        <button
          key={key}
          onClick={() => onChange(key)}
          aria-pressed={key === value}
          className={cn(
            focusRing,
            'shrink-0 rounded-full border px-4 py-2 text-sm font-medium transition-colors',
            key === value
              ? 'border-primary bg-primary/12 text-primary'
              : 'text-muted-foreground hover:text-foreground',
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
  return <h3 className="text-muted-foreground mb-3 text-xs font-semibold tracking-wide uppercase">{children}</h3>;
}

/**
 * Lists are separated by rules and whitespace, not card chrome. A card is reserved for a
 * discrete object you could pick up and move: a post, a proposal, the chat surface.
 */
export function List({ children }: { children: ReactNode }) {
  return <div className="divide-y border-y">{children}</div>;
}

export function Empty({ children }: { children: ReactNode }) {
  return <div className="bg-muted text-muted-foreground rounded-2xl px-4 py-6 text-[15px]">{children}</div>;
}

export function Loading() {
  return (
    <div className="space-y-4">
      <Skeleton className="h-56 w-full rounded-2xl" />
      <Skeleton className="h-56 w-full rounded-2xl" />
    </div>
  );
}
