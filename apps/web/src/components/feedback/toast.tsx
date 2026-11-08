/**
 * Toast notifications. `useToast()` returns helpers used by every feature:
 *
 *   const toast = useToast();
 *   toast.success(t('toast.committed'), commit.subject);
 *   toast.error(t('toast.failed'), errorMessage(error));
 */
import { AlertTriangle, CheckCircle2, Info, X, XCircle } from 'lucide-react';
import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { createPortal } from 'react-dom';
import { cn } from '@/lib/cn';

export type ToastVariant = 'success' | 'error' | 'info' | 'warning';

export interface ToastOptions {
  title: string;
  description?: string;
  duration?: number;
}

interface ToastItem extends ToastOptions {
  id: number;
  variant: ToastVariant;
}

interface ToastApi {
  toast: (variant: ToastVariant, options: ToastOptions) => void;
  success: (title: string, description?: string) => void;
  error: (title: string, description?: string) => void;
  info: (title: string, description?: string) => void;
  warning: (title: string, description?: string) => void;
  dismiss: (id: number) => void;
}

const ToastContext = createContext<ToastApi | null>(null);

const VARIANT_STYLES: Record<ToastVariant, { icon: ReactNode; border: string }> = {
  success: { icon: <CheckCircle2 className="h-4 w-4 text-success" />, border: 'border-success/40' },
  error: { icon: <XCircle className="h-4 w-4 text-danger" />, border: 'border-danger/40' },
  warning: { icon: <AlertTriangle className="h-4 w-4 text-warning" />, border: 'border-warning/40' },
  info: { icon: <Info className="h-4 w-4 text-info" />, border: 'border-info/40' },
};

export function ToastProvider({ children }: { children: ReactNode }): JSX.Element {
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const counter = useRef(0);
  const timers = useRef(new Map<number, ReturnType<typeof setTimeout>>());

  const dismiss = useCallback((id: number) => {
    const timer = timers.current.get(id);
    if (timer) clearTimeout(timer);
    timers.current.delete(id);
    setToasts((current) => current.filter((toast) => toast.id !== id));
  }, []);

  const push = useCallback(
    (variant: ToastVariant, options: ToastOptions) => {
      counter.current += 1;
      const id = counter.current;
      setToasts((current) => [...current.slice(-4), { ...options, id, variant }]);
      const timer = setTimeout(() => dismiss(id), options.duration ?? (variant === 'error' ? 7_000 : 4_000));
      timers.current.set(id, timer);
    },
    [dismiss],
  );

  const api = useMemo<ToastApi>(
    () => ({
      toast: push,
      success: (title, description) => push('success', { title, description }),
      error: (title, description) => push('error', { title, description }),
      info: (title, description) => push('info', { title, description }),
      warning: (title, description) => push('warning', { title, description }),
      dismiss,
    }),
    [push, dismiss],
  );

  return (
    <ToastContext.Provider value={api}>
      {children}
      {createPortal(
        <div className="pointer-events-none fixed bottom-10 right-4 z-[80] flex w-[340px] flex-col gap-2">
          {toasts.map((toast) => (
            <div
              key={toast.id}
              className={cn(
                'pointer-events-auto flex items-start gap-2.5 rounded-md border bg-overlay px-3 py-2.5 shadow-pop animate-slide-in-right',
                VARIANT_STYLES[toast.variant].border,
              )}
            >
              <span className="mt-0.5 shrink-0">{VARIANT_STYLES[toast.variant].icon}</span>
              <div className="min-w-0 flex-1">
                <p className="text-[13px] font-medium leading-5 text-fg">{toast.title}</p>
                {toast.description ? (
                  <p className="mt-0.5 whitespace-pre-wrap break-words text-xs leading-5 text-fg-muted">
                    {toast.description}
                  </p>
                ) : null}
              </div>
              <button
                type="button"
                onClick={() => dismiss(toast.id)}
                className="mt-0.5 shrink-0 rounded p-0.5 text-fg-muted transition-colors hover:bg-hover hover:text-fg"
                aria-label="Dismiss"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </div>
          ))}
        </div>,
        document.body,
      )}
    </ToastContext.Provider>
  );
}

export function useToast(): ToastApi {
  const context = useContext(ToastContext);
  if (!context) throw new Error('useToast must be used inside <ToastProvider>');
  return context;
}
