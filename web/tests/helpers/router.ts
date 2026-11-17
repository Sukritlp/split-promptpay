import { vi } from 'vitest';

/**
 * router ปลอมของ next/navigation — ใช้คู่กับ:
 *   vi.mock('next/navigation', () => import('./helpers/router').then((m) => m.nextNavigationMock));
 */
export const router = {
  replace: vi.fn<(href: string) => void>(),
  push: vi.fn<(href: string) => void>(),
  refresh: vi.fn(),
  back: vi.fn(),
  forward: vi.fn(),
  prefetch: vi.fn(),
};

let pathname = '/';

export function setPathname(path: string): void {
  pathname = path;
}

export const nextNavigationMock = {
  useRouter: () => router,
  usePathname: () => pathname,
};
