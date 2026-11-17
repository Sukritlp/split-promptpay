import type { Metadata } from 'next';
import Link from 'next/link';
import { AuthCard } from '@/components/auth/auth-card';
import { GuestOnly } from '@/components/auth/guest-only';
import { RegisterForm } from '@/components/auth/register-form';
import { readNextParam } from '@/lib/next-param';

export const metadata: Metadata = { title: 'สมัครสมาชิก · split-promptpay' };

export default async function RegisterPage({ searchParams }: PageProps<'/register'>) {
  const { redirectTo, query } = readNextParam(await searchParams);

  return (
    <AuthCard
      title="สมัครสมาชิก"
      footer={
        <>
          มีบัญชีแล้ว?{' '}
          <Link href={`/login${query}`} className="font-medium text-emerald-700 hover:underline">
            เข้าสู่ระบบ
          </Link>
        </>
      }
    >
      <GuestOnly redirectTo={redirectTo}>
        <RegisterForm />
      </GuestOnly>
    </AuthCard>
  );
}
