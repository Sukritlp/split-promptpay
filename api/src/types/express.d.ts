// เพิ่ม field `auth` ให้ Request ของ Express — requireAuth จะใส่ค่าให้หลังตรวจ token ผ่าน
export {};

declare global {
  namespace Express {
    interface Request {
      auth?: { userId: string };
    }
  }
}
