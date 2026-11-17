import { z } from 'zod';

export const createGroupSchema = z.object({
  name: z.string().trim().min(1).max(60),
  // PromptPay รองรับแค่บาท — เปิดเพิ่มเมื่อรองรับวิธีจ่ายอื่น
  currency: z.literal('THB').default('THB'),
});

export type CreateGroupInput = z.infer<typeof createGroupSchema>;
