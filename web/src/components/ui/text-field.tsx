import { useId, type InputHTMLAttributes } from 'react';

interface TextFieldProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'id'> {
  label: string;
  error?: string;
}

/**
 * input + label + ข้อความ error ที่ screen reader อ่านได้
 * (label ผูกด้วย htmlFor, error ผูกด้วย aria-describedby, aria-invalid บอกว่าผิด)
 */
export function TextField({ label, error, className, ...props }: TextFieldProps) {
  const id = useId();
  const errorId = `${id}-error`;

  return (
    <div className="flex flex-col gap-1">
      <label htmlFor={id} className="text-sm font-medium text-gray-700">
        {label}
      </label>
      <input
        id={id}
        aria-invalid={error ? true : undefined}
        aria-describedby={error ? errorId : undefined}
        className={`rounded-lg border px-3 py-2 text-base text-gray-900 outline-none focus:ring-2 ${
          error
            ? 'border-red-400 focus:ring-red-200'
            : 'border-gray-300 focus:border-emerald-500 focus:ring-emerald-100'
        } ${className ?? ''}`}
        {...props}
      />
      {error && (
        <p id={errorId} className="text-sm text-red-600">
          {error}
        </p>
      )}
    </div>
  );
}
