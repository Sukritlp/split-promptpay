/**
 * สถานะการล็อกอินฝั่ง browser
 *
 * - access token เก็บใน memory (ตัวแปรใน module) เท่านั้น ไม่ใช้ localStorage
 *   → XSS อ่าน localStorage ได้ แต่ refresh token อยู่ใน httpOnly cookie ที่ JS อ่านไม่ได้
 *   → reload แล้ว token หาย: กู้คืนด้วย POST /api/auth/refresh (browser แนบ cookie ให้เอง)
 *
 * - refresh แบบ single-flight (สำคัญมาก): API ใช้นโยบาย reuse detection แบบเข้มงวด
 *   ถ้ายิง refresh 2 ครั้งด้วย cookie เดียวกัน ครั้งที่สองถูกมองว่า "ใช้ token ซ้ำ" → หลุดทั้ง session
 *   - ใน tab เดียว: ทุกคนที่ต้องการ refresh พร้อมกันรอ promise ตัวเดียวกัน
 *     (รวมถึง React StrictMode ที่รัน effect 2 รอบตอน dev)
 *   - ข้าม tab: Web Locks API ให้ refresh ต่อคิวกัน tab ที่สองจะได้ cookie ตัวใหม่แล้ว
 */
import { ApiError, apiFetch, type ApiFetchOptions } from './api';
import type { AuthResult, PublicUser } from './types';

export type AuthState =
  { status: 'loading' } | { status: 'authenticated'; user: PublicUser } | { status: 'anonymous' };

const REFRESH_LOCK = 'split-promptpay:refresh';

let state: AuthState = { status: 'loading' };
let accessToken: string | null = null;
let inFlightRefresh: Promise<AuthResult | null> | null = null;
const listeners = new Set<() => void>();

function emit(): void {
  for (const listener of listeners) listener();
}

/** ใช้กับ useSyncExternalStore */
export const authStore = {
  getState: (): AuthState => state,
  subscribe(listener: () => void): () => void {
    listeners.add(listener);
    return () => listeners.delete(listener);
  },
};

export function setSession(session: AuthResult | null): void {
  accessToken = session?.accessToken ?? null;
  state = session ? { status: 'authenticated', user: session.user } : { status: 'anonymous' };
  emit();
}

export function getAccessToken(): string | null {
  return accessToken;
}

async function callRefresh(): Promise<AuthResult | null> {
  try {
    const session = await apiFetch<AuthResult>('/api/auth/refresh', { method: 'POST' });
    setSession(session);
    return session;
  } catch (err) {
    // 401 = cookie ใช้ไม่ได้แล้ว → ยังไม่ได้ล็อกอิน
    // error อื่น (เน็ตหลุด, server ล่ม) → ส่งต่อ ไม่ทำให้ผู้ใช้หลุดเพราะปัญหาชั่วคราว
    if (err instanceof ApiError && err.status === 401) {
      setSession(null);
      return null;
    }
    throw err;
  }
}

/**
 * แลก refresh cookie เป็น session ใหม่ — เรียกพร้อมกันกี่ครั้งก็ยิงจริงครั้งเดียว
 * คืน null ถ้าไม่มี session (ต้องล็อกอินใหม่)
 */
export function refreshSession(): Promise<AuthResult | null> {
  inFlightRefresh ??= (async () => {
    try {
      const locks = typeof navigator === 'undefined' ? undefined : navigator.locks;
      return locks ? await locks.request(REFRESH_LOCK, callRefresh) : await callRefresh();
    } finally {
      inFlightRefresh = null;
    }
  })();
  return inFlightRefresh;
}

/** เรียกตอนเปิดเว็บ: กู้ session จาก cookie (ถ้ามี) — เรียกซ้ำได้ ไม่ยิงซ้ำ */
export async function restoreSession(): Promise<void> {
  if (state.status !== 'loading') return;
  try {
    await refreshSession();
  } catch {
    // ติดต่อ API ไม่ได้ตอนเปิดเว็บ → แสดงเป็นยังไม่ล็อกอิน (กดล็อกอินใหม่ได้)
    setSession(null);
  }
}

function withAuth(options: ApiFetchOptions, token: string | null): ApiFetchOptions {
  if (!token) return options;
  return { ...options, headers: { ...options.headers, Authorization: `Bearer ${token}` } };
}

function isAuthError(err: unknown): err is ApiError {
  return (
    err instanceof ApiError &&
    err.status === 401 &&
    (err.code === 'INVALID_TOKEN' || err.code === 'UNAUTHENTICATED')
  );
}

/**
 * เรียก API ที่ต้องล็อกอิน: แนบ access token และ refresh ให้อัตโนมัติ 1 ครั้งถ้าหมดอายุ
 * ถ้า refresh ไม่ผ่าน → สถานะเป็น anonymous และ throw error 401 เดิม
 */
export async function authFetch<T>(path: string, options: ApiFetchOptions = {}): Promise<T> {
  const tokenUsed = accessToken;
  try {
    return await apiFetch<T>(path, withAuth(options, tokenUsed));
  } catch (err) {
    if (!isAuthError(err)) throw err;

    // ระหว่างรอคำตอบ request อื่นอาจ refresh ไปแล้ว → ใช้ token ใหม่เลย ไม่ต้อง refresh ซ้ำ
    const newer = accessToken !== null && accessToken !== tokenUsed ? accessToken : null;
    const token = newer ?? (await refreshSession())?.accessToken;
    if (!token) throw err;

    return apiFetch<T>(path, withAuth(options, token));
  }
}

/** สำหรับ test เท่านั้น: ล้างสถานะระดับ module ให้แต่ละ test เริ่มใหม่ */
export function resetAuthClientForTests(): void {
  state = { status: 'loading' };
  accessToken = null;
  inFlightRefresh = null;
  listeners.clear();
}
