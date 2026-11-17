import type { ButtonHTMLAttributes } from 'react';

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary';
  /** ระหว่างส่ง: ปิดปุ่ม (กันกดซ้ำ) และแสดงข้อความแทน */
  pending?: boolean;
  pendingText?: string;
}

const VARIANTS = {
  primary: 'bg-emerald-600 text-white hover:bg-emerald-700',
  secondary: 'border border-gray-300 bg-white text-gray-700 hover:bg-gray-50',
};

export function Button({
  variant = 'primary',
  pending = false,
  pendingText,
  disabled,
  children,
  className,
  ...props
}: ButtonProps) {
  return (
    <button
      disabled={disabled || pending}
      aria-busy={pending || undefined}
      className={`rounded-lg px-4 py-2 font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-60 ${VARIANTS[variant]} ${className ?? ''}`}
      {...props}
    >
      {pending && pendingText ? pendingText : children}
    </button>
  );
}
