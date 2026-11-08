/**
 * Tiny typed fetch wrapper around the GitDeck REST API.
 *
 * Errors are normalised into `ApiRequestError` so UI code can show the server
 * error code (`GIT_ERROR`, `CONFLICT`, …) and command output details.
 */
import type { ApiErrorBody } from '@gitdeck/shared';

export class ApiRequestError extends Error {
  readonly status: number;
  readonly code: string;
  readonly details?: unknown;

  constructor(status: number, code: string, message: string, details?: unknown) {
    super(message);
    this.name = 'ApiRequestError';
    this.status = status;
    this.code = code;
    this.details = details;
  }
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  let response: Response;
  try {
    response = await fetch(path, {
      ...init,
      headers: {
        Accept: 'application/json',
        ...(init?.body ? { 'Content-Type': 'application/json' } : {}),
        ...init?.headers,
      },
    });
  } catch (error) {
    throw new ApiRequestError(
      0,
      'NETWORK_ERROR',
      error instanceof Error ? error.message : 'Network request failed',
    );
  }

  const raw = await response.text();
  let payload: unknown = null;
  if (raw) {
    try {
      payload = JSON.parse(raw) as unknown;
    } catch {
      payload = raw;
    }
  }

  if (!response.ok) {
    const body = payload as ApiErrorBody | null;
    const code = body?.error?.code ?? 'INTERNAL';
    const message =
      body?.error?.message ??
      (typeof payload === 'string' ? payload : `${response.status} ${response.statusText}`);
    throw new ApiRequestError(response.status, code, message, body?.error?.details);
  }

  return payload as T;
}

export const api = {
  get: <T>(path: string): Promise<T> => request<T>(path),
  post: <T>(path: string, body?: unknown): Promise<T> =>
    request<T>(path, { method: 'POST', body: JSON.stringify(body ?? {}) }),
  patch: <T>(path: string, body?: unknown): Promise<T> =>
    request<T>(path, { method: 'PATCH', body: JSON.stringify(body ?? {}) }),
  put: <T>(path: string, body?: unknown): Promise<T> =>
    request<T>(path, { method: 'PUT', body: JSON.stringify(body ?? {}) }),
  delete: <T>(path: string, body?: unknown): Promise<T> =>
    request<T>(path, { method: 'DELETE', body: body === undefined ? undefined : JSON.stringify(body) }),
};

export function isApiError(error: unknown): error is ApiRequestError {
  return error instanceof ApiRequestError;
}

/** Human readable message for any thrown value. */
export function errorMessage(error: unknown, fallback = 'Unexpected error'): string {
  if (error instanceof ApiRequestError) return error.message;
  if (error instanceof Error) return error.message;
  if (typeof error === 'string') return error;
  return fallback;
}

/** Extract git stderr/stdout details when the server rejected a command. */
export function errorDetails(error: unknown): string | undefined {
  if (!(error instanceof ApiRequestError)) return undefined;
  const details = error.details as { stdout?: string; stderr?: string } | undefined;
  if (!details) return undefined;
  return [details.stderr, details.stdout].filter(Boolean).join('\n').trim() || undefined;
}
