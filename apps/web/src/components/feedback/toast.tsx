/**
 * Toast notifications. `useToast()` returns helpers used by every feature:
 *
 *   const toast = useToast();
 *   toast.success(t('toast.committed'), commit.subject);
 *   toast.error(t('toast.failed'), errorMessage(error));
 *
 * Toasts stack bottom-right, pause their lifetime while hovered, expose a
 * progress indicator and a dismiss button, and use an aria-live region.
 */
import { AlertTriangle, CheckCircle2, Info, X, XCircle } from 'lucide-react';
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
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
  duration: number;
}

interface ToastApi {
  toast: (variant: ToastVariant, options: ToastOptions) => void;
  success: (title: string, description?: string) => void;
  error: (title: string, description?: string) => void;
  info: (title: string, description?: string) => void;
  warning: (title: string, description?: string) => void;
  dismiss: (id: number) => void;
}

interface TimerEntry {
  timeout: ReturnType<typeof setTimeout> | null;
  remaining: number;
  startedAt: number;
}

const ToastContext = createContext<ToastApi | null>(null);

const MAX_TOASTS = 5;

const VARIANT_META: Record<
  ToastVariant,
  { icon: ReactNode; accent: string; bar: string; role: 'status' | 'alert' }
> = {
  success: {
    icon: <CheckCircle2 className="h-4 w-4 text-success" aria-hidden />,
    accent: 'border-l-success',
    bar: 'bg-success',
    role: 'status',
  },
  error: {
    icon: <XCircle className="h-4 w-4 text-danger" aria-hidden />,
    accent: 'border-l-danger',
    bar: 'bg-danger',
    role: 'alert',
  },
  warning: {
    icon: <AlertTriangle className="h-4 w-4 text-warning" aria-hidden />,
    accent: 'border-l-warning',
    bar: 'bg-warning',
    role: 'status',
  },
  info: {
    icon: <Info className="h-4 w-4 text-info" aria-hidden />,
    accent: 'border-l-info',
    bar: 'bg-info',
    role: 'status',
  },
};

export function ToastProvider({ children }: { children: ReactNode }): JSX.Element {
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const [pausedIds, setPausedIds] = useState<number[]>([]);
  const counter = useRef(0);
  const timers = useRef(new Map<number, TimerEntry>());

  const clearTimer = useCallback((id: number) => {
    const entry = timers.current.get(id);
    if (!entry) return;
    if (entry.timeout) clearTimeout(entry.timeout);
    timers.current.delete(id);
  }, []);

  const dismiss = useCallback(
    (id: number) => {
      clearTimer(id);
      setPausedIds((current) => current.filter((value) => value !== id));
      setToasts((current) => current.filter((toast) => toast.id !== id));
    },
    [clearTimer],
  );

  const startTimer = useCallback(
    (id: number, duration: number) => {
      const entry: TimerEntry = {
        timeout: setTimeout(() => dismiss(id), duration),
        remaining: duration,
        startedAt: Date.now(),
      };
      timers.current.set(id, entry);
    },
    [dismiss],
  );

  const pauseTimer = useCallback((id: number) => {
    const entry = timers.current.get(id);
    if (!entry || !entry.timeout) return;
    clearTimeout(entry.timeout);
    entry.timeout = null;
    entry.remaining = Math.max(0, entry.remaining - (Date.now() - entry.startedAt));
  }, []);

  const resumeTimer = useCallback(
    (id: number) => {
      const entry = timers.current.get(id);
      if (!entry || entry.timeout) return;
      entry.startedAt = Date.now();
      entry.timeout = setTimeout(() => dismiss(id), Math.max(0, entry.remaining));
    },
    [dismiss],
  );

  const push = useCallback(
    (variant: ToastVariant, options: ToastOptions) => {
      counter.current += 1;
      const id = counter.current;
      const duration = options.duration ?? (variant === 'error' ? 7_000 : 4_000);
      setToasts((current) => [...current.slice(-(MAX_TOASTS - 1)), { ...options, id, variant, duration }]);
      startTimer(id, duration);
    },
    [startTimer],
  );

  useEffect(() => {
    const timerMap = timers.current;
    return () => {
      for (const entry of timerMap.values()) {
        if (entry.timeout) clearTimeout(entry.timeout);
      }
      timerMap.clear();
    };
  }, []);

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

  const handleEnter = (id: number) => {
    pauseTimer(id);
    setPausedIds((current) => (current.includes(id) ? current : [...current, id]));
  };

  const handleLeave = (id: number) => {
    resumeTimer(id);
    setPausedIds((current) => current.filter((value) => value !== id));
  };

  return (
    <ToastContext.Provider value={api}>
      {children}
      {createPortal(
        <div
          className="pointer-events-none fixed bottom-10 right-4 z-[80] flex w-[360px] max-w-[calc(100vw-2rem)] flex-col gap-2"
          aria-live="polite"
          aria-relevant="additions text"
        >
          {toasts.map((toast) => {
            const meta = VARIANT_META[toast.variant];
            const paused = pausedIds.includes(toast.id);
            return (
              <div
                key={toast.id}
                role={meta.role}
                onMouseEnter={() => handleEnter(toast.id)}
                onMouseLeave={() => handleLeave(toast.id)}
                className={cn(
                  'pointer-events-auto overflow-hidden rounded-md border border-border border-l-2 bg-overlay shadow-pop animate-slide-in-right',
                  meta.accent,
                )}
              >
                <div className="flex items-start gap-2.5 px-3 py-2.5">
                  <span className="mt-0.5 shrink-0">{meta.icon}</span>
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
                    className="mt-0.5 shrink-0 rounded p-0.5 text-fg-muted transition-colors hover:bg-hover hover:text-fg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
                    aria-label="Dismiss"
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                </div>
                <div className="h-0.5 w-full bg-hover" aria-hidden>
                  <div
                    className={cn('toast-progress h-full', meta.bar)}
                    style={{
                      animationDuration: `${toast.duration}ms`,
                      animationPlayState: paused ? 'paused' : 'running',
                    }}
                  />
                </div>
              </div>
            );
          })}
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
