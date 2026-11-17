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
cp .env.example .env
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
| `npm test`             | รัน test ด้วย Vitest + Supertest            |
| `npm run typecheck`    | เช็ค type โดยไม่ build                     |
| `npm run lint`         | ESLint                                    |
| `npm run format`       | จัดรูปแบบโค้ดด้วย Prettier                 |
| `npm run format:check` | เช็คว่าโค้ดถูกจัดรูปแบบแล้ว (ใช้ใน CI)      |
| `npm run db:migrate`   | สร้าง/รัน migration บนเครื่อง dev (`prisma migrate dev`) |
| `npm run db:deploy`    | รัน migration ที่มีอยู่บน production (`prisma migrate deploy`) |
| `npm run db:generate`  | generate Prisma Client ใหม่หลังแก้ schema   |
| `npm run db:studio`    | เปิด Prisma Studio ดู/แก้ข้อมูลผ่านเว็บ      |

## API

| Method | Path      | คำอธิบาย                              |
| ------ | --------- | ------------------------------------- |
| GET    | `/health` | liveness: process ยังทำงานอยู่ (ไม่เช็ค DB) |
| GET    | `/ready`  | readiness: เช็คว่าต่อ DB ได้ — 200 ถ้าพร้อม, 503 ถ้า DB ล่ม |

## ฐานข้อมูล

- Schema อยู่ที่ [api/prisma/schema.prisma](api/prisma/schema.prisma) และ migration อยู่ที่ [api/prisma/migrations/](api/prisma/migrations/)
- แก้ schema แล้วรัน `npm run db:migrate -- --name <ชื่อการเปลี่ยนแปลง>` เพื่อสร้าง migration ใหม่ แล้ว commit โฟลเดอร์ migration ทุกครั้ง
- ช่องที่เป็นจำนวนเงินทุกช่องเก็บเป็น **สตางค์ (จำนวนเต็ม)** ห้ามใช้ทศนิยม
