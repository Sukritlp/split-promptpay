# split-promptpay

เว็บแอปหารบิลในกลุ่มเพื่อน คำนวณการโอนให้น้อยที่สุด และสร้าง QR PromptPay ให้สแกนจ่ายได้ทันที

> รายละเอียดเป้าหมายและฟีเจอร์ทั้งหมดอยู่ที่ [docs/spec.md](docs/spec.md)

## โครงสร้าง

```
.
├── api/                 # Backend: Node.js + TypeScript + Express
├── docs/                # spec และเอกสารออกแบบ
└── docker-compose.yml   # PostgreSQL สำหรับ dev
```

## สิ่งที่ต้องมี

- Node.js 20+
- npm
- Docker Desktop (สำหรับ PostgreSQL)

## เริ่มต้นบนเครื่องตัวเอง

```bash
# 1) เปิด PostgreSQL
cp .env.example .env
docker compose up -d
docker compose ps          # รอจนสถานะเป็น healthy

# 2) รัน API
cd api
cp .env.example .env       # แล้วตั้ง JWT_ACCESS_SECRET ใหม่ (ดูวิธีสร้างในไฟล์)
npm install                # postinstall จะรัน prisma generate ให้อัตโนมัติ
npm run db:migrate         # สร้างตารางตาม migration ใน prisma/migrations
npm run dev                # http://localhost:3000/health
```

## คำสั่งใน `api/`

| คำสั่ง                 | ทำอะไร                                    |
| ---------------------- | ----------------------------------------- |
| `npm run dev`          | รันแบบ watch ด้วย tsx (แก้โค้ดแล้วรีโหลดเอง) |
| `npm run build`        | compile TypeScript ไปที่ `dist/`            |
| `npm start`            | รันจาก `dist/` (แบบ production)            |
| `npm test`             | รัน test ทั้งหมด (unit + integration)        |
| `npm run test:unit`    | รันเฉพาะ unit test (ไม่ต้องมี DB)            |
| `npm run test:integration` | รันเฉพาะ integration test กับ PostgreSQL จริง |
| `npm run typecheck`    | เช็ค type โดยไม่ build                     |
| `npm run lint`         | ESLint                                    |
| `npm run format`       | จัดรูปแบบโค้ดด้วย Prettier                 |
| `npm run format:check` | เช็คว่าโค้ดถูกจัดรูปแบบแล้ว (ใช้ใน CI)      |
| `npm run db:migrate`   | สร้าง/รัน migration บนเครื่อง dev แล้ว generate client ใหม่ |
| `npm run db:deploy`    | รัน migration ที่มีอยู่บน production (`prisma migrate deploy`) |
| `npm run db:generate`  | generate Prisma Client ใหม่หลังแก้ schema   |
| `npm run db:studio`    | เปิด Prisma Studio ดู/แก้ข้อมูลผ่านเว็บ      |

## API

| Method | Path             | Auth | คำอธิบาย |
| ------ | ---------------- | ---- | -------- |
| GET    | `/health`        | –    | liveness: process ยังทำงานอยู่ (ไม่เช็ค DB) |
| GET    | `/ready`         | –    | readiness: 200 ถ้าต่อ DB ได้, 503 ถ้า DB ล่ม |
| POST   | `/auth/register` | –    | สมัคร `{ name, email, password }` → `201 { user, accessToken }` + cookie |
| POST   | `/auth/login`    | –    | ล็อกอิน `{ email, password }` → `200 { user, accessToken }` + cookie |
| POST   | `/auth/refresh`  | 🍪   | แลก refresh token → `200 { user, accessToken }` + cookie ใหม่ |
| POST   | `/auth/logout`   | 🍪   | ออกจากระบบเฉพาะอุปกรณ์นี้ → `204` (เรียกซ้ำได้) |
| GET    | `/me`            | ✓    | ข้อมูลผู้ใช้ที่ล็อกอินอยู่ → `200 { user }` |

- ✓ = ต้องส่ง header `Authorization: Bearer <accessToken>` (อายุ 15 นาทีตามค่าเริ่มต้น)
- 🍪 = ใช้ cookie `refresh_token` ที่ browser แนบมาให้เอง (ต้องเรียกด้วย `credentials: 'include'`)

### Access token + Refresh token

