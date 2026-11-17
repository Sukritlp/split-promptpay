import { safeRedirect } from './safe-redirect';

type SearchParams = Record<string, string | string[] | undefined>;

/**
 * อ่าน ?next= จาก searchParams ของหน้า (server component) แล้วตรวจให้ปลอดภัย
 * คืน { redirectTo, query } — query ใช้ต่อท้ายลิงก์สลับหน้า login ↔ register ให้ next ไม่หาย
 */
export function readNextParam(searchParams: SearchParams): { redirectTo: string; query: string } {
  const raw = searchParams.next;
  // ?next=a&next=b → ไม่เดาว่าตัวไหนถูก ใช้ค่าเริ่มต้น
  const redirectTo = safeRedirect(Array.isArray(raw) ? undefined : raw);
  const query = redirectTo === '/groups' ? '' : `?next=${encodeURIComponent(redirectTo)}`;
  return { redirectTo, query };
}
