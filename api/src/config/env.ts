/**
 * อ่านและตรวจค่า environment ที่จุดเดียว
 * - ถ้าค่าผิด ให้แอปพังตั้งแต่ตอน start (fail fast) ไม่ใช่พังกลางทางตอนมี request
 * - โค้ดส่วนอื่น import `env` จากไฟล์นี้ แทนการเรียก process.env ตรงๆ
 */

const NODE_ENVS = ['development', 'test', 'production'] as const;
type NodeEnv = (typeof NODE_ENVS)[number];

function parseNodeEnv(value: string | undefined): NodeEnv {
  const v = value ?? 'development';
  if (!(NODE_ENVS as readonly string[]).includes(v)) {
    throw new Error(`Invalid NODE_ENV "${v}". Expected one of: ${NODE_ENVS.join(', ')}`);
  }
  return v as NodeEnv;
}

function parsePort(value: string | undefined): number {
  const port = Number(value ?? 3000);
  if (!Number.isInteger(port) || port < 1 || port > 65535) {
    throw new Error(`Invalid PORT "${value}". Expected an integer between 1 and 65535`);
  }
  return port;
}

export const env = {
  NODE_ENV: parseNodeEnv(process.env.NODE_ENV),
  PORT: parsePort(process.env.PORT),
} as const;