```
login/register ─► body: { user, accessToken }      access token (JWT, 15 นาที) → web เก็บใน memory
                  Set-Cookie: refresh_token=...    refresh token (สุ่ม 256 bit, 30 วัน) → httpOnly cookie

access token หมดอายุ ─► POST /auth/refresh ─► token เก่าถูกยกเลิก + ได้ตัวใหม่ (rotation)
POST /auth/logout ─► ยกเลิก refresh token ของอุปกรณ์นี้ + ลบ cookie
```

| ประเด็น | การออกแบบ | เหตุผล |
| --- | --- | --- |
| รูปแบบ refresh token | สตริงสุ่ม ไม่ใช่ JWT | ต้องค้น DB ทุกครั้ง จึงยกเลิกได้จริง |
| เก็บใน DB | SHA-256 ของ token | DB หลุดก็เอาไปใช้แทน token ไม่ได้ (token สุ่ม 256 bit จึงไม่ต้องใช้ hash แบบช้า) |
| Cookie | `HttpOnly` `Path=/auth` `SameSite=Lax` (+`Secure` บน production) | JS อ่านไม่ได้ (กัน XSS), ส่งเฉพาะ `/auth/*`, กัน CSRF |
| Rotation | token ใช้ได้ครั้งเดียว | token ที่หลุดไปมีอายุใช้งานสั้น |
| Reuse detection | ใช้ token เก่าซ้ำ → ยกเลิกทั้ง family | แปลว่า token อาจถูกขโมย: บังคับทั้งคนร้ายและเจ้าของให้ล็อกอินใหม่ |
| Refresh พร้อมกัน | ตัวที่สองถูกนับเป็นการใช้ซ้ำ (เข้มงวด) | ฝั่ง web ต้องรวม refresh ให้เหลือครั้งเดียว (single-flight) |
| หลัง logout | access token เดิมยังใช้ได้จนหมดอายุ (≤ 15 นาที) | JWT ตรวจได้โดยไม่ต้องค้น DB แลกกับช่วงเวลาสั้นๆ นี้ |

### รูปแบบ error

ทุก error ตอบเป็น JSON รูปแบบเดียวกัน:

```json
{ "error": { "code": "EMAIL_TAKEN", "message": "Email is already registered" } }
```

| Status | code | เมื่อไหร่ |
| ------ | ---- | -------- |
| 400 | `VALIDATION_ERROR` | body ไม่ผ่านการตรวจ (มี `details` บอกช่องที่ผิด) |
| 400 | `BAD_REQUEST` | JSON พัง |
| 401 | `INVALID_CREDENTIALS` | email หรือรหัสผ่านผิด (ไม่บอกว่าผิดอันไหน) |
| 401 | `UNAUTHENTICATED` | ไม่ได้ส่ง token |
| 401 | `INVALID_TOKEN` | access token ผิด/หมดอายุ → เรียก `/auth/refresh` |
| 401 | `INVALID_REFRESH_TOKEN` | refresh token ใช้ไม่ได้ → ต้องล็อกอินใหม่ |
| 404 | `NOT_FOUND` | ไม่มี route นี้ |
| 409 | `EMAIL_TAKEN` | email นี้สมัครแล้ว |
| 500 | `INTERNAL_ERROR` | bug ฝั่ง server (รายละเอียดอยู่ใน log เท่านั้น) |

## Test

- **unit** (`tests/unit/`): ไม่แตะ DB ใช้ dependency ปลอม
- **integration** (`tests/integration/`): ยิง HTTP จริงผ่าน Supertest เข้า PostgreSQL จริง
  - ใช้ DB `splitpay_test` ใน docker-compose (สร้างและ migrate ให้อัตโนมัติ) หรือกำหนดเองด้วย `TEST_DATABASE_URL`
  - ล้างข้อมูลทุกตารางก่อนแต่ละ test และ **ไม่ยอมรัน** ถ้าชื่อ DB ไม่ลงท้ายด้วย `_test` กันลบข้อมูลจริงโดยไม่ตั้งใจ

## ฐานข้อมูล

- Schema อยู่ที่ [api/prisma/schema.prisma](api/prisma/schema.prisma) และ migration อยู่ที่ [api/prisma/migrations/](api/prisma/migrations/)
- แก้ schema แล้วรัน `npm run db:migrate -- --name <ชื่อการเปลี่ยนแปลง>` เพื่อสร้าง migration ใหม่ แล้ว commit โฟลเดอร์ migration ทุกครั้ง
- ช่องที่เป็นจำนวนเงินทุกช่องเก็บเป็น **สตางค์ (จำนวนเต็ม)** ห้ามใช้ทศนิยม
