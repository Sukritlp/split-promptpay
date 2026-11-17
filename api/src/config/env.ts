/**
 * ค่า env ที่ตรวจแล้ว — โค้ดส่วนอื่น import `env` จากไฟล์นี้ แทนการเรียก process.env ตรงๆ
 * - ถ้าค่าผิด แอปจะพังตั้งแต่ตอน start (fail fast) ไม่ใช่พังกลางทางตอนมี request
 * - dotenv โหลดไฟล์ .env บนเครื่อง dev; บน production (Railway/Render) ไม่มีไฟล์ .env
 *   ค่าจะมาจาก environment ของ platform แทน และ dotenv จะไม่ทำอะไร
 */
import 'dotenv/config';
import { parseEnv } from './parse-env.js';

export const env = parseEnv(process.env);
