import type { ReactNode } from 'react';
import { Dialog as DialogPrimitive } from 'radix-ui';
import { X } from 'lucide-react';
import { useI18n } from '@/lib/i18n';
import { cn, focusRing } from '@/lib/utils';

/**
 * A column that slides in from the right. Asking the Mind about a video is a conversation
 * held *against* the numbers, so the chart stays on screen instead of being scrolled past.
 */
export function SidePanel({
  open,
  onOpenChange,
  title,
  children,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  children: ReactNode;
}) {
  const { t } = useI18n();

  return (
    <DialogPrimitive.Root open={open} onOpenChange={onOpenChange}>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay className="fade-in fixed inset-0 z-40 bg-black/40" />
        <DialogPrimitive.Content
          className={cn(
            'panel-in bg-card fixed inset-y-0 right-0 z-50 flex w-full max-w-lg flex-col border-l shadow-2xl outline-none',
          )}
        >
          <div className="flex shrink-0 items-center gap-3 border-b px-4 py-3">
            <DialogPrimitive.Title className="flex-1 truncate font-medium">{title}</DialogPrimitive.Title>
            <DialogPrimitive.Close
              aria-label={t('reply.cancel')}
              className={cn(focusRing, 'hover:bg-accent grid size-9 place-items-center rounded-full')}
            >
              <X className="size-5" />
            </DialogPrimitive.Close>
          </div>

          <div className="flex min-h-0 flex-1 flex-col">{children}</div>
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
}
