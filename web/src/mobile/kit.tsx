import { useState, type ReactNode } from 'react';
import { Dialog as DialogPrimitive } from 'radix-ui';
import { ChevronDown, X } from 'lucide-react';
import { Strip, StripItem } from '@/mobile/strip';
import { useI18n } from '@/lib/i18n';
import { cn, focusRing } from '@/lib/utils';

export { Strip, StripItem } from '@/mobile/strip';

/**
 * The mobile kit. Three rules run through all of it:
 *   - every target is at least 44px, because a thumb is not a mouse;
 *   - anything secondary starts closed, because a phone screen is a keyhole;
 *   - the one action a screen exists for sits at the bottom, in reach.
 */

/** Section heading. Small, quiet, and never competing with the content under it. */
export function Group({
  title,
  action,
  children,
}: {
  title?: string;
  action?: ReactNode;
  children: ReactNode;
}) {
  return (
    <section className="mt-8 first:mt-0">
      {title && (
        <div className="mb-3 flex items-center justify-between gap-3 px-4">
          <h2 className="text-base font-medium">{title}</h2>
          {action}
        </div>
      )}
      {children}
    </section>
  );
}

/** Rows separated by hairlines. A card is for objects you could pick up, not for every row. */
export function Rows({ children }: { children: ReactNode }) {
  return <div className="divide-y border-y">{children}</div>;
}

/** A number worth flicking to. Reads at a glance; no grid, no borders fighting each other. */
export function Stat({
  value,
  label,
  tone,
}: {
  value: string | number;
  label: string;
  tone?: 'lead' | 'alert';
}) {
  return (
    <StripItem className="bg-card min-w-32 rounded-xl border px-4 py-3">
      <div className="text-muted-foreground text-xs">{label}</div>
      <div
        className={cn(
          'mt-1 text-2xl leading-tight font-normal',
          tone === 'lead' && 'font-medium',
          tone === 'alert' && 'text-warning',
        )}
      >
        {value}
      </div>
    </StripItem>
  );
}

/** Metric pills: the numbers a creator actually scans, in one thumb-flickable line. */
export function Pills({ items }: { items: Array<{ label: string; value: string; tone?: string }> }) {
  return (
    <Strip snap="none">
      {items.map((item) => (
        <StripItem key={item.label} className="bg-secondary rounded-full px-4 py-2">
          <div className="text-muted-foreground text-[11px] leading-none">{item.label}</div>
          <div className={cn('tabular mt-1 text-sm font-semibold', item.tone)}>{item.value}</div>
        </StripItem>
      ))}
    </Strip>
  );
}

/** Progressive disclosure. Long prose starts folded; the summary line is the whole row. */
export function Disclosure({
  label,
  openLabel,
  children,
  defaultOpen = false,
}: {
  label: string;
  openLabel?: string;
  children: ReactNode;
  defaultOpen?: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen);

  return (
    <div>
      <button
        onClick={() => setOpen((on) => !on)}
        aria-expanded={open}
        className={cn(
          focusRing,
          'flex min-h-11 w-full items-center gap-1 rounded-md text-sm font-medium',
        )}
      >
        {open ? (openLabel ?? label) : label}
        <ChevronDown className={cn('size-4 transition-transform', open && 'rotate-180')} />
      </button>
      {open && <div className="pb-2">{children}</div>}
    </div>
  );
}

/** A whole section that starts closed. Only what you came for is open when you land. */
export function Fold({
  title,
  count,
  defaultOpen = false,
  children,
}: {
  title: string;
  count?: number;
  defaultOpen?: boolean;
  children: ReactNode;
}) {
  const [open, setOpen] = useState(defaultOpen);

  return (
    <section className="border-b">
      <button
        onClick={() => setOpen((on) => !on)}
        aria-expanded={open}
        className={cn(focusRing, 'flex min-h-14 w-full items-center gap-3 px-4 text-left')}
      >
        <span className="flex-1 font-medium">{title}</span>
        {count != null && count > 0 && (
          <span className="bg-secondary tabular rounded-full px-2 py-1 text-xs font-medium">
            {count}
          </span>
        )}
        <ChevronDown
          className={cn('text-muted-foreground size-5 transition-transform', open && 'rotate-180')}
        />
      </button>
      {open && <div className="pb-4">{children}</div>}
    </section>
  );
}

