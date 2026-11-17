/**
 * คำสั่ง auth ที่เปลี่ยนสถานะการล็อกอิน — ทุกตัวอัปเดต authStore ให้เอง
 */
import { apiFetch } from './api';
import { setSession } from './auth-client';
import type { AuthResult, PublicUser } from './types';

export interface RegisterInput {
  name: string;
  email: string;
  password: string;
}

export interface LoginInput {
  email: string;
  password: string;
}

export async function register(input: RegisterInput): Promise<PublicUser> {
  const session = await apiFetch<AuthResult>('/api/auth/register', {
    method: 'POST',
    body: input,
  });
  setSession(session);
  return session.user;
}

export async function login(input: LoginInput): Promise<PublicUser> {
  const session = await apiFetch<AuthResult>('/api/auth/login', { method: 'POST', body: input });
  setSession(session);
  return session.user;
}

/**
 * ออกจากระบบเฉพาะอุปกรณ์นี้
 * ล้างสถานะในเครื่องเสมอ แม้เรียก API ไม่สำเร็จ (เน็ตหลุด) — ผู้ใช้กด logout แล้วต้องออกจริง
 */
export async function logout(): Promise<void> {
  try {
    await apiFetch<void>('/api/auth/logout', { method: 'POST' });
  } catch {
    // ไม่ต้องทำอะไร: cookie ฝั่ง server จะหมดอายุเอง และ access token ใน memory ถูกล้างด้านล่าง
  } finally {
    setSession(null);
  }
}
