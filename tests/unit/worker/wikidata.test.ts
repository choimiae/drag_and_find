import { describe, expect, it } from 'vitest';
import { createWikidataProvider } from '../../../worker/wikidata';

describe('createWikidataProvider', () => {
  it('keeps distinct original URLs for entities with the same Korean label', async () => {
    const provider = createWikidataProvider(
      'DragAndFind/test',
      { lookup: async () => ({ status: 'not_found' }) },
      async (input) => {
        const action = new URL(input).searchParams.get('action');
        if (action === 'wbsearchentities') {
          return Response.json({
            search: [
              { id: 'Q101', match: { text: 'POC' } },
              { id: 'Q202', match: { text: 'POC' } },
            ],
          });
        }
        return Response.json({
          entities: {
            Q101: {
              labels: { ko: { value: 'POC' } },
              descriptions: { ko: { value: '제품 아이디어를 검증하는 개념 증명' } },
            },
            Q202: {
              labels: { ko: { value: 'POC' } },
              descriptions: { ko: { value: '다른 분야의 약어' } },
            },
          },
        });
      },
    );

    const result = await provider.lookup('POC');
    expect(result.status).toBe('found');
    if (result.status !== 'found') return;
    expect(result.disambiguation?.meanings).toEqual([
      {
        label: 'POC',
        description: '제품 아이디어를 검증하는 개념 증명',
        title: null,
        sourceUrl: 'https://www.wikidata.org/wiki/Q101',
      },
      {
        label: 'POC',
        description: '다른 분야의 약어',
        title: null,
        sourceUrl: 'https://www.wikidata.org/wiki/Q202',
      },
    ]);
  });
});
