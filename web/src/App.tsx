import { FlaskConical, Moon, Play, Sun } from 'lucide-react';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Rail } from '@/components/rail';
import { Shell } from '@/components/shell';
import { Audience } from '@/pages/audience';
import { Feed } from '@/pages/feed';
import { Inbox } from '@/pages/inbox';
import { Lab } from '@/pages/lab';
import { Post } from '@/pages/post';
import { ViewerProfile } from '@/pages/viewer';
import { api, NotConnected } from '@/lib/api';
import { LOCALES, useI18n } from '@/lib/i18n';
import { currentTheme, setTheme } from '@/lib/theme';
import { useAsync, useHash } from '@/lib/use-async';
import { cn } from '@/lib/utils';

export default function App() {
  const hash = useHash();
  const { data: me, error, loading } = useAsync(() => api.me(), []);
  const mode = useAsync(() => api.mode(), []);
  const preview = mode.data?.preview === true;
  const liveMind = mode.data?.liveMind === true;

  if (loading) return <div className="grid min-h-dvh place-items-center text-muted-foreground">…</div>;
  if (!me) {
    return (
      <>
        <PreviewBanner show={preview} live={liveMind} />
        <Gate error={error instanceof NotConnected ? null : (error?.message ?? null)} />
      </>
    );
  }

  const detail = /^#\/post\/(.+)$/.exec(hash);
  const person = /^#\/viewer\/(.+)$/.exec(hash);
  const route = detail ? '#/' : person ? '#/audience' : ROUTES.includes(hash) ? hash : '#/';

  return (
    <Shell
      me={me}
      route={route}
      banner={<PreviewBanner show={preview} live={liveMind} />}
      rail={<Rail me={me} />}
    >
      {detail ? (
        <Post ytVideoId={decodeURIComponent(detail[1]!)} />
      ) : person ? (
        <ViewerProfile ytAuthorId={decodeURIComponent(person[1]!)} />
      ) : route === '#/inbox' ? (
        <Inbox me={me} />
      ) : route === '#/lab' ? (
        <Lab me={me} />
      ) : route === '#/audience' ? (
        <Audience />
      ) : (
        <Feed />
      )}
    </Shell>
  );
}

const ROUTES = ['#/', '#/inbox', '#/lab', '#/audience'];

function PreviewBanner({ show, live }: { show: boolean; live?: boolean }) {
  const { t } = useI18n();
  if (!show) return null;

  return (
    <div className="bg-warning/15 text-warning flex items-center justify-center gap-2 px-4 py-2 text-center text-xs font-medium">
      <FlaskConical className="size-4" />
      {live ? t('preview.liveMind') : t('preview.banner')}
    </div>
  );
}

function Gate({ error }: { error: string | null }) {
  const { t, locale, setLocale } = useI18n();
  const [theme, applyTheme] = useState(currentTheme);

  return (
    <div className="grid min-h-dvh place-items-center px-6 py-16">
      <div className="w-full max-w-lg text-center">
        <span className="bg-primary mx-auto mb-7 grid size-14 place-items-center rounded-2xl">
          <Play className="text-primary-foreground size-7 fill-current" />
        </span>

        <h1 className="text-4xl font-semibold tracking-tight sm:text-5xl">{t('gate.title')}</h1>
        <p className="mt-4 mb-9 text-lg text-muted-foreground">{t('gate.lede')}</p>

        <Button
          size="lg"
          className="h-13 w-full max-w-sm text-base"
          onClick={() => window.open('/auth/youtube', 'connect', 'width=520,height=700')}
        >
          <Play className="fill-current" />
          {t('gate.connect')}
        </Button>

        <p className="mt-5 text-sm text-muted-foreground">{t('gate.readOnly')}</p>
        {error && <p className="text-destructive mt-4 text-sm">{error}</p>}

        <div className="mt-10 flex items-center justify-center gap-2">
          <div className="flex items-center rounded-lg border p-1">
            {LOCALES.map(([code, label]) => (
              <button
                key={code}
                onClick={() => setLocale(code)}
                aria-pressed={code === locale}
                className={cn(
                  'rounded-md px-3 py-1 text-xs font-semibold transition-colors',
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
        </div>
      </div>
    </div>
  );
}
