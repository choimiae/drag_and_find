interface TelemetryEnv {
  GA4_MEASUREMENT_ID?: string;
  GA4_API_SECRET?: string;
  RATE_LIMITER?: {
    limit(options: { key: string }): Promise<{ success: boolean }>;
  };
}

export async function handleTelemetry(
  request: Request,
  env: TelemetryEnv,
  fetchFn: (input: string, init?: RequestInit) => Promise<Response> = fetch,
): Promise<Response> {
  if (!env.GA4_MEASUREMENT_ID || !env.GA4_API_SECRET) return new Response(null, { status: 503 });

  let body: Record<string, unknown>;
  try {
    const raw = await request.text();
    if (raw.length > 500) throw new Error('too large');
    const parsed: unknown = JSON.parse(raw);
    if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed))
      throw new Error('invalid body');
    body = parsed as Record<string, unknown>;
  } catch {
    return new Response(null, { status: 400 });
  }

  if (
    Object.keys(body).length !== 3 ||
    !['clientId', 'event', 'version'].every((key) => Object.hasOwn(body, key)) ||
    typeof body.clientId !== 'string' ||
    !/^[1-9]\d{0,9}\.[1-9]\d{0,9}$/.test(body.clientId) ||
    (body.event !== 'lookup_completed' && body.event !== 'lookup_failed') ||
    typeof body.version !== 'string' ||
    !/^[0-9A-Za-z][0-9A-Za-z.+-]{0,31}$/.test(body.version)
  )
    return new Response(null, { status: 400 });

  if (env.RATE_LIMITER) {
    const ip = request.headers.get('CF-Connecting-IP') ?? 'unknown';
    const allowed = await env.RATE_LIMITER.limit({ key: `telemetry:${ip}` });
    if (!allowed.success) return new Response(null, { status: 429 });
  }

  const url = new URL('https://www.google-analytics.com/mp/collect');
  url.searchParams.set('measurement_id', env.GA4_MEASUREMENT_ID);
  url.searchParams.set('api_secret', env.GA4_API_SECRET);
  try {
    const response = await fetchFn(url.href, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        client_id: body.clientId,
        events: [
          { name: body.event, params: { app_version: body.version, engagement_time_msec: 100 } },
        ],
      }),
      signal: AbortSignal.timeout(5_000),
    });
    return new Response(null, { status: response.ok ? 204 : 502 });
  } catch {
    return new Response(null, { status: 502 });
  }
}
