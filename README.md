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
npm install
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

## API

| Method | Path      | คำอธิบาย                              |
| ------ | --------- | ------------------------------------- |
| GET    | `/health` | เช็คว่า API ทำงานอยู่ `{ status: "ok" }` |
