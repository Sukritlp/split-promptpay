/**
 * ตัวเรียก API ตัวเดียวทั้งแอป
 * - เรียก path แบบ /api/... (Next.js proxy ไปที่ Express ให้ → origin เดียวกัน)
 * - แปลง error รูปแบบ { error: { code, message } } ของ API เป็น ApiError
 * PR ถัดไปจะเพิ่ม access token และการ refresh แบบ single-flight ที่นี่
 */

export class ApiError extends Error {
  constructor(
    /** HTTP status — 0 = ติดต่อ server ไม่ได้เลย (network error) */
    public readonly status: number,
    public readonly code: string,
    message: string,
    public readonly details?: unknown,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

interface ErrorBody {
  error: { code: string; message: string; details?: unknown };
}

function isErrorBody(value: unknown): value is ErrorBody {
  if (typeof value !== 'object' || value === null || !('error' in value)) return false;
  const error = (value as { error: unknown }).error;
  return (
    typeof error === 'object' &&
    error !== null &&
    typeof (error as { code?: unknown }).code === 'string' &&
    typeof (error as { message?: unknown }).message === 'string'
  );
}

export interface ApiFetchOptions extends Omit<RequestInit, 'body'> {
  /** object จะถูกแปลงเป็น JSON ให้ */
  body?: unknown;
}

export async function apiFetch<T>(path: string, options: ApiFetchOptions = {}): Promise<T> {
  const { body, headers, ...init } = options;

  let res: Response;
  try {
    res = await fetch(path, {
      ...init,
      credentials: 'same-origin',
      headers: {
        Accept: 'application/json',
        ...(body !== undefined && { 'Content-Type': 'application/json' }),
        ...headers,
      },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
  } catch (cause) {
    // ถูกยกเลิกเอง (AbortController) → ส่งต่อตามเดิม ให้ผู้เรียกแยกออกได้
    if (cause instanceof DOMException && cause.name === 'AbortError') throw cause;
    throw new ApiError(0, 'NETWORK_ERROR', 'Cannot reach the server');
  }

  if (res.status === 204) return undefined as T;

  // body อาจไม่ใช่ JSON (เช่น proxy ต่อ API ไม่ได้แล้วตอบ HTML) → ไม่ให้ crash
  const data: unknown = await res.json().catch(() => null);

  if (!res.ok) {
    if (isErrorBody(data)) {
      throw new ApiError(res.status, data.error.code, data.error.message, data.error.details);
    }
    throw new ApiError(res.status, 'HTTP_ERROR', `Request failed with status ${res.status}`);
  }

  return data as T;
}
