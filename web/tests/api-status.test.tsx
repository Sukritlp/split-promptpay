import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { ApiStatus } from '@/components/api-status';

const json = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });

const READY = { status: 'ok', checks: { database: 'up' } };
const DB_DOWN = { status: 'unavailable', checks: { database: 'down' } };

function mockFetchOnce(...responses: Array<Response | Error>) {
  const fn = vi.fn<typeof fetch>();
  for (const r of responses) {
    if (r instanceof Error) fn.mockRejectedValueOnce(r);
    else fn.mockResolvedValueOnce(r);
  }
  vi.stubGlobal('fetch', fn);
  return fn;
}

describe('<ApiStatus />', () => {
  it('shows a loading state first, then "ready"', async () => {
    mockFetchOnce(json(200, READY));

    render(<ApiStatus />);

    expect(screen.getByRole('status')).toHaveTextContent('กำลังตรวจสอบ');
    expect(await screen.findByText('API พร้อมใช้งาน')).toBeInTheDocument();
  });

  it('calls /api/ready', async () => {
    const fetchMock = mockFetchOnce(json(200, READY));

    render(<ApiStatus />);
    await screen.findByText('API พร้อมใช้งาน');

    expect(fetchMock).toHaveBeenCalledWith('/api/ready', expect.anything());
  });

  it('shows "database down" when the API answers 503', async () => {
    mockFetchOnce(json(503, DB_DOWN));

    render(<ApiStatus />);

    expect(await screen.findByText('ฐานข้อมูลไม่พร้อม')).toBeInTheDocument();
  });

  it('shows "cannot reach API" on a network error', async () => {
    mockFetchOnce(new TypeError('Failed to fetch'));

    render(<ApiStatus />);

    expect(await screen.findByText('ติดต่อ API ไม่ได้')).toBeInTheDocument();
  });

  it('shows "cannot reach API" when the proxy returns a 500 HTML page', async () => {
    mockFetchOnce(new Response('<html>Internal Server Error</html>', { status: 500 }));

    render(<ApiStatus />);

    expect(await screen.findByText('ติดต่อ API ไม่ได้')).toBeInTheDocument();
  });

  it('re-checks when the retry button is pressed', async () => {
    const fetchMock = mockFetchOnce(new TypeError('Failed to fetch'), json(200, READY));
    const user = userEvent.setup();

    render(<ApiStatus />);
    await screen.findByText('ติดต่อ API ไม่ได้');
    await user.click(screen.getByRole('button', { name: 'ตรวจสอบอีกครั้ง' }));

    expect(await screen.findByText('API พร้อมใช้งาน')).toBeInTheDocument();
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('disables the retry button while checking', () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(() => new Promise<Response>(() => {})),
    ); // ไม่ตอบเลย

    render(<ApiStatus />);

    expect(screen.getByRole('button', { name: 'ตรวจสอบอีกครั้ง' })).toBeDisabled();
  });

  it('does not update state after unmount (request is aborted)', async () => {
    let capturedSignal: AbortSignal | undefined;
    vi.stubGlobal(
      'fetch',
      vi.fn((_input: RequestInfo | URL, init?: RequestInit) => {
        capturedSignal = init?.signal ?? undefined;
        return new Promise<Response>(() => {});
      }),
    );
    const consoleError = vi.spyOn(console, 'error');

    const { unmount } = render(<ApiStatus />);
    unmount();

    expect(capturedSignal?.aborted).toBe(true);
    await new Promise((r) => setTimeout(r, 0));
    expect(consoleError).not.toHaveBeenCalled();
  });
});
