'use client';

import Link from 'next/link';
import { useAuth } from '@/components/auth/auth-provider';

const primary =
  'rounded-lg bg-emerald-600 px-4 py-2 text-center font-medium text-white hover:bg-emerald-700';
const secondary =
  'rounded-lg border border-gray-300 bg-white px-4 py-2 text-center font-medium text-gray-700 hover:bg-gray-50';

/** ปุ่มบนหน้าแรกตามสถานะการล็อกอิน (ระหว่างโหลดจองที่ไว้ ไม่ให้ layout กระโดด) */
export function HomeActions() {
  const { state } = useAuth();

  if (state.status === 'loading') return <div className="h-10" aria-hidden="true" />;

  if (state.status === 'authenticated') {
    return (
      <Link href="/groups" className={primary}>
        ไปที่กลุ่มของฉัน
      </Link>
    );
  }

  return (
    <div className="grid grid-cols-2 gap-3">
      <Link href="/register" className={primary}>
        สมัครสมาชิก
      </Link>
      <Link href="/login" className={secondary}>
        เข้าสู่ระบบ
      </Link>
    </div>
  );
}
