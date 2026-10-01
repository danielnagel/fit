export const UNAUTHORIZED_EVENT = 'fit:unauthorized';

// Duenner Wrapper um fetch (gleiche Signatur): meldet ein 401 global, damit die App auf den Login
// umschaltet, egal welche Komponente die Anfrage gestellt hat. Das Session-Cookie geht bei
// same-origin-Anfragen ohnehin mit (credentials-Default 'same-origin').
export async function apiFetch(...args: Parameters<typeof fetch>): Promise<Response> {
  const res = await fetch(...args);
  if (res.status === 401) window.dispatchEvent(new Event(UNAUTHORIZED_EVENT));
  return res;
}
