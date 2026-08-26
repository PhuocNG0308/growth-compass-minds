import { useEffect, useState } from 'react';
import { ExternalLink } from 'lucide-react';
import { Thumb } from '@/components/thumb';
import { api } from '@/lib/api';
import { useFormat } from '@/lib/format';
import { useI18n } from '@/lib/i18n';
import { useAsync } from '@/lib/use-async';
import { cn, focusRing } from '@/lib/utils';

const POLL_MS = 60_000;

/**
 * Live state goes stale while the page is open, so it re-reads on a timer. Renders nothing
 * when nothing is on air rather than holding a permanent "not live" row.
 */
export function LiveStrip() {
  const { t, plural } = useI18n();
  const f = useFormat();
  const tick = useTick(POLL_MS);
  const { data } = useAsync(() => api.live(), [tick]);

  if (!data) return null;

  const watch = `https://youtu.be/${data.ytVideoId}`;

  return (
    <section className="mb-6 flex flex-wrap items-center gap-4 border-b pb-4">
      <a href={watch} target="_blank" rel="noreferrer" className={cn(focusRing, 'w-32 shrink-0 rounded-lg')}>
        <Thumb url={data.thumbnailUrl} title={data.title} />
      </a>

      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
          <span className="text-destructive flex items-center gap-2 text-xs font-semibold tracking-wide uppercase">
            <span className="bg-destructive size-2 rounded-full" />
            {t('live.now')}
          </span>
          <span className="text-muted-foreground text-xs">{data.channel}</span>
          {data.startedAt && (
            <span className="text-muted-foreground text-xs">
              {t('live.since', { when: f.since(data.startedAt) })}
            </span>
          )}
        </div>

        <p className="mt-1 truncate font-medium">{data.title}</p>

        {data.watching != null && (
          <p className="text-muted-foreground tabular mt-1 text-sm">
            {plural('live.watching', data.watching)}
          </p>
        )}
      </div>

      {data.chat && data.chat.length > 0 && (
        <ul className="max-h-24 w-full min-w-0 overflow-y-auto border-l pl-4 text-sm @2xl:w-80">
          {data.chat.map((line) => (
            <li key={`${line.at}-${line.displayName}`} className="truncate">
              <span className="text-muted-foreground">{line.displayName}</span> {line.text}
            </li>
          ))}
        </ul>
      )}

      <a
        href={watch}
        target="_blank"
        rel="noreferrer"
        aria-label={t('feed.onYouTube')}
        title={t('feed.onYouTube')}
        className={cn(
          focusRing,
          'text-muted-foreground hover:bg-secondary hover:text-foreground grid size-10 shrink-0 place-items-center rounded-full',
        )}
      >
        <ExternalLink className="size-4" />
      </a>
    </section>
  );
}

function useTick(ms: number): number {
  const [count, setCount] = useState(0);

  useEffect(() => {
    const timer = setInterval(() => setCount((n) => n + 1), ms);
    return () => clearInterval(timer);
  }, [ms]);

  return count;
}
