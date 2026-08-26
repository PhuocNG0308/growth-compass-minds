import { createContext, useCallback, useContext, useState, type ReactNode } from 'react';
import { CircleAlert, CircleCheck } from 'lucide-react';
import { useI18n } from '@/lib/i18n';
import { cn, focusRing } from '@/lib/utils';

type Toast = { id: number; text: string; tone: 'ok' | 'error'; undo?: () => void };
type Notify = (text: string, tone?: Toast['tone'], undo?: () => void) => void;

export const UNDO_MS = 5000;

const ToastContext = createContext<Notify>(() => {});

export const useToast = () => useContext(ToastContext);

export function ToastHost({ children }: { children: ReactNode }) {
  const { t } = useI18n();
  const [toasts, setToasts] = useState<Toast[]>([]);

  const dismiss = useCallback(
    (id: number) => setToasts((current) => current.filter((item) => item.id !== id)),
    [],
  );

  const notify = useCallback<Notify>(
    (text, tone = 'ok', undo) => {
      const id = Date.now();
      setToasts((current) => [...current, { id, text, tone, undo }]);
      setTimeout(() => dismiss(id), UNDO_MS);
    },
    [dismiss],
  );

  return (
    <ToastContext.Provider value={notify}>
      {children}
      <div
        role="status"
        aria-live="polite"
        className="safe-b pointer-events-none fixed inset-x-0 bottom-20 z-50 flex flex-col items-center gap-2 px-4 desktop:bottom-6"
      >
        {toasts.map((toast) => (
          <div
            key={toast.id}
            className={cn(
              'bg-card pointer-events-auto flex max-w-md items-start gap-3 rounded-lg border px-4 py-3 text-sm shadow-lg',
              toast.tone === 'error' && 'border-destructive/40',
            )}
          >
            {toast.tone === 'error' ? (
              <CircleAlert className="text-destructive mt-1 size-4 shrink-0" />
            ) : (
              <CircleCheck className="text-primary mt-1 size-4 shrink-0" />
            )}
            <span className="text-pretty">{toast.text}</span>
            {toast.undo && (
              <button
                onClick={() => {
                  toast.undo?.();
                  dismiss(toast.id);
                }}
                className={cn(
                  focusRing,
                  'text-primary -my-1 ml-2 shrink-0 rounded-md px-2 py-1 font-semibold hover:underline',
                )}
              >
                {t('toast.undo')}
              </button>
            )}
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}
