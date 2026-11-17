'use client';

import { createContext, use, useEffect, useMemo, useSyncExternalStore } from 'react';
import { login, logout, register } from '@/lib/auth-api';
import { authStore, restoreSession, type AuthState } from '@/lib/auth-client';

interface AuthContextValue {
  state: AuthState;
  login: typeof login;
  register: typeof register;
  logout: typeof logout;
}

const AuthContext = createContext<AuthContextValue | null>(null);

// ตอน render ฝั่ง server ยังไม่รู้ว่าใครล็อกอิน (token อยู่ใน memory ของ browser) → loading เสมอ
// ต้องเป็น object ตัวเดิมทุกครั้ง ไม่งั้น useSyncExternalStore จะ render วน
const SERVER_STATE: AuthState = { status: 'loading' };
const getServerState = () => SERVER_STATE;

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const state = useSyncExternalStore(authStore.subscribe, authStore.getState, getServerState);

  useEffect(() => {
    // กู้ session จาก refresh cookie ตอนเปิดเว็บ
    // StrictMode รัน effect นี้ 2 รอบตอน dev — restoreSession เป็น single-flight จึงยิงครั้งเดียว
    void restoreSession();
  }, []);

  const value = useMemo(() => ({ state, login, register, logout }), [state]);

  return <AuthContext value={value}>{children}</AuthContext>;
}

export function useAuth(): AuthContextValue {
  const ctx = use(AuthContext);
  if (!ctx) throw new Error('useAuth() must be used inside <AuthProvider>');
  return ctx;
}
