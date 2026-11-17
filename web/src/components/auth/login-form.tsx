'use client';

import { useState, type FormEvent } from 'react';
import { Alert } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { TextField } from '@/components/ui/text-field';
import { loginSchema, validate, type FieldErrors } from '@/lib/validation';
import { useAuth } from './auth-provider';
import { formErrorMessage } from './form-errors';

type Values = { email: string; password: string };

/** ล็อกอิน — สำเร็จแล้ว <GuestOnly> จะพาไปหน้าถัดไป (?next= ที่ตรวจแล้ว) เอง */
export function LoginForm() {
  const { login } = useAuth();
  const [values, setValues] = useState<Values>({ email: '', password: '' });
  const [errors, setErrors] = useState<FieldErrors<Values>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  const field = (name: keyof Values) => ({
    name,
    value: values[name],
    error: errors[name],
    onChange: (e: React.ChangeEvent<HTMLInputElement>) => {
      setValues((v) => ({ ...v, [name]: e.target.value }));
      setErrors((errs) => ({ ...errs, [name]: undefined }));
    },
  });

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (pending) return;
    setFormError(null);

    const result = validate(loginSchema, values);
    if (result.errors) {
      setErrors(result.errors);
      return;
    }

    setPending(true);
    try {
      await login(result.data);
    } catch (err) {
      // ไม่บอกว่าผิดที่อีเมลหรือรหัสผ่าน (API ก็ไม่บอก) — ล้างรหัสผ่านให้พิมพ์ใหม่
      setFormError(formErrorMessage(err));
      setValues((v) => ({ ...v, password: '' }));
      setPending(false);
    }
  }

  return (
    <form onSubmit={onSubmit} noValidate className="flex flex-col gap-4">
      {formError && <Alert>{formError}</Alert>}
      <TextField
        label="อีเมล"
        type="email"
        autoComplete="email"
        inputMode="email"
        {...field('email')}
      />
      <TextField
        label="รหัสผ่าน"
        type="password"
        autoComplete="current-password"
        {...field('password')}
      />
      <Button type="submit" pending={pending} pendingText="กำลังเข้าสู่ระบบ…">
        เข้าสู่ระบบ
      </Button>
    </form>
  );
}
