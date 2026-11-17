'use client';

import { useState, type FormEvent } from 'react';
import { Alert } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { TextField } from '@/components/ui/text-field';
import { ApiError } from '@/lib/api';
import { registerSchema, validate, type FieldErrors } from '@/lib/validation';
import { useAuth } from './auth-provider';
import { formErrorMessage, invalidFieldsFrom } from './form-errors';

type Values = { name: string; email: string; password: string };

/** สมัครสมาชิก — สำเร็จแล้ว <GuestOnly> จะพาไปหน้าถัดไปเอง (ฟอร์มไม่ต้อง navigate) */
export function RegisterForm() {
  const { register } = useAuth();
  const [values, setValues] = useState<Values>({ name: '', email: '', password: '' });
  const [errors, setErrors] = useState<FieldErrors<Values>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  const field = (name: keyof Values) => ({
    name,
    value: values[name],
    error: errors[name],
    onChange: (e: React.ChangeEvent<HTMLInputElement>) => {
      setValues((v) => ({ ...v, [name]: e.target.value }));
      setErrors((errs) => ({ ...errs, [name]: undefined })); // แก้ช่องไหน ลบ error ช่องนั้น
    },
  });

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (pending) return;
    setFormError(null);

    const result = validate(registerSchema, values);
    if (result.errors) {
      setErrors(result.errors);
      return;
    }

    setPending(true);
    try {
      await register(result.data);
    } catch (err) {
      if (err instanceof ApiError && err.code === 'EMAIL_TAKEN') {
        setErrors({ email: 'อีเมลนี้ถูกใช้สมัครแล้ว' });
      } else {
        const fields = invalidFieldsFrom(err);
        if (fields.length > 0) {
          setErrors(Object.fromEntries(fields.map((f) => [f, 'ข้อมูลไม่ถูกต้อง'])));
        }
        setFormError(formErrorMessage(err));
      }
      setPending(false);
    }
  }

  return (
    <form onSubmit={onSubmit} noValidate className="flex flex-col gap-4">
      {formError && <Alert>{formError}</Alert>}
      <TextField label="ชื่อ" autoComplete="name" {...field('name')} />
      <TextField
        label="อีเมล"
        type="email"
        autoComplete="email"
        inputMode="email"
        {...field('email')}
      />
      <TextField
        label="รหัสผ่าน (อย่างน้อย 8 ตัวอักษร)"
        type="password"
        autoComplete="new-password"
        {...field('password')}
      />
      <Button type="submit" pending={pending} pendingText="กำลังสมัคร…">
        สมัครสมาชิก
      </Button>
    </form>
  );
}
