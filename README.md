# split-promptpay

[![CI](https://github.com/Sukritlp/split-promptpay/actions/workflows/ci.yml/badge.svg)](https://github.com/Sukritlp/split-promptpay/actions/workflows/ci.yml)

เว็บแอปหารบิลในกลุ่มเพื่อน คำนวณการโอนให้น้อยที่สุด และสร้าง QR PromptPay ให้สแกนจ่ายได้ทันที

> รายละเอียดเป้าหมายและฟีเจอร์ทั้งหมดอยู่ที่ [docs/spec.md](docs/spec.md)

## โครงสร้าง

```
.
├── api/                 # Backend: Node.js + TypeScript + Express (port 4000)
├── web/                 # Frontend: Next.js + TypeScript + Tailwind (port 3000)
├── docs/                # spec และเอกสารออกแบบ
└── docker-compose.yml   # PostgreSQL สำหรับ dev
```

```
Browser ──► http://localhost:3000            Next.js (web)
               │  /api/*  ──rewrite──►  http://localhost:4000/api/*   Express (api) ──► PostgreSQL
```

browser เรียกแค่ `/api/...` ที่ origin ของเว็บเอง แล้ว Next.js ส่งต่อไปที่ API (ตั้งค่าใน [web/next.config.ts](web/next.config.ts))
- origin เดียวกัน → **ไม่ต้องตั้ง CORS** และ cookie `SameSite=Lax` ใช้ได้
- path ไม่ถูกตัด (`/api/...` → `/api/...`) → cookie `Path=/api/auth` ตรงกันทั้งสองฝั่ง
- URL ของ API ตั้งด้วย `API_URL` (ฝั่ง server เท่านั้น) ซึ่ง rewrites คำนวณ **ตอน build** จึงต้องตั้งก่อน build บน Vercel

## สิ่งที่ต้องมี

- Node.js 20.9+
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
npm run dev                # http://localhost:4000/api/health

# 3) รัน web (อีก terminal หนึ่ง)
cd web
npm install
npm run dev                # http://localhost:3000 → ต้องเห็น "API พร้อมใช้งาน"
```

## คำสั่งใน `web/`

| คำสั่ง                 | ทำอะไร                                   |
| ---------------------- | ---------------------------------------- |
| `npm run dev`          | Next.js dev server (port 3000)           |
| `npm run build`        | build สำหรับ production                   |
| `npm start`            | รันจาก build                              |
| `npm test`             | Vitest + Testing Library (jsdom)         |
| `npm run typecheck`    | เช็ค type                                 |
| `npm run lint`         | ESLint (กฎของ Next.js)                    |
| `npm run format`       | จัดรูปแบบด้วย Prettier (กฎเดียวกับ api)    |
| `npm run format:check` | เช็คการจัดรูปแบบ                          |
| `npm run test:e2e`     | Playwright E2E (Chromium + iPhone/WebKit) |
| `npm run test:e2e:ui`  | Playwright แบบมี UI ดูทีละ step            |
| `npm run test:e2e:report` | เปิด report ล่าสุด (รวม trace เมื่อ fail) |

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
| GET    | `/api/health`        | –    | liveness: process ยังทำงานอยู่ (ไม่เช็ค DB) |
| GET    | `/api/ready`         | –    | readiness: 200 ถ้าต่อ DB ได้, 503 ถ้า DB ล่ม |
| POST   | `/api/auth/register` | –    | สมัคร `{ name, email, password }` → `201 { user, accessToken }` + cookie |
| POST   | `/api/auth/login`    | –    | ล็อกอิน `{ email, password }` → `200 { user, accessToken }` + cookie |
| POST   | `/api/auth/refresh`  | 🍪   | แลก refresh token → `200 { user, accessToken }` + cookie ใหม่ |
| POST   | `/api/auth/logout`   | 🍪   | ออกจากระบบเฉพาะอุปกรณ์นี้ → `204` (เรียกซ้ำได้) |
| GET    | `/api/me`            | ✓    | ข้อมูลผู้ใช้ที่ล็อกอินอยู่ → `200 { user }` |
| POST   | `/api/groups`        | ✓    | สร้างกลุ่ม `{ name, currency? }` → `201 { group }` (ผู้สร้างเป็น owner) |
| GET    | `/api/groups`        | ✓    | กลุ่มของฉัน (role + จำนวนสมาชิก) → `200 { groups }` |
| GET    | `/api/groups/:id`    | ✓ สมาชิก | รายละเอียด + รายชื่อสมาชิก → `200 { group }` |
| GET    | `/api/groups/:id/invite` | ✓ สมาชิก | invite code สำหรับทำลิงก์ `/join/<code>` → `200 { code }` |
| POST   | `/api/groups/:id/invite/reset` | ✓ owner | ออก code ใหม่ ลิงก์เก่าใช้ไม่ได้ทันที → `200 { code }` |
| GET    | `/api/invites/:code` | ✓    | preview ก่อนเข้าร่วม → `200 { group: { id, name, memberCount }, alreadyMember }` |
| POST   | `/api/invites/:code/join` | ✓ | เข้าร่วม → `201 { group }` หรือ `200` ถ้าเป็นสมาชิกอยู่แล้ว |

- ✓ = ต้องส่ง header `Authorization: Bearer <accessToken>` (อายุ 15 นาทีตามค่าเริ่มต้น)
- 🍪 = ใช้ cookie `refresh_token` ที่ browser แนบมาให้เอง (ต้องเรียกด้วย `credentials: 'include'`)

### Access token + Refresh token

```
login/register ─► body: { user, accessToken }      access token (JWT, 15 นาที) → web เก็บใน memory
                  Set-Cookie: refresh_token=...    refresh token (สุ่ม 256 bit, 30 วัน) → httpOnly cookie

access token หมดอายุ ─► POST /api/auth/refresh ─► token เก่าถูกยกเลิก + ได้ตัวใหม่ (rotation)
POST /auth/logout ─► ยกเลิก refresh token ของอุปกรณ์นี้ + ลบ cookie
```

| ประเด็น | การออกแบบ | เหตุผล |
| --- | --- | --- |
| รูปแบบ refresh token | สตริงสุ่ม ไม่ใช่ JWT | ต้องค้น DB ทุกครั้ง จึงยกเลิกได้จริง |
| เก็บใน DB | SHA-256 ของ token | DB หลุดก็เอาไปใช้แทน token ไม่ได้ (token สุ่ม 256 bit จึงไม่ต้องใช้ hash แบบช้า) |
| Cookie | `HttpOnly` `Path=/api/auth` `SameSite=Lax` (+`Secure` บน production) | JS อ่านไม่ได้ (กัน XSS), ส่งเฉพาะ `/api/auth/*`, กัน CSRF |
| Rotation | token ใช้ได้ครั้งเดียว | token ที่หลุดไปมีอายุใช้งานสั้น |
| Reuse detection | ใช้ token เก่าซ้ำ → ยกเลิกทั้ง family | แปลว่า token อาจถูกขโมย: บังคับทั้งคนร้ายและเจ้าของให้ล็อกอินใหม่ |
| Refresh พร้อมกัน | ตัวที่สองถูกนับเป็นการใช้ซ้ำ (เข้มงวด) | ฝั่ง web ต้องรวม refresh ให้เหลือครั้งเดียว (single-flight) |
| หลัง logout | access token เดิมยังใช้ได้จนหมดอายุ (≤ 15 นาที) | JWT ตรวจได้โดยไม่ต้องค้น DB แลกกับช่วงเวลาสั้นๆ นี้ |

### Auth ฝั่ง web

| หน้า | ใครเข้าได้ |
| --- | --- |
| `/register`, `/login` | ยังไม่ล็อกอิน (ล็อกอินแล้วพาไป `?next=` หรือ `/groups`) |
| `/groups` | ต้องล็อกอิน (ยังไม่ล็อกอินพาไป `/login?next=/groups`) |

- **access token อยู่ใน memory เท่านั้น** ([web/src/lib/auth-client.ts](web/src/lib/auth-client.ts)) ไม่ใช้ `localStorage` เพราะ XSS อ่านได้ — reload แล้วกู้ session ด้วย `POST /api/auth/refresh` (cookie ถูกแนบให้เอง)
- **`authFetch()`** แนบ `Authorization: Bearer` และถ้าได้ `401 INVALID_TOKEN` จะ refresh แล้วลองใหม่ 1 ครั้ง
- **Refresh แบบ single-flight** (จำเป็นเพราะ API ใช้ reuse detection แบบเข้มงวด):
  - ใน tab เดียว: เรียกพร้อมกันกี่ตัวก็ยิงจริงครั้งเดียว — รวมถึง React StrictMode ที่รัน effect 2 รอบตอน dev
  - ข้าม tab: [Web Locks API](https://developer.mozilla.org/docs/Web/API/Web_Locks_API) ให้ refresh ต่อคิว tab ถัดไปจะได้ cookie ตัวใหม่แล้ว
- **`?next=` ถูกตรวจก่อนใช้** ([safe-redirect.ts](web/src/lib/safe-redirect.ts)) รับเฉพาะ path ในเว็บ — กัน open redirect (`//evil.com`, `/\evil.com`, `https://…`)
- การกันหน้า (`RequireAuth`) อยู่ฝั่ง client และเป็นแค่ UX — ข้อมูลจริงอยู่หลัง API ที่ตรวจ token ทุก request
  (ตรวจฝั่ง server ด้วย `proxy.ts` ไม่ได้ เพราะ cookie มี `Path=/api/auth` จึงไม่ถูกส่งมากับ request ของหน้าเว็บ)

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
| 401 | `INVALID_TOKEN` | access token ผิด/หมดอายุ → เรียก `/api/auth/refresh` |
| 401 | `INVALID_REFRESH_TOKEN` | refresh token ใช้ไม่ได้ → ต้องล็อกอินใหม่ |
| 403 | `FORBIDDEN` | เป็นสมาชิกแต่ไม่มีสิทธิ์ (เช่น member สั่ง reset ลิงก์เชิญ) |
| 404 | `NOT_FOUND` | ไม่มี route นี้ |
| 404 | `GROUP_NOT_FOUND` | ไม่มีกลุ่มนี้ **หรือไม่ได้เป็นสมาชิก** (ตอบเหมือนกัน กันการเดา id) |
| 404 | `INVITE_NOT_FOUND` | ลิงก์เชิญไม่ถูกต้องหรือถูก reset แล้ว |
| 409 | `EMAIL_TAKEN` | email นี้สมัครแล้ว |
| 500 | `INTERNAL_ERROR` | bug ฝั่ง server (รายละเอียดอยู่ใน log เท่านั้น) |

## Test

**api**
- **unit** (`api/tests/unit/`): ไม่แตะ DB ใช้ dependency ปลอม
- **integration** (`api/tests/integration/`): ยิง HTTP จริงผ่าน Supertest เข้า PostgreSQL จริง
  - ใช้ DB `splitpay_test` ใน docker-compose (สร้างและ migrate ให้อัตโนมัติ) หรือกำหนดเองด้วย `TEST_DATABASE_URL`
  - ล้างข้อมูลทุกตารางก่อนแต่ละ test และ **ไม่ยอมรัน** ถ้าชื่อ DB ไม่ลงท้ายด้วย `_test` กันลบข้อมูลจริงโดยไม่ตั้งใจ

**web**
- **unit/component** (`web/tests/`): Vitest + Testing Library ใน jsdom, fetch ปลอม
- **E2E** (`web/e2e/`): Playwright บนเบราว์เซอร์จริง (Chromium + iPhone 15/WebKit)
  - ต้องเปิด PostgreSQL (`docker compose up -d`) แล้วรัน `cd web && npm run test:e2e` — Playwright build และสตาร์ท api/web ให้เอง
  - **แยกจาก dev ทั้งหมด**: web `:3100`, api `:4100`, DB `splitpay_e2e`, build ไปที่ `.next-e2e` → รันได้แม้เปิด `npm run dev` ค้างไว้
  - ล้างข้อมูลก่อนรันทุกครั้ง และ **ไม่ยอมรัน** ถ้าชื่อ DB ไม่ลงท้ายด้วย `_e2e`
  - ตั้ง `ACCESS_TOKEN_TTL=5s` เพื่อทดสอบการ refresh เมื่อ access token หมดอายุกลางการใช้งาน
  - ครอบ: สมัคร/ล็อกอิน/ออกจากระบบ, reload แล้วยังล็อกอิน, **2 tab reload พร้อมกันไม่หลุด** (Web Locks), open redirect, cookie HttpOnly, ไม่มี token ใน storage

## CI (GitHub Actions)

[.github/workflows/ci.yml](.github/workflows/ci.yml) รันทุก PR และทุกครั้งที่ push เข้า `main` — `api` และ `web` ต้องผ่านถึงจะ merge ได้

| job | ตรวจอะไร |
| --- | --- |
| `api` | format → lint → typecheck → migrate DB ใหม่ → **drift check** → unit test → integration test (PostgreSQL จริงใน service container) → build |
| `web` | format → lint → typecheck → test → build |
| `e2e` | Playwright บน Chromium + iPhone (WebKit) กับ web production build + api + PostgreSQL — fail แล้วมี report/trace ให้ดาวน์โหลด (ยังไม่เป็น required check) |

- **Drift check** (`npm run db:check`): เทียบ DB ที่สร้างจาก `prisma/migrations` ล้วนๆ กับ `schema.prisma` — ถ้าแก้ schema แต่ลืมสร้าง migration, CI จะ fail
- Action ทุกตัว **pin ด้วย commit SHA** (กัน tag ถูกเลื่อนไปชี้โค้ดอื่น) และ [Dependabot](.github/dependabot.yml) เปิด PR อัปเดตให้ทุกวันจันทร์
- Node เวอร์ชันเดียวกันทั้ง CI และ local อยู่ที่ [.nvmrc](.nvmrc)

## ฐานข้อมูล

- Schema อยู่ที่ [api/prisma/schema.prisma](api/prisma/schema.prisma) และ migration อยู่ที่ [api/prisma/migrations/](api/prisma/migrations/)
- แก้ schema แล้วรัน `npm run db:migrate -- --name <ชื่อการเปลี่ยนแปลง>` เพื่อสร้าง migration ใหม่ แล้ว commit โฟลเดอร์ migration ทุกครั้ง
- ช่องที่เป็นจำนวนเงินทุกช่องเก็บเป็น **สตางค์ (จำนวนเต็ม)** ห้ามใช้ทศนิยม

### กลุ่มและสมาชิก

| ตาราง | จุดสำคัญ |
| --- | --- |
| `groups` | `invite_code` สุ่ม 128 bit (unique) กลุ่มละ 1 code ที่ owner reset ได้ · `currency` default `THB` · ลบ user ที่เป็น owner ไม่ได้ (`RESTRICT`) |
| `group_members` | **PK คู่ `(group_id, user_id)`** — DB กันเป็นสมาชิกซ้ำ (รวมถึงกดเข้าร่วมพร้อมกัน) · role `owner`/`member` · index `user_id` สำหรับ "กลุ่มของฉัน" · ลบกลุ่มแล้วสมาชิกหายตาม (`CASCADE`) |

- **ตรวจสิทธิ์ใน service** จาก membership ของคนที่เรียก — ไม่ใช่สมาชิกได้ `404` เหมือนไม่มีกลุ่ม (ไม่บอกว่ากลุ่มมีอยู่)
- รายชื่อสมาชิกไม่มี email
- ออกจากกลุ่มยังไม่ทำ — เมื่อทำควรเป็น soft leave (`left_at`) เพราะประวัติค่าใช้จ่ายต้องอ้างถึงคนที่ออกไปแล้วได้
