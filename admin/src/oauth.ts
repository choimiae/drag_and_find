export interface GoogleServiceAccountEnv {
  GOOGLE_SERVICE_ACCOUNT_JSON?: string;
}

function base64Url(bytes: Uint8Array): string {
  return btoa(String.fromCharCode(...bytes))
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
}

function encodeJson(value: object): string {
  return base64Url(new TextEncoder().encode(JSON.stringify(value)));
}

function parseServiceAccount(raw: string | undefined): {
  client_email: string;
  private_key: string;
} {
  if (!raw) throw new Error('Google 서비스 계정 정보가 없습니다');
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    throw new Error('Google 서비스 계정 형식 오류');
  }
  if (
    typeof parsed !== 'object' ||
    parsed === null ||
    !('client_email' in parsed) ||
    typeof parsed.client_email !== 'string' ||
    !('private_key' in parsed) ||
    typeof parsed.private_key !== 'string'
  )
    throw new Error('Google 서비스 계정 형식 오류');
  return { client_email: parsed.client_email, private_key: parsed.private_key };
}

export async function getAccessToken(
  env: GoogleServiceAccountEnv,
  scope: string,
  fetchFn: typeof fetch = fetch,
  now: Date = new Date(),
): Promise<string> {
  const account = parseServiceAccount(env.GOOGLE_SERVICE_ACCOUNT_JSON);
  const pem = account.private_key.replace(
    /-----BEGIN PRIVATE KEY-----|-----END PRIVATE KEY-----|\s/g,
    '',
  );
  const keyBytes = Uint8Array.from(atob(pem), (char) => char.charCodeAt(0));
  const key = await crypto.subtle.importKey(
    'pkcs8',
    keyBytes,
    { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' },
    false,
    ['sign'],
  );
  const issuedAt = Math.floor(now.getTime() / 1000);
  const unsigned = `${encodeJson({ alg: 'RS256', typ: 'JWT' })}.${encodeJson({
    iss: account.client_email,
    scope,
    aud: 'https://oauth2.googleapis.com/token',
    iat: issuedAt,
    exp: issuedAt + 3600,
  })}`;
  const signature = await crypto.subtle.sign(
    'RSASSA-PKCS1-v1_5',
    key,
    new TextEncoder().encode(unsigned),
  );
  const assertion = `${unsigned}.${base64Url(new Uint8Array(signature))}`;
  const response = await fetchFn('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
      assertion,
    }),
    signal: AbortSignal.timeout(10_000),
  });
  if (!response.ok) throw new Error('Google 서비스 계정 인증 실패');
  const result: unknown = await response.json();
  const token =
    typeof result === 'object' && result !== null && 'access_token' in result
      ? result.access_token
      : undefined;
  if (typeof token !== 'string' || !token) throw new Error('Google 인증 응답 형식 오류');
  return token;
}
