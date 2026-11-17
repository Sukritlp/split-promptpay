import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { RequireAuth } from '@/components/auth/require-auth';
import { GroupsHome } from '@/components/groups/groups-home';
import { HomeActions } from '@/components/home-actions';
import { getAccessToken } from '@/lib/auth-client';
import { apiError, deferred, json, mockApi, session, USER } from './helpers/fetch-mock';
import { renderWithAuth } from './helpers/render';
import { router, setPathname } from './helpers/router';

vi.mock('next/navigation', () => import('./helpers/router').then((m) => m.nextNavigationMock));

beforeEach(() => {
  vi.clearAllMocks();
  setPathname('/groups');
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('<RequireAuth />', () => {
  it('shows the page to signed-in users', () => {
    renderWithAuth(<RequireAuth>secret page</RequireAuth>, session('t1'));

    expect(screen.getByText('secret page')).toBeInTheDocument();
  });

  it('sends anonymous users to /login with ?next= set to the current page', async () => {
    setPathname('/groups/abc');

    renderWithAuth(<RequireAuth>secret page</RequireAuth>, 'anonymous');

    await waitFor(() => expect(router.replace).toHaveBeenCalledWith('/login?next=%2Fgroups%2Fabc'));
    expect(screen.queryByText('secret page')).not.toBeInTheDocument();
  });

  it('shows loading (not the page, no redirect) while the session is restored', () => {
    const pending = deferred<Response>();
    mockApi({ '/api/auth/refresh': () => pending.promise });

    renderWithAuth(<RequireAuth>secret page</RequireAuth>, 'loading');

    expect(screen.getByRole('status')).toHaveTextContent('กำลังโหลด');
    expect(screen.queryByText('secret page')).not.toBeInTheDocument();
    expect(router.replace).not.toHaveBeenCalled();
  });

  it('after a reload: restores the session and shows the page without redirecting', async () => {
    mockApi({ '/api/auth/refresh': () => json(200, session('t1')) });

    renderWithAuth(<RequireAuth>secret page</RequireAuth>, 'loading');

    expect(await screen.findByText('secret page')).toBeInTheDocument();
    expect(router.replace).not.toHaveBeenCalled();
  });
});

describe('/groups page', () => {
  function renderGroups() {
    return renderWithAuth(
      <RequireAuth>
        <GroupsHome />
      </RequireAuth>,
      session('t1'),
    );
  }

  it('greets the user and loads the profile from /api/me with the access token', async () => {
    const api = mockApi({ '/api/me': () => json(200, { user: USER }) });

    renderGroups();

    expect(screen.getByRole('heading', { name: 'สวัสดี สมชาย' })).toBeInTheDocument();
    expect(await screen.findByText('somchai@example.com')).toBeInTheDocument();
    const init = api.calls('/api/me')[0]?.[1];
    expect((init?.headers as Record<string, string>).Authorization).toBe('Bearer t1');
  });

  it('logout revokes the session and RequireAuth sends the user to /login', async () => {
    const api = mockApi({
      '/api/me': () => json(200, { user: USER }),
      '/api/auth/logout': () => new Response(null, { status: 204 }),
    });
    const user = userEvent.setup();
    renderGroups();
    await screen.findByText('somchai@example.com');

    await user.click(screen.getByRole('button', { name: 'ออกจากระบบ' }));

    await waitFor(() => expect(router.replace).toHaveBeenCalledWith('/login?next=%2Fgroups'));
    expect(api.calls('/api/auth/logout')).toHaveLength(1);
    expect(getAccessToken()).toBeNull();
  });

  it('if the session has expired on the server, the refresh fails and the user is sent to /login', async () => {
    mockApi({
      '/api/me': () => apiError(401, 'INVALID_TOKEN'),
      '/api/auth/refresh': () => apiError(401, 'INVALID_REFRESH_TOKEN'),
    });

    renderGroups();

    await waitFor(() => expect(router.replace).toHaveBeenCalledWith('/login?next=%2Fgroups'));
  });
});

describe('<HomeActions />', () => {
  it('shows sign-up and sign-in links to anonymous users', () => {
    renderWithAuth(<HomeActions />, 'anonymous');

    expect(screen.getByRole('link', { name: 'สมัครสมาชิก' })).toHaveAttribute('href', '/register');
    expect(screen.getByRole('link', { name: 'เข้าสู่ระบบ' })).toHaveAttribute('href', '/login');
  });

  it('shows a link to /groups to signed-in users', () => {
    renderWithAuth(<HomeActions />, session('t1'));

    expect(screen.getByRole('link', { name: 'ไปที่กลุ่มของฉัน' })).toHaveAttribute('href', '/groups');
  });
});
