'use client';

import { useEffect, useState } from 'react';
import { useAuth } from '@/components/auth/auth-provider';
import { Button } from '@/components/ui/button';
import { authFetch } from '@/lib/auth-client';
import type { PublicUser } from '@/lib/types';

type Profile = { status: 'loading' } | { status: 'ok'; user: PublicUser } | { status: 'error' };

/** หน้าแรกหลังล็อกอิน — ตอนนี้ยังไม่มีฟีเจอร์กลุ่ม แสดงข้อมูลบัญชีจาก /api/me (API ที่ต้องใช้ token) */
export function GroupsHome() {
  const { state, logout } = useAuth();
  const [profile, setProfile] = useState<Profile>({ status: 'loading' });
  const [loggingOut, setLoggingOut] = useState(false);

  useEffect(() => {
    let cancelled = false;
    authFetch<{ user: PublicUser }>('/api/me').then(
      ({ user }) => !cancelled && setProfile({ status: 'ok', user }),
      () => !cancelled && setProfile({ status: 'error' }),
    );
    return () => {
      cancelled = true;
    };
  }, []);

  const name = state.status === 'authenticated' ? state.user.name : '';

  return (
    <main className="mx-auto flex min-h-dvh max-w-md flex-col gap-6 px-4 py-10">
      <header className="flex items-center justify-between gap-4">
        <h1 className="text-2xl font-bold text-gray-900">สวัสดี {name}</h1>
        <Button
          variant="secondary"
          pending={loggingOut}
          pendingText="กำลังออก…"
          onClick={() => {
            setLoggingOut(true);
            // ไม่ต้อง navigate เอง: สถานะเป็น anonymous แล้ว <RequireAuth> จะพาไป /login
            void logout();
          }}
        >
          ออกจากระบบ
        </Button>
      </header>

      <section className="rounded-2xl border border-dashed border-gray-300 bg-white p-6 text-center">
        <p className="font-medium text-gray-900">ยังไม่มีกลุ่ม</p>
        <p className="mt-1 text-sm text-gray-500">ฟีเจอร์สร้างกลุ่มกำลังจะมา</p>
      </section>

      <section className="rounded-2xl border border-gray-200 bg-white p-5 text-sm">
        <h2 className="mb-2 font-medium text-gray-500">บัญชี</h2>
        {profile.status === 'loading' && <p className="text-gray-500">กำลังโหลด…</p>}
        {profile.status === 'error' && <p className="text-red-600">โหลดข้อมูลบัญชีไม่สำเร็จ</p>}
        {profile.status === 'ok' && (
          <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1">
            <dt className="text-gray-500">อีเมล</dt>
            <dd className="text-gray-900">{profile.user.email}</dd>
            <dt className="text-gray-500">PromptPay</dt>
            <dd className="text-gray-900">{profile.user.promptpayId ?? 'ยังไม่ได้ตั้งค่า'}</dd>
          </dl>
        )}
      </section>
    </main>
  );
}
