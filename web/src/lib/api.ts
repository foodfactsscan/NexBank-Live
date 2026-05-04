// Thin fetch wrapper:
// - Injects access token, transparently refreshes on 401, retries once.
// - Survives a token rotation race by serializing refresh through a single
//   in-flight promise.
// - Surface area mirrors the backend route shape so call-sites read like the
//   API docs.

const API_ROOT = '/api/v1';

const ACCESS_KEY = 'nexbank_access';
const REFRESH_KEY = 'nexbank_refresh';

let accessToken: string | null = localStorage.getItem(ACCESS_KEY);
let refreshToken: string | null = localStorage.getItem(REFRESH_KEY);

const listeners = new Set<(t: string | null) => void>();

export function getAccessToken() { return accessToken; }
export function getRefreshToken() { return refreshToken; }

export function setTokens(access: string | null, refresh: string | null) {
  accessToken = access;
  refreshToken = refresh;
  if (access) localStorage.setItem(ACCESS_KEY, access); else localStorage.removeItem(ACCESS_KEY);
  if (refresh) localStorage.setItem(REFRESH_KEY, refresh); else localStorage.removeItem(REFRESH_KEY);
  listeners.forEach((fn) => fn(access));
}

export function onAuthChange(fn: (t: string | null) => void) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

let refreshInFlight: Promise<string | null> | null = null;
async function refreshAccess(): Promise<string | null> {
  if (!refreshToken) return null;
  if (refreshInFlight) return refreshInFlight;
  refreshInFlight = (async () => {
    try {
      const res = await fetch(`${API_ROOT}/auth/refresh`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ refreshToken }),
      });
      if (!res.ok) {
        setTokens(null, null);
        return null;
      }
      const body = await res.json();
      setTokens(body.accessToken, body.refreshToken);
      return body.accessToken as string;
    } catch {
      setTokens(null, null);
      return null;
    } finally {
      refreshInFlight = null;
    }
  })();
  return refreshInFlight;
}

export class ApiError extends Error {
  status: number;
  code?: string;
  details?: unknown;
  requestId?: string;
  constructor(message: string, status: number, extra: { code?: string; details?: unknown; requestId?: string } = {}) {
    super(message);
    this.status = status;
    Object.assign(this, extra);
  }
}

interface RequestOpts {
  method?: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
  body?: unknown;
  headers?: Record<string, string>;
  idempotencyKey?: string;
  signal?: AbortSignal;
  raw?: boolean; // skip auto-JSON parse — used by the PDF download
}

async function request<T = unknown>(path: string, opts: RequestOpts = {}, retried = false): Promise<T> {
  const headers: Record<string, string> = {
    Accept: 'application/json',
    ...(opts.headers || {}),
  };
  if (opts.body && !(opts.body instanceof FormData)) {
    headers['Content-Type'] = 'application/json';
  }
  if (accessToken) headers['Authorization'] = `Bearer ${accessToken}`;
  if (opts.idempotencyKey) headers['Idempotency-Key'] = opts.idempotencyKey;

  const res = await fetch(`${API_ROOT}${path}`, {
    method: opts.method || 'GET',
    headers,
    body:
      opts.body == null ? undefined :
      opts.body instanceof FormData ? opts.body :
      JSON.stringify(opts.body),
    signal: opts.signal,
  });

  if (res.status === 401 && !retried && refreshToken) {
    const newToken = await refreshAccess();
    if (newToken) return request<T>(path, opts, true);
  }

  if (opts.raw) return res as unknown as T;

  const contentType = res.headers.get('content-type') || '';
  const data = contentType.includes('application/json') ? await res.json().catch(() => ({})) : ({});

  if (!res.ok) {
    throw new ApiError(
      data.error || data.message || `HTTP ${res.status}`,
      res.status,
      {
        code: data.code,
        details: data.details,
        requestId: res.headers.get('x-request-id') || data.requestId,
      },
    );
  }
  return data as T;
}

// Convenience verb helpers used by the rest of the app.
export const api = {
  get:    <T = unknown>(p: string, o: Omit<RequestOpts, 'method' | 'body'> = {}) => request<T>(p, { ...o, method: 'GET' }),
  post:   <T = unknown>(p: string, body?: unknown, o: Omit<RequestOpts, 'method' | 'body'> = {}) => request<T>(p, { ...o, method: 'POST', body }),
  put:    <T = unknown>(p: string, body?: unknown, o: Omit<RequestOpts, 'method' | 'body'> = {}) => request<T>(p, { ...o, method: 'PUT', body }),
  patch:  <T = unknown>(p: string, body?: unknown, o: Omit<RequestOpts, 'method' | 'body'> = {}) => request<T>(p, { ...o, method: 'PATCH', body }),
  del:    <T = unknown>(p: string, o: Omit<RequestOpts, 'method' | 'body'> = {}) => request<T>(p, { ...o, method: 'DELETE' }),
  raw:    (p: string, o: Omit<RequestOpts, 'raw'> = {}) => request<Response>(p, { ...o, raw: true }),
};

// New idempotency key for one logical operation. Use this for transfers,
// goal contributions, and any other money movement.
export function newIdempotencyKey() {
  // crypto.randomUUID is universal in modern browsers.
  return crypto.randomUUID();
}
