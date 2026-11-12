/** 공개 경로의 요청 본문을 바이트 한도까지만 읽는다. */
export async function readLimitedBody(request: Request, maxBytes: number): Promise<string> {
  const contentLength = request.headers.get('Content-Length');
  if (contentLength && Number(contentLength) > maxBytes) throw new Error('body too large');
  if (!request.body) return '';

  const reader = request.body.getReader();
  const chunks: Uint8Array[] = [];
  let size = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > maxBytes) {
        await reader.cancel();
        throw new Error('body too large');
      }
      chunks.push(value);
    }
  } finally {
    reader.releaseLock();
  }

  const bytes = new Uint8Array(size);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return new TextDecoder().decode(bytes);
}
