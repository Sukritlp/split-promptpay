/**
 * Error ที่ "ตั้งใจ" ส่งกลับไปให้ client — มี status และ code ที่ frontend ใช้ตัดสินใจได้
 * เช่น throw new HttpError(409, 'EMAIL_TAKEN', 'Email is already registered')
 *
 * error อื่นที่ไม่ใช่ HttpError ถือว่าเป็น bug → error handler จะตอบ 500 และไม่บอกรายละเอียด
 */
export class HttpError extends Error {
  constructor(
    public readonly status: number,
    public readonly code: string,
    message: string,
    public readonly details?: unknown,
  ) {
    super(message);
    this.name = 'HttpError';
  }
}

export interface ErrorResponse {
  error: {
    code: string;
    message: string;
    details?: unknown;
  };
}
