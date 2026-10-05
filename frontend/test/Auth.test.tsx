import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import App from '../src/App';

function jsonResponse(body: unknown, status = 200) {
  return { ok: status >= 200 && status < 300, status, json: async () => body } as Response;
}

const fetchMock = vi.fn();
let loggedIn: boolean;
let loginStatus: number;

beforeEach(() => {
  loggedIn = false;
  loginStatus = 200;
  vi.stubGlobal('fetch', fetchMock);
  fetchMock.mockReset();
  fetchMock.mockImplementation((url: string) => {
    if (url === '/api/auth/me') {
      return Promise.resolve(loggedIn ? jsonResponse({ id: 1, username: 'anna' }) : jsonResponse({}, 401));
    }
    if (url === '/api/auth/login') {
      if (loginStatus === 200) loggedIn = true;
      return Promise.resolve(jsonResponse(loginStatus === 200 ? { id: 1, username: 'anna' } : {}, loginStatus));
    }
    if (url === '/api/auth/logout') {
      loggedIn = false;
      return Promise.resolve(jsonResponse(null, 204));
    }
    if (!loggedIn) return Promise.resolve(jsonResponse({ error: 'not_authenticated' }, 401));
    if (url === '/api/plan-weeks/active') return Promise.resolve(jsonResponse(null));
    return Promise.resolve(jsonResponse([]));
  });
});

afterEach(() => {
  vi.unstubAllGlobals();
});

async function submitLogin(user: ReturnType<typeof userEvent.setup>) {
  await user.type(await screen.findByLabelText('Username'), 'anna');
  await user.type(screen.getByLabelText('Password'), 'geheim123');
  await user.click(screen.getByRole('button', { name: 'Log in' }));
}

describe('authentication flow', () => {
  it('shows only the login form when nobody is logged in', async () => {
    window.history.pushState({}, '', '/plans');
    render(<App />);

    expect(await screen.findByRole('heading', { name: 'Log in' })).toBeInTheDocument();
    expect(window.location.pathname).toBe('/login');
    expect(screen.queryByRole('link', { name: 'Plans' })).not.toBeInTheDocument();
  });

  it('returns to the originally requested page after logging in', async () => {
    const user = userEvent.setup();
    window.history.pushState({}, '', '/history');
    render(<App />);

    await submitLogin(user);

    expect(await screen.findByRole('heading', { name: 'Training history' })).toBeInTheDocument();
    expect(window.location.pathname).toBe('/history');
    expect(fetchMock).toHaveBeenCalledWith('/api/auth/login', expect.objectContaining({
      method: 'POST',
      body: JSON.stringify({ username: 'anna', password: 'geheim123' }),
    }));
  });

  it('keeps the query string of the original page, e.g. a running session', async () => {
    const user = userEvent.setup();
    window.history.pushState({}, '', '/plans?x=1');
    render(<App />);

    await submitLogin(user);

    await screen.findByRole('heading', { name: 'Training plans' });
    expect(`${window.location.pathname}${window.location.search}`).toBe('/plans?x=1');
  });

  it.each([
    [401, 'Wrong username or password'],
    [429, 'Too many attempts – please try again in a few minutes'],
  ])('shows an error for status %i', async (status, message) => {
    loginStatus = status;
    const user = userEvent.setup();
    window.history.pushState({}, '', '/login');
    render(<App />);

    await submitLogin(user);

    expect(await screen.findByRole('alert')).toHaveTextContent(message);
    expect(screen.getByLabelText('Password')).toHaveValue('');
  });

  it('shows the username and logs out', async () => {
    loggedIn = true;
    const user = userEvent.setup();
    window.history.pushState({}, '', '/plans');
    render(<App />);

    expect(await screen.findByText('anna')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Log out' }));

    expect(await screen.findByRole('heading', { name: 'Log in' })).toBeInTheDocument();
    expect(fetchMock).toHaveBeenCalledWith('/api/auth/logout', { method: 'POST' });
  });

  it('switches to the login form when the session expires during use', async () => {
    loggedIn = true;
    const user = userEvent.setup();
    window.history.pushState({}, '', '/exercises');
    render(<App />);
    await screen.findByRole('heading', { name: 'Exercises' });

    loggedIn = false;
    await user.type(screen.getByPlaceholderText('Name'), 'Squat');
    await user.keyboard('{Enter}');

    await waitFor(() => expect(screen.getByRole('heading', { name: 'Log in' })).toBeInTheDocument());
    await submitLogin(user);
    expect(await screen.findByRole('heading', { name: 'Exercises' })).toBeInTheDocument();
  });
});

describe('demo mode', () => {
  it('hides the demo entry outside of demo mode', async () => {
    window.history.pushState({}, '', '/login');
    render(<App />);

    await screen.findByRole('heading', { name: 'Log in' });
    expect(screen.queryByRole('button', { name: 'Try the demo' })).not.toBeInTheDocument();
  });

  it('shows only the demo entry on the login page and starts a demo session', async () => {
    const base = fetchMock.getMockImplementation()!;
    fetchMock.mockImplementation((url: string, init?: RequestInit) => {
      if (url === '/api/auth/config') return Promise.resolve(jsonResponse({ demo: true, demo_ttl_minutes: 10 }));
      if (url === '/api/auth/demo') {
        loggedIn = true;
        return Promise.resolve(jsonResponse({ id: 7, username: 'demo-abc123' }, 201));
      }
      return base(url, init);
    });
    const user = userEvent.setup();
    window.history.pushState({}, '', '/plans');
    render(<App />);

    expect(await screen.findByText(/after 10 minutes/)).toBeInTheDocument();
    expect(screen.queryByLabelText('Username')).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Log in' })).not.toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Try the demo' }));

    expect(await screen.findByRole('heading', { name: 'Training plans' })).toBeInTheDocument();
    expect(screen.getByText('demo-abc123')).toBeInTheDocument();
    expect(fetchMock).toHaveBeenCalledWith('/api/auth/demo', { method: 'POST' });
  });
});