/**
 * Bottom sheet. Anything that would be a dialog on desktop arrives from the bottom edge
 * here, where the thumb already is.
 */
export function Sheet({
  open,
  onOpenChange,
  title,
  children,
  footer,
  scroll = true,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  children: ReactNode;
  footer?: ReactNode;
  /** Off when the content scrolls itself and needs to pin something to the bottom edge. */
  scroll?: boolean;
}) {
  const { t } = useI18n();

  return (
    <DialogPrimitive.Root open={open} onOpenChange={onOpenChange}>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay className="fade-in fixed inset-0 z-40 bg-black/50" />
        <DialogPrimitive.Content
          className={cn(
            'sheet-in bg-card safe-b fixed inset-x-0 bottom-0 z-50 flex max-h-[88dvh] flex-col',
            'rounded-t-3xl border-t shadow-2xl outline-none',
          )}
        >
          <div className="flex items-center gap-3 px-4 pt-3 pb-2">
            <span className="bg-border absolute inset-x-0 top-2 mx-auto h-1 w-10 rounded-full" />
            <DialogPrimitive.Title className="mt-3 flex-1 text-base font-semibold">
              {title}
            </DialogPrimitive.Title>
            <DialogPrimitive.Close
              aria-label={t('reply.cancel')}
              className={cn(focusRing, 'text-muted-foreground mt-3 grid size-11 place-items-center rounded-full')}
            >
              <X className="size-5" />
            </DialogPrimitive.Close>
          </div>

          <div className={cn('flex min-h-0 flex-1 flex-col', scroll && 'overflow-y-auto overscroll-contain')}>
            {children}
          </div>

          {footer && <div className="border-t px-4 py-3">{footer}</div>}
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
}

/** The one action of a screen, sitting flush on top of the tab bar rather than near it. */
export function StickyBar({ children }: { children: ReactNode }) {
  return (
    <div className="safe-x bg-background/95 fixed inset-x-0 bottom-[var(--tabs,64px)] z-30 border-t px-4 py-3 backdrop-blur">
      {children}
    </div>
  );
}

/** Reserve the height a StickyBar covers, so the last row is never trapped under it. */
export const STICKY_ROOM = 'pb-20';

/** Empty states carry the next action where there is one. */
export function Empty({ children, action }: { children: ReactNode; action?: ReactNode }) {
  return (
    <div className="px-4 py-8 text-center">
      <p className="text-muted-foreground text-[15px] text-pretty">{children}</p>
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}

/** Empty-state action, at touch size. */
export const emptyAction = cn(
  focusRing,
  'border-input hover:bg-accent inline-flex min-h-11 items-center gap-2 rounded-full border px-5 text-sm font-medium',
);

export function Skeletons({ rows = 3 }: { rows?: number }) {
  return (
    <div className="space-y-3 px-4" aria-busy="true">
      {Array.from({ length: rows }, (_, index) => (
        <div key={index} className="bg-muted h-24 animate-pulse rounded-xl" />
      ))}
    </div>
  );
}

export function Failed({ onRetry }: { onRetry?: () => void }) {
  const { t } = useI18n();

  return (
    <div className="border-destructive/30 mx-4 rounded-xl border px-4 py-6 text-center">
      <p className="text-destructive">{t('state.error')}</p>
      {onRetry && (
        <button
          onClick={onRetry}
          className={cn(
            focusRing,
            'border-input hover:bg-accent mt-4 min-h-11 rounded-full border px-5 text-sm font-medium',
          )}
        >
          {t('state.retry')}
        </button>
      )}
    </div>
  );
}
