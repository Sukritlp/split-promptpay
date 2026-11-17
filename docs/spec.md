# split-promptpay: แอปหารบิลพร้อม PromptPay

## เป้าหมาย
เว็บแอปให้เพื่อนในกลุ่มบันทึกค่าใช้จ่ายร่วมกัน คำนวณว่าใครต้องโอนให้ใครน้อยที่สุด
และสร้าง QR PromptPay ให้สแกนจ่ายได้ทันที เป็นโปรเจคสำหรับ portfolio สมัครงาน
Full-Stack ในบริษัท tech ของไทย ต้อง deploy จริง มี test, CI และ README ที่ดี

## ผู้พัฒนา
นักศึกษาจบใหม่ เคยใช้ JavaScript, TypeScript, React, Vue, Node.js, Express, SQL, Docker, Git
ต้องการเข้าใจโค้ดทุกส่วนเพื่ออธิบายตอนสัมภาษณ์ ให้ช่วยแบบสอนและอธิบายเหตุผล
ไม่ใช่เขียนให้ทั้งหมด ส่วนตรรกะหารเงินและอัลกอริทึมลดจำนวนการโอนฉันจะเขียนเอง
ให้ช่วยรีวิว หาเคสขอบ และเขียน test

## Tech stack
- Frontend: Next.js + TypeScript + Tailwind (โฟลเดอร์ web/)
- Backend: Node.js + TypeScript + Express (โฟลเดอร์ api/) อาจเปลี่ยนเป็น NestJS
- Database: PostgreSQL + Prisma
- Auth: JWT + refresh token, Google OAuth
- ไฟล์รูปใบเสร็จ/สลิป: Supabase Storage หรือ S3-compatible
- แจ้งเตือน: LINE Messaging API
- Test: Vitest/Jest + Supertest
- DevOps: Docker Compose, GitHub Actions, deploy บน Railway/Render/Vercel

## ลำดับฟีเจอร์
1. แกนหลัก: สมัคร/ล็อกอิน, สร้างกลุ่ม, เชิญสมาชิกด้วยลิงก์, เพิ่มรายการค่าใช้จ่าย
2. ตรรกะเงิน: หารเท่ากัน, หารตามสัดส่วน/กำหนดเอง, ยอดสุทธิรายคน,
   อัลกอริทึมลดจำนวนการโอน, test กรณีขอบ (เศษสตางค์, สมาชิกออกกลางคัน)
3. PromptPay: สร้าง QR ตามมาตรฐาน EMVCo/PromptPay, ปุ่ม "จ่ายแล้ว" และผู้รับยืนยัน,
   แนบสลิป, แจ้งเตือนผ่าน LINE
4. ขัดเกลา: รายงานสรุปกลุ่ม, export CSV, UI มือถือ, CI/CD, deploy, README + architecture diagram

## ตารางฐานข้อมูลคร่าวๆ
- users: id, name, email, promptpay_id, line_user_id
- groups: id, name, owner_id, currency
- group_members: group_id, user_id, role, joined_at
- expenses: id, group_id, paid_by, amount, description, split_type, created_at
- expense_shares: expense_id, user_id, share_amount
- settlements: id, group_id, from_user, to_user, amount, status, slip_url

## กติกาสำคัญ
- เก็บจำนวนเงินเป็นหน่วยสตางค์ (จำนวนเต็ม) ห้ามใช้ทศนิยม
- ทำทีละงานเล็กๆ commit บ่อย ใช้ branch + PR และชื่อ commit แบบ feat:/fix:/test:
- ก่อนเขียนโค้ดทุกครั้ง ให้เสนอแผนไฟล์ที่จะสร้างหรือแก้ แล้วรอฉันยืนยัน
- ห้ามเอา secret/.env ขึ้น git ให้มี .env.example แทน

## งานแรก (2 วันแรก)
API มี /health, เชื่อม PostgreSQL + migration ตาราง users, สมัคร/ล็อกอินได้,
หน้าเว็บเรียก API ได้อย่างน้อย 1 ครั้ง