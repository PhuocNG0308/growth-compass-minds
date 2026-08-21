import { createContext, useCallback, useContext, useState, type ReactNode } from 'react';
import { CircleAlert, CircleCheck } from 'lucide-react';
import { cn } from '@/lib/utils';

type Toast = { id: number; text: string; tone: 'ok' | 'error' };
type Notify = (text: string, tone?: Toast['tone']) => void;

const ToastContext = createContext<Notify>(() => {});

export const useToast = () => useContext(ToastContext);

export function ToastHost({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const notify = useCallback<Notify>((text, tone = 'ok') => {
    const id = Date.now();
    setToasts((current) => [...current, { id, text, tone }]);
    setTimeout(() => setToasts((current) => current.filter((item) => item.id !== id)), 5000);
  }, []);

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
              'bg-card flex max-w-md items-start gap-3 rounded-lg border px-4 py-3 text-sm shadow-lg',
              toast.tone === 'error' && 'border-destructive/40',
            )}
          >
            {toast.tone === 'error' ? (
              <CircleAlert className="text-destructive mt-1 size-4 shrink-0" />
            ) : (
              <CircleCheck className="text-primary mt-1 size-4 shrink-0" />
            )}
            <span className="text-pretty">{toast.text}</span>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}
