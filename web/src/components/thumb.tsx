import { Video } from 'lucide-react';
import { cn } from '@/lib/utils';

/** Creators recognise their work by the thumbnail long before they read the title. */
export function Thumb({
  url,
  title,
  duration,
  className,
}: {
  url: string | null;
  title: string;
  duration?: string;
  className?: string;
}) {
  return (
    <div className={cn('bg-muted relative aspect-video shrink-0 overflow-hidden rounded-lg', className)}>
      {url ? (
        <img src={url} alt={title} loading="lazy" className="size-full object-cover" />
      ) : (
        <span className="text-muted-foreground grid size-full place-items-center">
          <Video className="size-1/4" />
        </span>
      )}
      {duration && (
        <span className="tabular absolute right-1 bottom-1 rounded bg-black/75 px-2 py-1 text-[11px] font-medium text-white">
          {duration}
        </span>
      )}
    </div>
  );
}

/** The retention shape at a glance, so a card says "this one loses people early". */
export function Sparkline({ points, className }: { points: number[]; className?: string }) {
  if (points.length < 2) return null;

  const step = 100 / (points.length - 1);
  const path = points
    .map((value, i) => `${i ? 'L' : 'M'}${(i * step).toFixed(1)} ${(28 - Math.min(Math.max(value, 0), 1) * 26).toFixed(1)}`)
    .join(' ');

  return (
    <svg viewBox="0 0 100 30" preserveAspectRatio="none" className={cn('h-8 w-full', className)}>
      <path d={`${path} L100 30 L0 30 Z`} className="fill-primary opacity-15" />
      <path d={path} className="stroke-primary fill-none" strokeWidth={2} vectorEffect="non-scaling-stroke" />
    </svg>
  );
}
