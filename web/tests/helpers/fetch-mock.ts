import { vi } from 'vitest';
import type { AuthResult, PublicUser } from '@/lib/types';

export const USER: PublicUser = {
  id: '6f1c2a3e-7b4d-4c8e-9f10-1a2b3c4d5e6f',
  name: 'สมชาย',
  email: 'somchai@example.com',
  promptpayId: null,
  createdAt: '2026-11-17T00:00:00.000Z',
};

export const session = (accessToken: string): AuthResult => ({ user: USER, accessToken });

export const json = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });

export const apiError = (status: number, code: string, message = code) =>
  json(status, { error: { code, message } });

export type Handler = (init: RequestInit | undefined) => Response | Promise<Response>;

/**
 * fetch ปลอมที่ตอบตาม path — ไม่มี handler = test fail ทันที (กันเรียก API ที่ไม่ได้ตั้งใจ)
 * handler เป็น array ได้: ตอบตามลำดับครั้งที่เรียก
 */
export function mockApi(routes: Record<string, Handler | Handler[]>) {
  const counters = new Map<string, number>();
  const fn = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    const path = typeof input === 'string' ? input : input.toString();
    const route = routes[path];
    if (!route) throw new Error(`Unexpected fetch to ${path}`);
    const n = counters.get(path) ?? 0;
    counters.set(path, n + 1);
    const handler = Array.isArray(route) ? route[Math.min(n, route.length - 1)] : route;
    if (!handler) throw new Error(`No handler for call #${n + 1} to ${path}`);
    return handler(init);
  });
  vi.stubGlobal('fetch', fn);
  return {
    fetch: fn,
    calls: (path: string) => fn.mock.calls.filter(([input]) => String(input) === path),
  };
}

export function authHeader(init: RequestInit | undefined): string | undefined {
  return (init?.headers as Record<string, string> | undefined)?.Authorization;
}

/** promise ที่สั่ง resolve เองได้ — ใช้จำลอง request ที่ยังไม่ตอบ */
export function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((r) => (resolve = r));
  return { promise, resolve };
}
