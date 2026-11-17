import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { GuestOnly } from '@/components/auth/guest-only';
import { RegisterForm } from '@/components/auth/register-form';
import { authStore } from '@/lib/auth-client';
import { apiError, deferred, json, mockApi, session } from './helpers/fetch-mock';
import { renderWithAuth } from './helpers/render';
import { router } from './helpers/router';

vi.mock('next/navigation', () => import('./helpers/router').then((m) => m.nextNavigationMock));

function setup() {
  const user = userEvent.setup();
  renderWithAuth(
    <GuestOnly>
      <RegisterForm />
    </GuestOnly>,
    'anonymous',
  );
  const fill = async (v: { name?: string; email?: string; password?: string }) => {
    if (v.name !== undefined) await user.type(screen.getByLabelText('ชื่อ'), v.name);
    if (v.email !== undefined) await user.type(screen.getByLabelText('อีเมล'), v.email);
    if (v.password !== undefined) await user.type(screen.getByLabelText(/รหัสผ่าน/), v.password);
  };
  const submit = () => user.click(screen.getByRole('button', { name: 'สมัครสมาชิก' }));
  return { user, fill, submit };
}

beforeEach(() => {
  vi.clearAllMocks();
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('<RegisterForm />', () => {
  it('uses autocomplete hints so password managers work', () => {
    setup();

    expect(screen.getByLabelText('ชื่อ')).toHaveAttribute('autocomplete', 'name');
    expect(screen.getByLabelText('อีเมล')).toHaveAttribute('autocomplete', 'email');
    expect(screen.getByLabelText(/รหัสผ่าน/)).toHaveAttribute('autocomplete', 'new-password');
  });

  it('shows Thai validation errors and does not call the API', async () => {
    const api = mockApi({});
    const { fill, submit } = setup();

    await fill({ email: 'nope', password: 'short' });
    await submit();

    expect(screen.getByText('กรุณากรอกชื่อ')).toBeInTheDocument();
    expect(screen.getByText('รูปแบบอีเมลไม่ถูกต้อง')).toBeInTheDocument();
    expect(screen.getByText('รหัสผ่านต้องมีอย่างน้อย 8 ตัวอักษร')).toBeInTheDocument();
    expect(screen.getByLabelText('อีเมล')).toHaveAttribute('aria-invalid', 'true');
    expect(api.fetch).not.toHaveBeenCalled();
  });

  it('clears a field error as soon as the user edits that field', async () => {
    mockApi({});
    const { user, submit } = setup();

    await submit();
    await user.type(screen.getByLabelText('ชื่อ'), 'ส');

    expect(screen.queryByText('กรุณากรอกชื่อ')).not.toBeInTheDocument();
    expect(screen.getByText('กรุณากรอกอีเมล')).toBeInTheDocument();
  });

  it('sends normalized data, signs the user in and goes to /groups', async () => {
    const api = mockApi({ '/api/auth/register': () => json(201, session('t1')) });
    const { fill, submit } = setup();

    await fill({ name: '  สมชาย ', email: ' SomChai@Example.com', password: 'correct-horse-1' });
    await submit();

    await waitFor(() => expect(router.replace).toHaveBeenCalledWith('/groups'));
    expect(JSON.parse(api.calls('/api/auth/register')[0]?.[1]?.body as string)).toEqual({
      name: 'สมชาย',
      email: 'somchai@example.com',
      password: 'correct-horse-1',
    });
    expect(authStore.getState().status).toBe('authenticated');
  });

  it('shows EMAIL_TAKEN on the email field', async () => {
    mockApi({ '/api/auth/register': () => apiError(409, 'EMAIL_TAKEN') });
    const { fill, submit } = setup();

    await fill({ name: 'สมชาย', email: 'taken@example.com', password: 'correct-horse-1' });
    await submit();

    expect(await screen.findByText('อีเมลนี้ถูกใช้สมัครแล้ว')).toBeInTheDocument();
    expect(screen.getByLabelText('อีเมล')).toHaveAttribute('aria-invalid', 'true');
    expect(router.replace).not.toHaveBeenCalled();
  });

  it('maps server VALIDATION_ERROR details onto fields', async () => {
    mockApi({
      '/api/auth/register': () =>
        json(400, {
          error: {
            code: 'VALIDATION_ERROR',
            message: 'bad',
            details: [{ path: 'name', message: 'Too big' }],
          },
        }),
    });
    const { fill, submit } = setup();

    await fill({ name: 'สมชาย', email: 'a@example.com', password: 'correct-horse-1' });
    await submit();

    expect(await screen.findByRole('alert')).toHaveTextContent('ข้อมูลไม่ถูกต้อง');
    expect(screen.getByLabelText('ชื่อ')).toHaveAttribute('aria-invalid', 'true');
  });

  it('shows a friendly message when the server cannot be reached', async () => {
    mockApi({ '/api/auth/register': () => Promise.reject(new TypeError('Failed to fetch')) });
    const { fill, submit } = setup();

    await fill({ name: 'สมชาย', email: 'a@example.com', password: 'correct-horse-1' });
    await submit();

    expect(await screen.findByRole('alert')).toHaveTextContent('ติดต่อเซิร์ฟเวอร์ไม่ได้');
    // กดส่งใหม่ได้
    expect(screen.getByRole('button', { name: 'สมัครสมาชิก' })).toBeEnabled();
  });

  it('disables the button while submitting and sends only one request on double click', async () => {
    const reply = deferred<Response>();
    const api = mockApi({ '/api/auth/register': () => reply.promise });
    const { user, fill } = setup();

    await fill({ name: 'สมชาย', email: 'a@example.com', password: 'correct-horse-1' });
    const button = screen.getByRole('button', { name: 'สมัครสมาชิก' });
    await user.dblClick(button);

    expect(screen.getByRole('button', { name: 'กำลังสมัคร…' })).toBeDisabled();
    expect(api.calls('/api/auth/register')).toHaveLength(1);
    reply.resolve(json(201, session('t1')));
    await waitFor(() => expect(router.replace).toHaveBeenCalledWith('/groups'));
  });
});
