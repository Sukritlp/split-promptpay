import Link from 'next/link';

/** กรอบหน้า login/register ที่ใช้ร่วมกัน */
export function AuthCard({
  title,
  children,
  footer,
}: {
  title: string;
  children: React.ReactNode;
  footer: React.ReactNode;
}) {
  return (
    <main className="mx-auto flex min-h-dvh max-w-sm flex-col justify-center gap-6 px-4 py-12">
      <Link href="/" className="text-sm font-semibold text-emerald-700">
        split-promptpay
      </Link>
      <section className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
        <h1 className="mb-5 text-xl font-bold text-gray-900">{title}</h1>
        {children}
      </section>
      <p className="text-center text-sm text-gray-600">{footer}</p>
    </main>
  );
}
