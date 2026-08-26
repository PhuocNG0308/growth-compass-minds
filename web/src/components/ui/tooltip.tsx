import type { ReactNode } from 'react';
import { Tooltip as TooltipPrimitive } from 'radix-ui';

export const TooltipProvider = TooltipPrimitive.Provider;

export function Tooltip({
  label,
  side = 'right',
  children,
}: {
  label: string;
  side?: 'top' | 'right' | 'bottom' | 'left';
  children: ReactNode;
}) {
  return (
    <TooltipPrimitive.Root>
      <TooltipPrimitive.Trigger asChild>{children}</TooltipPrimitive.Trigger>
      <TooltipPrimitive.Portal>
        <TooltipPrimitive.Content
          side={side}
          sideOffset={8}
          className="bg-popover fade-in z-50 rounded-md border px-3 py-2 text-xs font-medium shadow-md"
        >
          {label}
        </TooltipPrimitive.Content>
      </TooltipPrimitive.Portal>
    </TooltipPrimitive.Root>
  );
}
