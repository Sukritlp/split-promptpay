import { screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { GuestOnly } from '@/components/auth/guest-only';
import { deferred, mockApi, session } from './helpers/fetch-mock';
import { renderWithAuth } from './helpers/render';
import { router } from './helpers/router';

vi.mock('next/navigation', () => import('./helpers/router').then((m) => m.nextNavigationMock));

beforeEach(() => {
  vi.clearAllMocks();
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('<GuestOnly />', () => {
  it('shows the content to anonymous users', () => {
    renderWithAuth(<GuestOnly>login form</GuestOnly>, 'anonymous');

    expect(screen.getByText('login form')).toBeInTheDocument();
    expect(router.replace).not.toHaveBeenCalled();
  });

  it('redirects signed-in users without flashing the content', async () => {
    renderWithAuth(<GuestOnly redirectTo="/groups/abc">login form</GuestOnly>, session('t1'));

    expect(screen.queryByText('login form')).not.toBeInTheDocument();
    await waitFor(() => expect(router.replace).toHaveBeenCalledWith('/groups/abc'));
  });

  it('shows a loading state (not the form) while the session is being restored', () => {
    const pending = deferred<Response>();
    mockApi({ '/api/auth/refresh': () => pending.promise });

    renderWithAuth(<GuestOnly>login form</GuestOnly>, 'loading');

    expect(screen.getByRole('status')).toHaveTextContent('กำลังโหลด');
    expect(screen.queryByText('login form')).not.toBeInTheDocument();
  });
});
