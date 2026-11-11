export interface AccessEnv {
  ACCESS_TEAM_DOMAIN?: string;
  ACCESS_AUD?: string;
  ADMIN_EMAIL?: string;
}

function decodeJson(segment: string): Record<string, unknown> {
  const base64 = segment.replace(/-/g, '+').replace(/_/g, '/');
  const bytes = Uint8Array.from(
    atob(base64.padEnd(Math.ceil(base64.length / 4) * 4, '=')),
    (char) => char.charCodeAt(0),
  );
  const value: unknown = JSON.parse(new TextDecoder().decode(bytes));
  if (typeof value !== 'object' || value === null || Array.isArray(value))
    throw new Error('JWT 형식 오류');
  return value as Record<string, unknown>;
}

export async function verifyAccess(
  request: Request,
  env: AccessEnv,
  fetchFn: typeof fetch = fetch,
  now = Date.now(),
): Promise<boolean> {
  if (
    !env.ACCESS_TEAM_DOMAIN ||
    !/^https:\/\/[a-z0-9-]+\.cloudflareaccess\.com$/.test(env.ACCESS_TEAM_DOMAIN) ||
    !env.ACCESS_AUD ||
    !env.ADMIN_EMAIL
  )
    return false;
  const jwt = request.headers.get('Cf-Access-Jwt-Assertion');
  if (!jwt || jwt.length > 8192) return false;
  const parts = jwt.split('.');
  if (parts.length !== 3) return false;
  try {
    const [headerPart, payloadPart, signaturePart] = parts as [string, string, string];
    const header = decodeJson(headerPart);
    const payload = decodeJson(payloadPart);
    if (
      header.alg !== 'RS256' ||
      typeof header.kid !== 'string' ||
      payload.iss !== env.ACCESS_TEAM_DOMAIN ||
      !(
        payload.aud === env.ACCESS_AUD ||
        (Array.isArray(payload.aud) && payload.aud.includes(env.ACCESS_AUD))
      ) ||
      typeof payload.exp !== 'number' ||
      payload.exp * 1000 <= now ||
      (typeof payload.nbf === 'number' && payload.nbf * 1000 > now) ||
      typeof payload.email !== 'string' ||
      payload.email.toLowerCase() !== env.ADMIN_EMAIL.toLowerCase()
    )
      return false;
    const response = await fetchFn(`${env.ACCESS_TEAM_DOMAIN}/cdn-cgi/access/certs`, {
      signal: AbortSignal.timeout(5_000),
    });
    if (!response.ok) return false;
    const certs = (await response.json()) as { keys?: Array<JsonWebKey & { kid?: string }> };
    const jwk = certs.keys?.find((key) => key.kid === header.kid && key.kty === 'RSA');
    if (!jwk) return false;
    const key = await crypto.subtle.importKey(
      'jwk',
      jwk,
      { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' },
      false,
      ['verify'],
    );
    const base64 = signaturePart.replace(/-/g, '+').replace(/_/g, '/');
    const signature = Uint8Array.from(
      atob(base64.padEnd(Math.ceil(base64.length / 4) * 4, '=')),
      (char) => char.charCodeAt(0),
    );
    return crypto.subtle.verify(
      'RSASSA-PKCS1-v1_5',
      key,
      signature,
      new TextEncoder().encode(`${headerPart}.${payloadPart}`),
    );
  } catch {
    return false;
  }
}
