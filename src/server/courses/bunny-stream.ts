import 'server-only';

export function bunnyStreamConfig() {
  const libraryId = process.env.BUNNY_STREAM_LIBRARY_ID?.trim();
  const apiKey = process.env.BUNNY_STREAM_API_KEY?.trim();
  const tokenKey = process.env.BUNNY_STREAM_TOKEN_AUTH_KEY?.trim();
  const tokenAuthEnabled = process.env.BUNNY_STREAM_EMBED_TOKEN_AUTH_ENABLED?.trim().toLowerCase() === 'true';
  if (!libraryId || !apiKey || !tokenKey || !tokenAuthEnabled) throw new Error('Bunny Stream is not configured. Set the library and API keys, enable Embed View Token Authentication in Bunny, and confirm it with BUNNY_STREAM_EMBED_TOKEN_AUTH_ENABLED=true.');
  return { libraryId, apiKey, tokenKey };
}

export async function bunnyRequest(path: string, init: RequestInit = {}) {
  const { apiKey } = bunnyStreamConfig();
  const response = await fetch(`https://video.bunnycdn.com${path}`, {
    ...init,
    headers: { Accept: 'application/json', ...(init.body ? { 'Content-Type': 'application/json' } : {}), AccessKey: apiKey, ...init.headers },
    cache: 'no-store',
    signal: AbortSignal.timeout(15_000),
  });
  return response;
}
