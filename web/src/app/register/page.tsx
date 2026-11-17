import type { Metadata } from 'next';
import Link from 'next/link';
import { AuthCard } from '@/components/auth/auth-card';
import { GuestOnly } from '@/components/auth/guest-only';
import { RegisterForm } from '@/components/auth/register-form';

export const metadata: Metadata = { title: 'สมัครสมาชิก · split-promptpay' };

export default function RegisterPage() {
  return (
    <AuthCard
      title="สมัครสมาชิก"
      footer={
        <>
          มีบัญชีแล้ว?{' '}
          <Link href="/login" className="font-medium text-emerald-700 hover:underline">
            เข้าสู่ระบบ
          </Link>
        </>
      }
    >
      <GuestOnly>
        <RegisterForm />
      </GuestOnly>
    </AuthCard>
  );
}
