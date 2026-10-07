const GAME_ORIGIN = 'https://accelbyte.github.io';
const ALLOWED_HEADERS = new Set(['authorization', 'content-type']);

// Browser access is limited to the public game. Player verification and the
// operation allowlist remain the authority for every protected request.
export function deckCors(methods: readonly string[]) {
  function headers(request: Request): Headers | null {
    const origin = request.headers.get('origin');
    if (origin && origin !== new URL(request.url).origin && origin !== GAME_ORIGIN) return null;
    const result = new Headers({ 'Cache-Control': 'no-store', Vary: 'Origin' });
    if (origin) result.set('Access-Control-Allow-Origin', origin);
    return result;
  }
  return {
    async OPTIONS(request: Request) {
      const result = headers(request);
      const requestedMethod = request.headers.get('access-control-request-method');
      const requestedHeaders = (request.headers.get('access-control-request-headers') ?? '').split(',').map(value => value.trim().toLowerCase()).filter(Boolean);
      if (!result || !requestedMethod || !methods.includes(requestedMethod) || requestedHeaders.some(value => !ALLOWED_HEADERS.has(value))) {
        return new Response(null, { status: 403 });
      }
      result.set('Access-Control-Allow-Methods', methods.join(', '));
      result.set('Access-Control-Allow-Headers', 'Authorization, Content-Type');
      result.set('Access-Control-Max-Age', '600');
      return new Response(null, { status: 204, headers: result });
    },
    wrap(handler: (request: Request) => Promise<Response>) {
      return async (request: Request) => {
        const result = headers(request);
        if (!result) return Response.json({ error: 'Request origin is not allowed.' }, { status: 403 });
        const response = await handler(request);
        const combined = new Headers(response.headers);
        combined.set('Vary', [...new Set(`${combined.get('Vary') ?? ''}, Origin`.split(',').map(value => value.trim()).filter(Boolean))].join(', '));
        if (result.has('Access-Control-Allow-Origin')) combined.set('Access-Control-Allow-Origin', result.get('Access-Control-Allow-Origin')!);
        return new Response(response.body, { status: response.status, headers: combined });
      };
    },
  };
}
