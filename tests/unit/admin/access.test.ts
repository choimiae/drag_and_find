import { describe, expect, it, vi } from 'vitest';
import admin from '../../../admin/src/api';
import { verifyAccess } from '../../../admin/src/access';

const env = {
  ACCESS_TEAM_DOMAIN: 'https://maestro.cloudflareaccess.com',
  ACCESS_AUD: 'admin-app',
  ADMIN_EMAIL: 'maestro@example.com',
};

function encode(value: object): string {
  return btoa(JSON.stringify(value)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

describe('관리자 Access 인증', () => {
  it('설정이나 JWT가 없으면 화면과 API를 거부한다', async () => {
    const assets = { fetch: vi.fn(async () => new Response('private')) };
    const root = await admin.fetch(new Request('https://admin.example.test/'), { ASSETS: assets });
    const api = await admin.fetch(new Request('https://admin.example.test/api/dashboard'), {
      ASSETS: assets,
    });
    expect(root.status).toBe(403);
    expect(api.status).toBe(403);
    expect(assets.fetch).not.toHaveBeenCalled();
  });

  it('서명·대상·이메일을 확인한다', async () => {
    const keys = await crypto.subtle.generateKey(
      {
        name: 'RSASSA-PKCS1-v1_5',
        modulusLength: 2048,
        publicExponent: new Uint8Array([1, 0, 1]),
        hash: 'SHA-256',
      },
      true,
      ['sign', 'verify'],
    );
    const jwk = await crypto.subtle.exportKey('jwk', keys.publicKey);
    const fetchFn = vi.fn(async () => Response.json({ keys: [{ ...jwk, kid: 'test-key' }] }));
    const token = async (email: string) => {
      const unsigned = `${encode({ alg: 'RS256', kid: 'test-key' })}.${encode({ iss: env.ACCESS_TEAM_DOMAIN, aud: [env.ACCESS_AUD], email, exp: Math.floor(Date.now() / 1000) + 60 })}`;
      const signature = new Uint8Array(
        await crypto.subtle.sign(
          'RSASSA-PKCS1-v1_5',
          keys.privateKey,
          new TextEncoder().encode(unsigned),
        ),
      );
      return `${unsigned}.${btoa(String.fromCharCode(...signature))
        .replace(/\+/g, '-')
        .replace(/\//g, '_')
        .replace(/=+$/, '')}`;
    };
    const allowed = new Request('https://admin.example.test/', {
      headers: { 'Cf-Access-Jwt-Assertion': await token('maestro@example.com') },
    });
    const denied = new Request('https://admin.example.test/', {
      headers: { 'Cf-Access-Jwt-Assertion': await token('other@example.com') },
    });
    expect(await verifyAccess(allowed, env, fetchFn)).toBe(true);
    expect(await verifyAccess(denied, env, fetchFn)).toBe(false);
  });
});
