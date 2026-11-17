import { describe, expect, it, vi } from 'vitest';
import { ApiError, apiFetch } from '@/lib/api';

function mockFetch(impl: (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>) {
  const fn = vi.fn(impl);
  vi.stubGlobal('fetch', fn);
  return fn;
}

const json = (status: number, body: unknown) =>
  Promise.resolve(
    new Response(JSON.stringify(body), {
      status,
      headers: { 'Content-Type': 'application/json' },
    }),
  );

async function catchApiError(promise: Promise<unknown>): Promise<ApiError> {
  const err: unknown = await promise.catch((e: unknown) => e);
  expect(err).toBeInstanceOf(ApiError);
  return err as ApiError;
}

describe('apiFetch', () => {
  it('returns the parsed JSON body on success', async () => {
    mockFetch(() => json(200, { status: 'ok' }));

    await expect(apiFetch('/api/ready')).resolves.toEqual({ status: 'ok' });
  });

  it('calls the given path on the same origin', async () => {
    const fetchMock = mockFetch(() => json(200, {}));

    await apiFetch('/api/ready');

    expect(fetchMock).toHaveBeenCalledWith(
      '/api/ready',
      expect.objectContaining({ credentials: 'same-origin' }),
    );
  });

  it('serializes an object body as JSON with the right header', async () => {
    const fetchMock = mockFetch(() => json(201, {}));

    await apiFetch('/api/auth/register', { method: 'POST', body: { name: 'สมชาย' } });
    const init = fetchMock.mock.calls[0]?.[1];

    expect(init?.body).toBe(JSON.stringify({ name: 'สมชาย' }));
    expect(init?.headers).toMatchObject({ 'Content-Type': 'application/json' });
  });

  it('does not send Content-Type when there is no body', async () => {
    const fetchMock = mockFetch(() => json(200, {}));

    await apiFetch('/api/ready');

    expect(fetchMock.mock.calls[0]?.[1]?.headers).not.toHaveProperty('Content-Type');
  });

  it('returns undefined for 204 No Content', async () => {
    mockFetch(() => Promise.resolve(new Response(null, { status: 204 })));

    await expect(apiFetch('/api/auth/logout', { method: 'POST' })).resolves.toBeUndefined();
  });

  it('turns the API error format into an ApiError', async () => {
    mockFetch(() =>
      json(409, { error: { code: 'EMAIL_TAKEN', message: 'Email is already registered' } }),
    );

    const err = await catchApiError(apiFetch('/api/auth/register'));

    expect(err).toMatchObject({
      status: 409,
      code: 'EMAIL_TAKEN',
      message: 'Email is already registered',
    });
  });

  it('keeps validation details', async () => {
    const details = [{ path: 'email', message: 'Invalid email' }];
    mockFetch(() => json(400, { error: { code: 'VALIDATION_ERROR', message: 'bad', details } }));

    const err = await catchApiError(apiFetch('/api/auth/register'));

    expect(err.details).toEqual(details);
  });

  it('handles a non-JSON error body (e.g. the proxy cannot reach the API)', async () => {
    mockFetch(() =>
      Promise.resolve(new Response('<html>Internal Server Error</html>', { status: 500 })),
    );

    const err = await catchApiError(apiFetch('/api/ready'));

    expect(err).toMatchObject({ status: 500, code: 'HTTP_ERROR' });
  });

  it('handles a JSON error body in an unexpected shape', async () => {
    mockFetch(() => json(503, { status: 'unavailable' }));

    const err = await catchApiError(apiFetch('/api/ready'));

    expect(err).toMatchObject({ status: 503, code: 'HTTP_ERROR' });
  });

  it('reports network failures as status 0 NETWORK_ERROR', async () => {
    mockFetch(() => Promise.reject(new TypeError('Failed to fetch')));

    const err = await catchApiError(apiFetch('/api/ready'));

    expect(err).toMatchObject({ status: 0, code: 'NETWORK_ERROR' });
  });

  it('rethrows aborts as-is so callers can ignore them', async () => {
    mockFetch(() => Promise.reject(new DOMException('aborted', 'AbortError')));

    await expect(apiFetch('/api/ready')).rejects.toMatchObject({ name: 'AbortError' });
  });
});
