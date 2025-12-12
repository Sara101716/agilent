/**
 * @jest-environment-options {"url": "https://www.agilent.com/"}
 */
import { jest } from '@jest/globals';
import { getLinkFallback } from '../../scripts/aem.js';

describe('getLinkFallback', () => {
  beforeAll(() => {
    jest.spyOn(document, 'cookie', 'get').mockReturnValue('CountryCode=CA; agilent_locale=fr_CA');
    fetch.mockResponse((req) => (req.url === '/query-index.json'
      ? Promise.resolve(JSON.stringify({ data: [{ path: '/fr-ca/' }, { path: '/fr/' }, { path: '/fr/search' }, { path: '/en/en-only' }] }))
      : Promise.reject(new Error('unexpected request'))));
  });

  test.each([
    { name: 'existing', link: '/fr-ca', expectedResult: false },
    { name: 'existing but no exact locale match', link: '/fr/search', expectedResult: false },
    { name: 'global language fallback', link: '/fr-ca/search', expectedResult: { originalUrl: new URL('https://www.agilent.com/fr-ca/search'), link: '/fr/search', rewrite: true } },
    { name: 'en global fallback', link: '/fr-ca/en-only', expectedResult: { originalUrl: new URL('https://www.agilent.com/fr-ca/en-only'), link: '/en/en-only', rewrite: true } },
    { name: '404', link: '/fr-ca/does-not-exist', expectedResult: { link: '/fr-ca/does-not-exist', rewrite: false, notFound: true } },
    { name: 'outside locale', link: '/outside/locale', expectedResult: false },
    { name: 'remove trailing slash', link: '/fr-ca/', expectedResult: { originalUrl: new URL('https://www.agilent.com/fr-ca/'), link: '/fr-ca', rewrite: true } },
    { name: 'different domain', link: 'https://different.domain/', expectedResult: { link: 'https://different.domain/', rewrite: false } },
    { name: 'different domain with path', link: 'https://other.org/fr', expectedResult: false },
    { name: 'ignored filename with extension', link: '/fr.ignored', expectedResult: false },
    { name: 'do not ignore .plain.html', link: '/en/search.plain.html', expectedResult: { originalUrl: new URL('https://www.agilent.com/en/search.plain.html'), link: '/fr/search.plain.html', rewrite: true } },
    { name: 'does not exist but has fallback', link: '/xx', expectedResult: { originalUrl: new URL('https://www.agilent.com/xx'), link: '/fr-ca', rewrite: true } },
  ])('$name', async ({ link, expectedResult }) => {
    const result = await getLinkFallback(link);
    // console.log('result', result);
    expect(result.rewrite).toBe(!!expectedResult?.rewrite);
    expect(result.link).toBe(expectedResult ? expectedResult.link : link);
    expect(result.notFound).toBe(expectedResult?.notFound);
    expect(result.originalUrl?.toString()).toBe(expectedResult?.originalUrl?.toString());
  });
});
