import { render } from '@testing-library/react';
import { vi } from 'vitest';
import { AuthProvider } from '@/components/auth/auth-provider';
import { resetAuthClientForTests, setSession } from '@/lib/auth-client';
import type { AuthResult } from '@/lib/types';

/**
 * render ภายใน <AuthProvider> โดยกำหนดสถานะเริ่มต้นได้
 * - 'anonymous' / session: ตั้งไว้ก่อน → AuthProvider ไม่ต้องเรียก /api/auth/refresh
 * - 'loading': ปล่อยให้ AuthProvider กู้ session เอง (ต้อง mock /api/auth/refresh)
 */
export function renderWithAuth(ui: React.ReactNode, initial: 'loading' | 'anonymous' | AuthResult) {
  resetAuthClientForTests();
  vi.stubGlobal('navigator', { ...navigator, locks: undefined });
  if (initial === 'anonymous') setSession(null);
  else if (initial !== 'loading') setSession(initial);
  return render(<AuthProvider>{ui}</AuthProvider>);
}
