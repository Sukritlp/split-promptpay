/**
 * Type ที่ต้องตรงกับ API (api/src/modules/users/public-user.ts, auth.service.ts)
 * ตอนนี้เขียนซ้ำไว้ฝั่ง web — ถ้าใช้ร่วมกันเยอะขึ้นค่อยแยกเป็น package กลาง
 */
export interface PublicUser {
  id: string;
  name: string;
  email: string;
  promptpayId: string | null;
  createdAt: string;
}

export interface AuthResult {
  user: PublicUser;
  accessToken: string;
}
