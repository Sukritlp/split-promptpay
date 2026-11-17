/**
 * ตรวจและแปลงค่า environment — เป็น pure function (ไม่อ่าน process.env เอง)
 * จึงส่ง object อะไรเข้ามา test ก็ได้
 */

const NODE_ENVS = ['development', 'test', 'production'] as const;
type NodeEnv = (typeof NODE_ENVS)[number];

export interface Env {
  NODE_ENV: NodeEnv;
  PORT: number;
  DATABASE_URL: string;
  JWT_ACCESS_SECRET: string;
  ACCESS_TOKEN_TTL: string;
  REFRESH_TOKEN_TTL_DAYS: number;
  COOKIE_SAMESITE: CookieSameSite;
}

const COOKIE_SAMESITES = ['lax', 'strict', 'none'] as const;
export type CookieSameSite = (typeof COOKIE_SAMESITES)[number];

type RawEnv = Record<string, string | undefined>;

const MIN_SECRET_LENGTH = 32;

function parseNodeEnv(value: string | undefined): NodeEnv {
  const v = value ?? 'development';
  if (!(NODE_ENVS as readonly string[]).includes(v)) {
    throw new Error(`Invalid NODE_ENV "${v}". Expected one of: ${NODE_ENVS.join(', ')}`);
  }
  return v as NodeEnv;
}

function parsePort(value: string | undefined): number {
  const port = Number(value ?? 4000); // 3000 เป็นของ Next.js (web)
  if (!Number.isInteger(port) || port < 1 || port > 65535) {
    throw new Error(`Invalid PORT "${value}". Expected an integer between 1 and 65535`);
  }
  return port;
}

function parseDatabaseUrl(value: string | undefined): string {
  if (!value) {
    throw new Error('DATABASE_URL is required');
  }
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    // ไม่ใส่ค่าจริงใน error message เพราะอาจมีรหัสผ่าน DB หลุดไปใน log
    throw new Error('DATABASE_URL is not a valid URL');
  }
  if (url.protocol !== 'postgresql:' && url.protocol !== 'postgres:') {
    throw new Error('DATABASE_URL must start with postgresql:// or postgres://');
  }
  return value;
}

function parseSecret(name: string, value: string | undefined): string {
  if (!value) {
    throw new Error(`${name} is required`);
  }
  // HS256 ควรใช้ key อย่างน้อย 256 bit (32 bytes) — secret สั้นถูก brute force ได้
  if (value.length < MIN_SECRET_LENGTH) {
    throw new Error(`${name} must be at least ${MIN_SECRET_LENGTH} characters`);
  }
  return value;
}

function parseDuration(name: string, value: string | undefined, fallback: string): string {
  const v = value ?? fallback;
  if (!/^[1-9]\d*[smhd]$/.test(v)) {
    throw new Error(`Invalid ${name} "${v}". Expected a duration like 30s, 15m, 1h or 7d`);
  }
  return v;
}

function parseIntInRange(
  name: string,
  value: string | undefined,
  fallback: number,
  min: number,
  max: number,
): number {
  const n = Number(value ?? fallback);
  if (!Number.isInteger(n) || n < min || n > max) {
    throw new Error(`Invalid ${name} "${value}". Expected an integer between ${min} and ${max}`);
  }
  return n;
}

function parseSameSite(value: string | undefined): CookieSameSite {
  const v = (value ?? 'lax').toLowerCase();
  if (!(COOKIE_SAMESITES as readonly string[]).includes(v)) {
    throw new Error(
      `Invalid COOKIE_SAMESITE "${value}". Expected one of: ${COOKIE_SAMESITES.join(', ')}`,
    );
  }
  return v as CookieSameSite;
}

export function parseEnv(source: RawEnv): Env {
  return {
    NODE_ENV: parseNodeEnv(source.NODE_ENV),
    PORT: parsePort(source.PORT),
    DATABASE_URL: parseDatabaseUrl(source.DATABASE_URL),
    JWT_ACCESS_SECRET: parseSecret('JWT_ACCESS_SECRET', source.JWT_ACCESS_SECRET),
    ACCESS_TOKEN_TTL: parseDuration('ACCESS_TOKEN_TTL', source.ACCESS_TOKEN_TTL, '15m'),
    REFRESH_TOKEN_TTL_DAYS: parseIntInRange(
      'REFRESH_TOKEN_TTL_DAYS',
      source.REFRESH_TOKEN_TTL_DAYS,
      30,
      1,
      365,
    ),
    COOKIE_SAMESITE: parseSameSite(source.COOKIE_SAMESITE),
  };
}
