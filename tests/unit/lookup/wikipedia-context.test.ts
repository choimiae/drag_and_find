import { describe, expect, it } from 'vitest';
import { fetchEnglishExtracts } from '../../../lib/lookup/wikipedia-context';

describe('fetchEnglishExtracts', () => {
  it('keeps the original Korean key after title normalization and redirect', async () => {
    const result = await fetchEnglishExtracts(['관리_개념'], 'DragAndFind/test', async (input) => {
      const url = new URL(input);
      if (url.hostname === 'ko.wikipedia.org') {
        return Response.json({
          query: {
            normalized: [{ from: '관리_개념', to: '관리 개념' }],
            redirects: [{ from: '관리 개념', to: '관리' }],
            pages: [{ ns: 0, title: '관리', langlinks: [{ lang: 'en', title: 'Administration' }] }],
          },
        });
      }
      return Response.json({
        query: { pages: [{ ns: 0, title: 'Administration', extract: 'Managing facilities' }] },
      });
    });

    expect(result).toEqual({ 관리_개념: 'Managing facilities' });
  });

  it('keeps the extract when the English article title is normalized and redirected', async () => {
    const result = await fetchEnglishExtracts(['관리'], 'DragAndFind/test', async (input) => {
      const url = new URL(input);
      if (url.hostname === 'ko.wikipedia.org') {
        return Response.json({
          query: {
            pages: [
              { ns: 0, title: '관리', langlinks: [{ lang: 'en', title: 'Administration_old' }] },
            ],
          },
        });
      }
      return Response.json({
        query: {
          normalized: [{ from: 'Administration_old', to: 'Administration old' }],
          redirects: [{ from: 'Administration old', to: 'Administration' }],
          pages: [{ ns: 0, title: 'Administration', extract: 'Managing facilities' }],
        },
      });
    });

    expect(result).toEqual({ 관리: 'Managing facilities' });
  });
});
