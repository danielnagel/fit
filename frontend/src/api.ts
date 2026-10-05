export const UNAUTHORIZED_EVENT = 'fit:unauthorized';

// Thin wrapper around fetch (same signature): reports a 401 globally so the app switches to the
// login, no matter which component made the request. The session cookie is sent along with
// same-origin requests anyway (credentials default 'same-origin').
export async function apiFetch(...args: Parameters<typeof fetch>): Promise<Response> {
  const res = await fetch(...args);
  if (res.status === 401) window.dispatchEvent(new Event(UNAUTHORIZED_EVENT));
  return res;
}
