import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { GuestOnly } from '@/components/auth/guest-only';
import { LoginForm } from '@/components/auth/login-form';
import { readNextParam } from '@/lib/next-param';
import { apiError, json, mockApi, session } from './helpers/fetch-mock';
import { renderWithAuth } from './helpers/render';
import { router } from './helpers/router';

vi.mock('next/navigation', () => import('./helpers/router').then((m) => m.nextNavigationMock));

function setup(redirectTo = '/groups') {
  const user = userEvent.setup();
  renderWithAuth(
    <GuestOnly redirectTo={redirectTo}>
      <LoginForm />
    </GuestOnly>,
    'anonymous',
  );
  const fill = async (email: string, password: string) => {
    if (email) await user.type(screen.getByLabelText('อีเมล'), email);
    if (password) await user.type(screen.getByLabelText('รหัสผ่าน'), password);
  };
  const submit = () => user.click(screen.getByRole('button', { name: 'เข้าสู่ระบบ' }));
  return { fill, submit };
}

beforeEach(() => {
  vi.clearAllMocks();
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('<LoginForm />', () => {
  it('uses current-password autocomplete', () => {
    setup();

    expect(screen.getByLabelText('รหัสผ่าน')).toHaveAttribute('autocomplete', 'current-password');
  });

  it('validates required fields without calling the API', async () => {
    const api = mockApi({});
    const { submit } = setup();

    await submit();

    expect(screen.getByText('กรุณากรอกอีเมล')).toBeInTheDocument();
    expect(screen.getByText('กรุณากรอกรหัสผ่าน')).toBeInTheDocument();
    expect(api.fetch).not.toHaveBeenCalled();
  });

  it('signs in and goes to the redirect target', async () => {
    mockApi({ '/api/auth/login': () => json(200, session('t1')) });
    const { fill, submit } = setup('/groups/abc');

    await fill('somchai@example.com', 'correct-horse-1');
    await submit();

    await waitFor(() => expect(router.replace).toHaveBeenCalledWith('/groups/abc'));
  });

  it('shows one generic message for wrong credentials and clears the password', async () => {
    mockApi({ '/api/auth/login': () => apiError(401, 'INVALID_CREDENTIALS') });
    const { fill, submit } = setup();

    await fill('somchai@example.com', 'wrong-password');
    await submit();

    expect(await screen.findByRole('alert')).toHaveTextContent('อีเมลหรือรหัสผ่านไม่ถูกต้อง');
    expect(screen.getByLabelText('รหัสผ่าน')).toHaveValue('');
    expect(screen.getByLabelText('อีเมล')).toHaveValue('somchai@example.com');
    expect(router.replace).not.toHaveBeenCalled();
  });
});

describe('readNextParam (login/register pages)', () => {
  it('uses a safe ?next= and keeps it for the login ↔ register link', () => {
    expect(readNextParam({ next: '/join/abc' })).toEqual({
      redirectTo: '/join/abc',
      query: '?next=%2Fjoin%2Fabc',
    });
  });

  it.each([
    ['missing', {}],
    ['external', { next: 'https://evil.com' }],
    ['protocol-relative', { next: '//evil.com' }],
    ['repeated ?next=', { next: ['/a', '/b'] }],
  ])('falls back to /groups when %s', (_label, params) => {
    expect(readNextParam(params)).toEqual({ redirectTo: '/groups', query: '' });
  });
});
