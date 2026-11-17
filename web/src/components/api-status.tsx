'use client';

import { useCallback, useEffect, useState } from 'react';
import { ApiError, apiFetch } from '@/lib/api';

/** ต้องตรงกับ ReadyResponse ฝั่ง api/src/routes/health.ts */
interface ReadyResponse {
  status: 'ok' | 'unavailable';
  checks: { database: 'up' | 'down' };
}

type Status = 'loading' | 'ok' | 'db-down' | 'unreachable';

const VIEW: Record<Status, { label: string; dot: string; detail: string }> = {
  loading: { label: 'กำลังตรวจสอบ…', dot: 'bg-gray-400 animate-pulse', detail: 'เรียก /api/ready' },
  ok: { label: 'API พร้อมใช้งาน', dot: 'bg-emerald-500', detail: 'Web → API → Database ต่อกันได้' },
  'db-down': {
    label: 'ฐานข้อมูลไม่พร้อม',
    dot: 'bg-amber-500',
    detail: 'API ทำงานอยู่ แต่ต่อ PostgreSQL ไม่ได้',
  },
  unreachable: {
    label: 'ติดต่อ API ไม่ได้',
    dot: 'bg-red-500',
    detail: 'ตรวจว่ารัน api (port 4000) อยู่หรือไม่',
  },
};

async function checkReady(signal?: AbortSignal): Promise<Status> {
  try {
    await apiFetch<ReadyResponse>('/api/ready', { signal });
    return 'ok';
  } catch (err) {
    // 503 = API ตอบได้ แต่ DB ล่ม; อย่างอื่น (network, 5xx จาก proxy) = ติดต่อ API ไม่ได้
    if (err instanceof ApiError && err.status === 503) return 'db-down';
    throw err;
  }
}

export function ApiStatus() {
  const [status, setStatus] = useState<Status>('loading');
  // เพิ่มค่าทุกครั้งที่กด "ตรวจสอบอีกครั้ง" → effect รันใหม่
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    // cleanup ยกเลิก request เดิม: ทั้งตอน unmount และตอนกดตรวจซ้ำ
    // → คำตอบเก่าที่มาช้าจะไม่ทับคำตอบใหม่ และไม่มี setState หลัง unmount
    const controller = new AbortController();
    checkReady(controller.signal).then(
      (next) => {
        if (!controller.signal.aborted) setStatus(next);
      },
      () => {
        if (!controller.signal.aborted) setStatus('unreachable');
      },
    );
    return () => controller.abort();
  }, [attempt]);

  const retry = useCallback(() => {
    setStatus('loading');
    setAttempt((n) => n + 1);
  }, []);

  const view = VIEW[status];

  return (
    <section className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
      <h2 className="text-sm font-medium text-gray-500">สถานะระบบ</h2>
      <div className="mt-3 flex items-center gap-3" role="status" aria-live="polite">
        <span className={`h-3 w-3 shrink-0 rounded-full ${view.dot}`} aria-hidden="true" />
        <div>
          <p className="font-semibold text-gray-900">{view.label}</p>
          <p className="text-sm text-gray-500">{view.detail}</p>
        </div>
      </div>
      <button
        type="button"
        onClick={retry}
        disabled={status === 'loading'}
        className="mt-4 rounded-lg border border-gray-300 px-3 py-1.5 text-sm text-gray-700 hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50"
      >
        ตรวจสอบอีกครั้ง
      </button>
    </section>
  );
}
