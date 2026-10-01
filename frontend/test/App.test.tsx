import { render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import App from '../src/App';

function jsonResponse(body: unknown, ok = true, status = ok ? 200 : 400) {
  return { ok, status, json: async () => body } as Response;
}

const fetchMock = vi.fn();

beforeEach(() => {
  vi.stubGlobal('fetch', fetchMock);
  fetchMock.mockReset();
  fetchMock.mockImplementation((url: string) => {
    if (url === '/api/auth/me') return Promise.resolve(jsonResponse({ id: 1, username: 'anna' }));
    if (url === '/api/plan-weeks/active') return Promise.resolve(jsonResponse(null));
    return Promise.resolve(jsonResponse([]));
  });
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('App', () => {
  it('redirects unknown routes to /training', async () => {
    window.history.pushState({}, '', '/unbekannt');
    render(<App />);

    expect(await screen.findByRole('heading', { name: 'Training' })).toBeInTheDocument();
  });

  it('renders the plans page on /plans', async () => {
    window.history.pushState({}, '', '/plans');
    render(<App />);

    expect(await screen.findByRole('heading', { name: 'Trainingspläne' })).toBeInTheDocument();
  });

  it('renders the exercises page on /exercises', async () => {
    window.history.pushState({}, '', '/exercises');
    render(<App />);

    expect(await screen.findByRole('heading', { name: 'Übungen' })).toBeInTheDocument();
  });

  it('renders the history page on /history', async () => {
    window.history.pushState({}, '', '/history');
    render(<App />);

    expect(await screen.findByRole('heading', { name: 'Trainingshistorie' })).toBeInTheDocument();
  });
});
