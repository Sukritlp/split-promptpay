import { act, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { StrictMode } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { AuthProvider, useAuth } from '@/components/auth/auth-provider';
import { getAccessToken, resetAuthClientForTests } from '@/lib/auth-client';
import { apiError, json, mockApi, session } from './helpers/fetch-mock';

function Probe() {
  const { state, logout } = useAuth();
  return (
    <div>
      <p data-testid="status">{state.status}</p>
      {state.status === 'authenticated' && <p>{state.user.name}</p>}
      <button onClick={() => void logout()}>logout</button>
    </div>
  );
}

beforeEach(() => {
  resetAuthClientForTests();
  vi.stubGlobal('navigator', { ...navigator, locks: undefined });
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('<AuthProvider />', () => {
  it('starts as loading, then restores the session from the refresh cookie', async () => {
    mockApi({ '/api/auth/refresh': () => json(200, session('t1')) });

    render(
      <AuthProvider>
        <Probe />
      </AuthProvider>,
    );

    expect(screen.getByTestId('status')).toHaveTextContent('loading');
    expect(await screen.findByText('สมชาย')).toBeInTheDocument();
    expect(screen.getByTestId('status')).toHaveTextContent('authenticated');
  });

  it('becomes anonymous when there is no valid cookie', async () => {
    mockApi({ '/api/auth/refresh': () => apiError(401, 'INVALID_REFRESH_TOKEN') });

    render(
      <AuthProvider>
        <Probe />
      </AuthProvider>,
    );

    expect(await screen.findByText('anonymous')).toBeInTheDocument();
  });

  it('in <StrictMode> (effects run twice in dev) refreshes only once', async () => {
    // ถ้ายิง 2 ครั้ง API จะมองว่าเป็นการใช้ token ซ้ำและยกเลิก session → ผู้ใช้หลุดทุกครั้งที่ reload
    const api = mockApi({ '/api/auth/refresh': () => json(200, session('t1')) });

    render(
      <StrictMode>
        <AuthProvider>
          <Probe />
        </AuthProvider>
      </StrictMode>,
    );
    await screen.findByText('สมชาย');

    expect(api.calls('/api/auth/refresh')).toHaveLength(1);
  });

  it('logout clears the session even if the API call fails', async () => {
    mockApi({
      '/api/auth/refresh': () => json(200, session('t1')),
      '/api/auth/logout': () => Promise.reject(new TypeError('Failed to fetch')),
    });
    const user = userEvent.setup();
    render(
      <AuthProvider>
        <Probe />
      </AuthProvider>,
    );
    await screen.findByText('สมชาย');

    await user.click(screen.getByRole('button', { name: 'logout' }));

    expect(await screen.findByText('anonymous')).toBeInTheDocument();
    expect(getAccessToken()).toBeNull();
  });

  it('logout calls the API so the refresh token is revoked', async () => {
    const api = mockApi({
      '/api/auth/refresh': () => json(200, session('t1')),
      '/api/auth/logout': () => new Response(null, { status: 204 }),
    });
    const user = userEvent.setup();
    render(
      <AuthProvider>
        <Probe />
      </AuthProvider>,
    );
    await screen.findByText('สมชาย');

    await act(() => user.click(screen.getByRole('button', { name: 'logout' })));

    expect(api.calls('/api/auth/logout')).toHaveLength(1);
  });

  it('useAuth() outside the provider throws a clear error', () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});

    expect(() => render(<Probe />)).toThrow('useAuth() must be used inside <AuthProvider>');
  });
});
