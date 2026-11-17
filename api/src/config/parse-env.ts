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
}

type RawEnv = Record<string, string | undefined>;

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

export function parseEnv(source: RawEnv): Env {
  return {
    NODE_ENV: parseNodeEnv(source.NODE_ENV),
    PORT: parsePort(source.PORT),
    DATABASE_URL: parseDatabaseUrl(source.DATABASE_URL),
  };
}
