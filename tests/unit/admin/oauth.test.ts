import { describe, expect, it, vi } from 'vitest';
import { getAccessToken } from '../../../admin/src/oauth';
import { serviceAccountJson } from './service-account-fixture';

describe('Google 서비스 계정 인증', () => {
  it('서명된 JWT로 읽기 전용 액세스 토큰을 받는다', async () => {
    const fetchFn = vi.fn(async (_input: RequestInfo | URL, init?: RequestInit) => {
      const form = new URLSearchParams(String(init?.body));
      expect(form.get('grant_type')).toBe('urn:ietf:params:oauth:grant-type:jwt-bearer');
      const assertion = form.get('assertion');
      expect(assertion?.split('.')).toHaveLength(3);
      const payload = JSON.parse(
        Buffer.from(assertion!.split('.')[1]!, 'base64url').toString(),
      ) as { iss: string; scope: string };
      expect(payload.iss).toBe('reports@example.iam.gserviceaccount.com');
      expect(payload.scope).toBe('https://www.googleapis.com/auth/chromewebstore.readonly');
      return Response.json({ access_token: 'short-lived', expires_in: 3600, token_type: 'Bearer' });
    });

    const token = await getAccessToken(
      { GOOGLE_SERVICE_ACCOUNT_JSON: await serviceAccountJson() },
      'https://www.googleapis.com/auth/chromewebstore.readonly',
      fetchFn,
    );

    expect(token).toBe('short-lived');
    expect(fetchFn.mock.calls[0]?.[0]).toBe('https://oauth2.googleapis.com/token');
  });

  it('인증 실패를 빈 토큰으로 숨기지 않는다', async () => {
    const fetchFn = vi.fn(async () => new Response('{}', { status: 401 }));

    await expect(
      getAccessToken(
        { GOOGLE_SERVICE_ACCOUNT_JSON: await serviceAccountJson() },
        'https://www.googleapis.com/auth/chromewebstore.readonly',
        fetchFn,
      ),
    ).rejects.toThrow();
  });
});
