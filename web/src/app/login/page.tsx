import type { Metadata } from 'next';
import Link from 'next/link';
import { AuthCard } from '@/components/auth/auth-card';
import { GuestOnly } from '@/components/auth/guest-only';
import { LoginForm } from '@/components/auth/login-form';
import { readNextParam } from '@/lib/next-param';

export const metadata: Metadata = { title: 'เข้าสู่ระบบ · split-promptpay' };

/**
 * อ่าน ?next= ที่ server component แล้วส่งค่าที่ตรวจแล้วลงไป
 * (ถ้าใช้ useSearchParams ใน client component ต้องห่อ <Suspense> ไม่งั้น build ไม่ผ่าน)
 */
export default async function LoginPage({ searchParams }: PageProps<'/login'>) {
  const { redirectTo, query } = readNextParam(await searchParams);

  return (
    <AuthCard
      title="เข้าสู่ระบบ"
      footer={
        <>
          ยังไม่มีบัญชี?{' '}
          <Link href={`/register${query}`} className="font-medium text-emerald-700 hover:underline">
            สมัครสมาชิก
          </Link>
        </>
      }
    >
      <GuestOnly redirectTo={redirectTo}>
        <LoginForm />
      </GuestOnly>
    </AuthCard>
  );
}
