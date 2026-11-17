'use client';

import { usePathname, useRouter } from 'next/navigation';
import { useEffect } from 'react';
import { PageLoading } from '@/components/ui/page-loading';
import { useAuth } from './auth-provider';

/**
 * ครอบหน้าที่ต้องล็อกอิน: ยังไม่ล็อกอิน → /login?next=<หน้านี้>
 *
 * หมายเหตุ: นี่เป็นแค่ UX ไม่ใช่ความปลอดภัย — ข้อมูลจริงอยู่หลัง API ที่ตรวจ token ทุก request
 * (ตรวจฝั่ง server ด้วย proxy.ts ไม่ได้ เพราะ refresh cookie มี Path=/api/auth
 *  browser จึงไม่ส่ง cookie มากับ request ของหน้าเว็บ)
 */
export function RequireAuth({ children }: { children: React.ReactNode }) {
  const { state } = useAuth();
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    if (state.status === 'anonymous') {
      router.replace(`/login?next=${encodeURIComponent(pathname)}`);
    }
  }, [state.status, pathname, router]);

  if (state.status !== 'authenticated') return <PageLoading />;
  return children;
}
