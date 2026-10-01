import { afterEach, describe, expect, it, vi } from 'vitest';
import { UNAUTHORIZED_EVENT, apiFetch } from '../src/api';

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('apiFetch', () => {
  it('passes the arguments through to fetch unchanged', async () => {
    const fetchMock = vi.fn().mockResolvedValue({ status: 200 });
    vi.stubGlobal('fetch', fetchMock);

    await apiFetch('/api/plans');
    await apiFetch('/api/plans', { method: 'DELETE' });

    expect(fetchMock.mock.calls).toEqual([['/api/plans'], ['/api/plans', { method: 'DELETE' }]]);
  });

  it.each([
    [401, 1],
    [200, 0],
    [404, 0],
  ])('status %i dispatches the unauthorized event %i times', async (status, expected) => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ status }));
    const listener = vi.fn();
    window.addEventListener(UNAUTHORIZED_EVENT, listener);

    await apiFetch('/api/exercises');

    window.removeEventListener(UNAUTHORIZED_EVENT, listener);
    expect(listener).toHaveBeenCalledTimes(expected);
  });
});
