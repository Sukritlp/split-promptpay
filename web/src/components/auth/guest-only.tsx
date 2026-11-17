'use client';

import { useRouter } from 'next/navigation';
import { useEffect } from 'react';
import { PageLoading } from '@/components/ui/page-loading';
import { useAuth } from './auth-provider';

/**
 * ครอบหน้าที่สำหรับคนยังไม่ล็อกอิน (login/register)
 * - ล็อกอินอยู่แล้ว (หรือเพิ่งล็อกอินสำเร็จ) → พาไป redirectTo
 * - ระหว่างเช็คสถานะ → loading (ไม่ให้ฟอร์มกระพริบให้คนที่ล็อกอินแล้วเห็น)
 */
export function GuestOnly({
  children,
  redirectTo = '/groups',
}: {
  children: React.ReactNode;
  redirectTo?: string;
}) {
  const { state } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (state.status === 'authenticated') router.replace(redirectTo);
  }, [state.status, redirectTo, router]);

  if (state.status !== 'anonymous') return <PageLoading />;
  return children;
}
