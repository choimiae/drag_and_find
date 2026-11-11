import { webcrypto } from 'node:crypto';

export async function serviceAccountJson(): Promise<string> {
  const pair = await webcrypto.subtle.generateKey(
    {
      name: 'RSASSA-PKCS1-v1_5',
      modulusLength: 2048,
      publicExponent: new Uint8Array([1, 0, 1]),
      hash: 'SHA-256',
    },
    true,
    ['sign', 'verify'],
  );
  const key = await webcrypto.subtle.exportKey('pkcs8', pair.privateKey);
  const base64 = Buffer.from(key)
    .toString('base64')
    .match(/.{1,64}/g)
    ?.join('\n');
  return JSON.stringify({
    client_email: 'reports@example.iam.gserviceaccount.com',
    private_key: `-----BEGIN PRIVATE KEY-----\n${base64}\n-----END PRIVATE KEY-----\n`,
  });
}
