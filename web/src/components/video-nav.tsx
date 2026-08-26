import { ArrowLeft, ChartColumn, ChartSpline, ExternalLink, MessageSquare, Sparkles } from 'lucide-react';
import { NavTip, navItem, navLabel } from '@/components/shell';
import { Thumb } from '@/components/thumb';
import { Skeleton } from '@/components/ui/skeleton';
import { useFormat } from '@/lib/format';
import { useI18n } from '@/lib/i18n';
import { cn, focusRing } from '@/lib/utils';
import type { PostDetail } from '@/lib/types';

export const SECTIONS = ['analytics', 'retention', 'comments'] as const;
export type PostSection = (typeof SECTIONS)[number] | 'ask';

const ICON = {
  analytics: ChartColumn,
  retention: ChartSpline,
  comments: MessageSquare,
} as const;

export const postHref = (ytVideoId: string, section?: PostSection) =>
  `#/post/${encodeURIComponent(ytVideoId)}` +
  (section && section !== 'analytics' ? `/${section}` : '');

/**
 * On a video screen the channel nav answers a question nobody is asking. This takes its place:
 * which video you are inside, how to leave it, and the few views of it worth switching between.
 */
export function VideoNav({
  ytVideoId,
  post,
  section,
  behind,
  wide,
}: {
  ytVideoId: string;
  post: PostDetail['post'] | null;
  section: PostSection;
  /** The section the ask panel is layered over, so the nav does not jump while it is open. */
  behind: Exclude<PostSection, 'ask'>;
  wide: boolean;
}) {
  const { t } = useI18n();
  const f = useFormat();

  return (
    <>
      <NavTip label={t('post.back')} wide={wide}>
        <a href="#/" className={cn(navItem(false, wide), 'shrink-0')}>
          <ArrowLeft className="size-5 shrink-0" />
          <span className={navLabel(wide)}>{t('post.back')}</span>
        </a>
      </NavTip>

      {wide && (
        <div className="px-6 pt-4 pb-6">
          {post ? (
            <>
              <Thumb
                url={post.thumbnailUrl}
                title={post.title}
                duration={post.durationS == null ? undefined : f.clock(post.durationS)}
                className="rounded-lg"
              />
              <p className="mt-3 line-clamp-2 text-sm font-medium">{post.title}</p>
              <p className="text-muted-foreground mt-1 text-xs">{f.shortDate(post.publishedAt)}</p>
            </>
          ) : (
            <Skeleton className="aspect-video w-full rounded-lg" />
          )}
        </div>
      )}

      <nav className="flex flex-col">
        {SECTIONS.map((key) => {
          const Icon = ICON[key];
          const active = key === behind;
          return (
            <NavTip key={key} label={t(`section.${key}`)} wide={wide}>
              <a
                href={postHref(ytVideoId, key)}
                aria-current={active ? 'page' : undefined}
                className={navItem(active, wide)}
              >
                <Icon className={cn('size-5 shrink-0', active && 'text-foreground')} />
                <span className={cn(navLabel(wide), active && 'text-foreground')}>
                  {t(`section.${key}`)}
                </span>
                {wide && key === 'comments' && post && (
                  <span className="tabular text-muted-foreground ml-auto text-xs">
                    {post.commentCount}
                  </span>
                )}
              </a>
            </NavTip>
          );
        })}
      </nav>

      <div className="mt-4 flex flex-col border-t pt-4">
        <NavTip label={t('ask.title')} wide={wide}>
          <a href={postHref(ytVideoId, 'ask')} className={navItem(section === 'ask', wide)}>
            <Sparkles className="size-5 shrink-0" />
            <span className={navLabel(wide)}>{t('ask.title')}</span>
          </a>
        </NavTip>

        <NavTip label={t('feed.onYouTube')} wide={wide}>
          <a
            href={`https://youtu.be/${ytVideoId}`}
            target="_blank"
            rel="noreferrer"
            className={navItem(false, wide)}
          >
            <ExternalLink className="size-5 shrink-0" />
            <span className={navLabel(wide)}>{t('feed.onYouTube')}</span>
          </a>
        </NavTip>
      </div>
    </>
  );
}

/** The horizontal half of the same answer, for when the column beside it is collapsed. */
export function Crumbs({ title, section }: { title: string; section: Exclude<PostSection, 'ask'> }) {
  const { t } = useI18n();

  return (
    <nav aria-label={t('nav.where')} className="text-muted-foreground mb-4 flex items-center gap-2 text-sm">
      <a href="#/" className={cn(focusRing, 'hover:text-foreground rounded-md')}>
        {t('title.feed')}
      </a>
      <span aria-hidden>/</span>
      <span className="max-w-64 truncate">{title}</span>
      <span aria-hidden>/</span>
      <span className="text-foreground">{t(`section.${section}`)}</span>
    </nav>
  );
}
