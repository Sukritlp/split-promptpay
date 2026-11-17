import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ApiError } from '@/lib/api';
import {
  authFetch,
  authStore,
  getAccessToken,
  refreshSession,
  resetAuthClientForTests,
  restoreSession,
  setSession,
} from '@/lib/auth-client';
import { apiError, authHeader, deferred, json, mockApi, session, USER } from './helpers/fetch-mock';

beforeEach(() => {
  resetAuthClientForTests();
  // jsdom ไม่มี Web Locks — test ส่วนใหญ่จึงทดสอบ single-flight ภายใน tab
  vi.stubGlobal('navigator', { ...navigator, locks: undefined });
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('refreshSession', () => {
  it('stores the session from /api/auth/refresh', async () => {
    mockApi({ '/api/auth/refresh': () => json(200, session('t1')) });

    await expect(refreshSession()).resolves.toEqual(session('t1'));
    expect(getAccessToken()).toBe('t1');
    expect(authStore.getState()).toEqual({ status: 'authenticated', user: USER });
  });

  it('becomes anonymous on 401', async () => {
    mockApi({ '/api/auth/refresh': () => apiError(401, 'INVALID_REFRESH_TOKEN') });

    await expect(refreshSession()).resolves.toBeNull();
    expect(authStore.getState()).toEqual({ status: 'anonymous' });
  });

  it('does NOT log the user out on a network error (temporary problem)', async () => {
    setSession(session('t1'));
    mockApi({ '/api/auth/refresh': () => Promise.reject(new TypeError('Failed to fetch')) });

    await expect(refreshSession()).rejects.toBeInstanceOf(ApiError);
    expect(authStore.getState().status).toBe('authenticated');
  });

  it('single-flight: 5 concurrent calls send exactly one request', async () => {
    const reply = deferred<Response>();
    const api = mockApi({ '/api/auth/refresh': () => reply.promise });

    const calls = Array.from({ length: 5 }, () => refreshSession());
    reply.resolve(json(200, session('t1')));
    const results = await Promise.all(calls);

    expect(api.calls('/api/auth/refresh')).toHaveLength(1);
    expect(new Set(results.map((r) => r?.accessToken))).toEqual(new Set(['t1']));
  });

  it('allows a new refresh after the previous one finished', async () => {
    const api = mockApi({
      '/api/auth/refresh': [() => json(200, session('t1')), () => json(200, session('t2'))],
    });

    await refreshSession();
    await refreshSession();

    expect(api.calls('/api/auth/refresh')).toHaveLength(2);
    expect(getAccessToken()).toBe('t2');
  });

  it('allows a new refresh after the previous one failed', async () => {
    const api = mockApi({
      '/api/auth/refresh': [
        () => Promise.reject(new TypeError('Failed to fetch')),
        () => json(200, session('t1')),
      ],
    });

    await refreshSession().catch(() => {});
    await refreshSession();

    expect(api.calls('/api/auth/refresh')).toHaveLength(2);
  });

  it('uses the Web Locks API when available (cross-tab single-flight)', async () => {
    const request = vi.fn((_name: string, cb: () => Promise<unknown>) => cb());
    vi.stubGlobal('navigator', { ...navigator, locks: { request } });
    mockApi({ '/api/auth/refresh': () => json(200, session('t1')) });

    await refreshSession();

    expect(request).toHaveBeenCalledWith('split-promptpay:refresh', expect.any(Function));
  });
});

describe('restoreSession', () => {
  it('only runs while the state is still loading', async () => {
    const api = mockApi({ '/api/auth/refresh': () => json(200, session('t1')) });

    await restoreSession();
    await restoreSession();

    expect(api.calls('/api/auth/refresh')).toHaveLength(1);
  });

  it('called twice at once (React StrictMode) sends one request', async () => {
    const api = mockApi({ '/api/auth/refresh': () => json(200, session('t1')) });

    await Promise.all([restoreSession(), restoreSession()]);

    expect(api.calls('/api/auth/refresh')).toHaveLength(1);
  });

  it('becomes anonymous if the API is unreachable at startup', async () => {
    mockApi({ '/api/auth/refresh': () => Promise.reject(new TypeError('Failed to fetch')) });

    await restoreSession();

    expect(authStore.getState()).toEqual({ status: 'anonymous' });
  });
});

describe('authFetch', () => {
  it('sends the access token as a Bearer header', async () => {
    setSession(session('t1'));
    const api = mockApi({ '/api/me': () => json(200, { user: USER }) });

    await authFetch('/api/me');

    expect(authHeader(api.calls('/api/me')[0]?.[1])).toBe('Bearer t1');
  });

  it('on INVALID_TOKEN: refreshes once and retries with the new token', async () => {
    setSession(session('expired'));
    const api = mockApi({
      '/api/me': (init) =>
        authHeader(init) === 'Bearer fresh'
          ? json(200, { user: USER })
          : apiError(401, 'INVALID_TOKEN'),
      '/api/auth/refresh': () => json(200, session('fresh')),
    });

    await expect(authFetch('/api/me')).resolves.toEqual({ user: USER });
    expect(api.calls('/api/auth/refresh')).toHaveLength(1);
    expect(api.calls('/api/me')).toHaveLength(2);
  });

  it('5 requests that all hit an expired token trigger only one refresh', async () => {
    setSession(session('expired'));
    const api = mockApi({
      '/api/me': (init) =>
        authHeader(init) === 'Bearer fresh'
          ? json(200, { user: USER })
          : apiError(401, 'INVALID_TOKEN'),
      '/api/auth/refresh': () => json(200, session('fresh')),
    });

    await Promise.all(Array.from({ length: 5 }, () => authFetch('/api/me')));

    expect(api.calls('/api/auth/refresh')).toHaveLength(1);
  });

  it('reuses a token another request already refreshed instead of refreshing again', async () => {
    setSession(session('old'));
    const slow = deferred<Response>();
    const api = mockApi({
      '/api/me': [() => slow.promise, () => json(200, { user: USER })],
    });

    const pending = authFetch('/api/me'); // ส่งด้วย token เก่า ยังไม่ตอบ
    setSession(session('new')); // ระหว่างนั้น request อื่น refresh ไปแล้ว
    slow.resolve(apiError(401, 'INVALID_TOKEN'));
    await pending;

    expect(api.calls('/api/auth/refresh')).toHaveLength(0);
    expect(authHeader(api.calls('/api/me')[1]?.[1])).toBe('Bearer new');
  });

  it('retries at most once (no infinite loop if the API keeps rejecting)', async () => {
    setSession(session('t1'));
    const api = mockApi({
      '/api/me': () => apiError(401, 'INVALID_TOKEN'),
      '/api/auth/refresh': () => json(200, session('t2')),
    });

    await expect(authFetch('/api/me')).rejects.toMatchObject({ code: 'INVALID_TOKEN' });
    expect(api.calls('/api/me')).toHaveLength(2);
    expect(api.calls('/api/auth/refresh')).toHaveLength(1);
  });

  it('becomes anonymous and throws when the refresh fails', async () => {
    setSession(session('expired'));
    mockApi({
      '/api/me': () => apiError(401, 'INVALID_TOKEN'),
      '/api/auth/refresh': () => apiError(401, 'INVALID_REFRESH_TOKEN'),
    });

    await expect(authFetch('/api/me')).rejects.toMatchObject({ status: 401 });
    expect(authStore.getState()).toEqual({ status: 'anonymous' });
  });

  it('does not refresh on errors other than an auth 401', async () => {
    setSession(session('t1'));
    const api = mockApi({
      '/api/me': () => apiError(500, 'INTERNAL_ERROR'),
      '/api/auth/refresh': () => json(200, session('t2')),
    });

    await expect(authFetch('/api/me')).rejects.toMatchObject({ status: 500 });
    expect(api.calls('/api/auth/refresh')).toHaveLength(0);
  });

  it('notifies subscribers when the session changes', () => {
    const listener = vi.fn();
    authStore.subscribe(listener);

    setSession(session('t1'));
    setSession(null);

    expect(listener).toHaveBeenCalledTimes(2);
  });
});
