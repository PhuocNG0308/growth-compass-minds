import { useEffect, useRef, useState, type ReactNode } from 'react';
import {
  BrainCircuit,
  FlaskConical,
  Inbox as InboxIcon,
  LayoutGrid,
  LogOut,
  MoreHorizontal,
  RefreshCw,
  Users,
} from 'lucide-react';
import { Logo } from '@/components/shell';
import { LocaleToggle, ThemeToggle } from '@/components/controls';
import { useToast } from '@/components/toast';
import { Sheet } from '@/mobile/kit';
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
 * The phone chrome. The desktop header carries six controls; here five of them are things
 * you touch once a month, so they move into a sheet and the bar keeps only the channel name
 * and the way in.
 */
export function MobileShell({
  me,
  route,
  title,
  banner,
  children,
}: {
  me: Me;
  route: string;
  title?: string;
  banner?: ReactNode;
  children: ReactNode;
}) {
  const { t } = useI18n();
  const notify = useToast();
  const [menu, setMenu] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const chrome = useRef<HTMLElement>(null);
  const tabs = useRef<HTMLElement>(null);
  const waiting = me.counts.waiting + me.counts.overdue;

  // Everything else that sticks has to line up with these two bars, and their heights move
  // with the banner, the locale, the safe area and the reader's text size. Guessing the
  // numbers leaves a seam; publishing them does not.
  useEffect(() => {
    const measured: Array<[string, HTMLElement | null]> = [
      ['--chrome', chrome.current],
      ['--tabs', tabs.current],
    ];

    const publish = () => {
      for (const [name, node] of measured) {
        if (node) document.documentElement.style.setProperty(name, `${node.offsetHeight}px`);
      }
    };

    publish();
    const observer = new ResizeObserver(publish);
    for (const [, node] of measured) if (node) observer.observe(node);
    return () => observer.disconnect();
  }, [banner]);

  async function sync() {
    setSyncing(true);
    setMenu(false);
    try {
      await api.sync();
      location.reload();
    } catch (err) {
      const reason = err instanceof Error ? err.message : '';
      notify(reason === 'demo-read-only' ? t('demo.readOnly') : t('shell.syncFailed'), 'error');
      setSyncing(false);
    }
  }

  return (
    <div className="min-h-dvh">
      <header ref={chrome} className="bg-background safe-x sticky top-0 z-30 border-b">
        <div className="flex items-center gap-2 px-4 py-2">
          <Logo />
          <span className="min-w-0 flex-1 truncate text-base font-medium tracking-tight">
            {me.title}
          </span>
          <button
            onClick={sync}
            disabled={syncing}
            aria-label={t('shell.sync')}
            className={cn(focusRing, 'grid size-11 place-items-center rounded-full')}
          >
            <RefreshCw className={cn('size-5', syncing && 'animate-spin')} />
          </button>
          <button
            onClick={() => setMenu(true)}
            aria-label={t('shell.more')}
            className={cn(focusRing, 'grid size-11 place-items-center rounded-full')}
          >
            <MoreHorizontal className="size-5" />
          </button>
        </div>
        {banner}
      </header>

      <main className="safe-x pt-4 pb-[calc(var(--tabs,64px)+2rem)]">
        {title && <h1 className="mb-4 px-4 text-xl font-normal tracking-tight">{title}</h1>}
        {children}
      </main>

      <nav ref={tabs} className="bg-background safe-b safe-x fixed inset-x-0 bottom-0 z-30 flex border-t">
        {TABS.map(({ href, key, icon: Icon }) => {
          const active = route === href;
          return (
            <a
              key={href}
              href={href}
              aria-current={active ? 'page' : undefined}
              className={cn(
                focusRing,
                'flex min-h-14 flex-1 flex-col items-center justify-center gap-1 text-[10px]',
                active ? 'text-foreground font-medium' : 'text-muted-foreground',
              )}
            >
              <span className="relative">
                <Icon className="size-6" strokeWidth={active ? 2.4 : 1.8} />
                {href === '#/inbox' && waiting > 0 && (
                  <span className="bg-brand absolute -top-1 -right-1 size-2 rounded-full" />
                )}
              </span>
              {t(key)}
            </a>
          );
        })}
      </nav>

      <Sheet open={menu} onOpenChange={setMenu} title={t('shell.more')}>
        <div className="space-y-6 px-4 pt-2 pb-6">
          <Setting label={t('shell.language')}>
            <LocaleToggle />
          </Setting>
          <Setting label={t('shell.theme')}>
            <ThemeToggle />
          </Setting>

          <a
            href="#/chats"
            onClick={() => setMenu(false)}
            className={cn(focusRing, 'flex min-h-12 items-center rounded-full border px-5 font-medium')}
          >
            {t('rail.allChats')}
          </a>

          <button
            onClick={async () => {
              await api.signOut();
              location.reload();
            }}
            className={cn(
              focusRing,
              'text-destructive flex min-h-12 w-full items-center gap-3 rounded-full border px-5 font-medium',
            )}
          >
            <LogOut className="size-5" />
            {t('shell.signOut')}
          </button>

          <p className="text-muted-foreground flex items-center gap-2 text-xs">
            <span
              className={cn('size-2 rounded-full', me.mindEnabled ? 'bg-success' : 'bg-muted-foreground')}
            />
            {me.mindEnabled ? t('shell.mindOn') : t('shell.mindOff')}
          </p>
        </div>
      </Sheet>
    </div>
  );
}

function Setting({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex min-h-12 items-center justify-between gap-4">
      <span className="font-medium">{label}</span>
      {children}
    </div>
  );
}
