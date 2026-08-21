import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import { cn } from '@/lib/utils';

type Edges = { scrollable: boolean; atStart: boolean; atEnd: boolean; index: number; count: number };

const IDLE: Edges = { scrollable: false, atStart: true, atEnd: true, index: 0, count: 0 };

/**
 * A horizontal scroller only reads as one if the content is visibly cut. Left to itself the
 * last card lines up flush with the screen edge and looks like the end of the row, so this
 * tracks both edges and the strip fades whichever side still has something behind it.
 */
function useEdges(ref: React.RefObject<HTMLDivElement | null>): Edges {
  const [edges, setEdges] = useState<Edges>(IDLE);

  const measure = useCallback(() => {
    const node = ref.current;
    if (!node) return;

    const slack = node.scrollWidth - node.clientWidth;
    // count the real items, not the trailing spacer this component adds itself
    const count = node.querySelectorAll('[data-strip-item]').length;
    const index =
      count > 1 && slack > 0 ? Math.round((node.scrollLeft / slack) * (count - 1)) : 0;

    setEdges({
      // a couple of pixels of slack is rounding, not content
      scrollable: slack > 4,
      atStart: node.scrollLeft <= 4,
      atEnd: node.scrollLeft >= slack - 4,
      index,
      count,
    });
  }, [ref]);

  useEffect(() => {
    const node = ref.current;
    if (!node) return;

    measure();
    node.addEventListener('scroll', measure, { passive: true });

    // fonts, images and locale changes all move the width after first paint
    const observer = new ResizeObserver(measure);
    observer.observe(node);
    for (const child of node.children) observer.observe(child);

    return () => {
      node.removeEventListener('scroll', measure);
      observer.disconnect();
    };
  }, [measure, ref]);

  return edges;
}

export function Strip({
  children,
  snap = 'start',
  dots = false,
  align = 'center',
  className,
}: {
  children: ReactNode;
  /** `start` for cards you page through, `none` for a chip row you just flick. */
  snap?: 'start' | 'none';
  /** Position dots, for a strip of cards where knowing "3 of 5" matters. */
  dots?: boolean;
  align?: 'center' | 'stretch';
  className?: string;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const edges = useEdges(ref);

  return (
    <div className="relative">
      <div
        ref={ref}
        className={cn(
          'flex gap-3 overflow-x-auto scroll-px-4 px-4',
          // the trailing spacer below does the right-hand gap; padding alone is dropped by
          // some engines once the scroller overflows
          '[scrollbar-width:none] [&::-webkit-scrollbar]:hidden',
          align === 'center' ? 'items-center' : 'items-stretch',
          snap === 'start' ? 'snap-x snap-mandatory' : 'snap-none',
          className,
        )}
        style={
          edges.scrollable
            ? {
                maskImage: `linear-gradient(to right, ${edges.atStart ? '#000 0' : 'transparent 0, #000 24px'}, ${
                  edges.atEnd ? '#000 100%' : '#000 calc(100% - 32px), transparent 100%'
                })`,
              }
            : undefined
        }
      >
        {children}
        <div aria-hidden className="w-1 shrink-0" />
      </div>

      {dots && edges.count > 1 && edges.scrollable && (
        <div className="mt-3 flex justify-center gap-2" aria-hidden>
          {Array.from({ length: edges.count }, (_, index) => (
            <span
              key={index}
              className={cn(
                'h-2 rounded-full transition-all',
                index === edges.index ? 'bg-primary w-5' : 'bg-border w-2',
              )}
            />
          ))}
        </div>
      )}
    </div>
  );
}

export function StripItem({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <div data-strip-item className={cn('shrink-0 snap-start', className)}>
      {children}
    </div>
  );
}
