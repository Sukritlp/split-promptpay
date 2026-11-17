import { ApiStatus } from '@/components/api-status';
import { HomeActions } from '@/components/home-actions';

export default function Home() {
  return (
    <main className="mx-auto flex min-h-dvh max-w-md flex-col justify-center gap-8 px-4 py-12">
      <header>
        <h1 className="text-3xl font-bold text-gray-900">split-promptpay</h1>
        <p className="mt-2 text-gray-600">
          หารบิลกับเพื่อน คำนวณว่าใครต้องโอนให้ใครน้อยที่สุด แล้วสแกน QR PromptPay จ่ายได้ทันที
        </p>
      </header>
      <HomeActions />
      <ApiStatus />
    </main>
  );
}
