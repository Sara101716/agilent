// eslint-disable-next-line import/no-extraneous-dependencies
import {
  expect, jest, describe, it, beforeEach,
} from '@jest/globals';

// Mock the dependencies before importing
const mockGetMetadata = jest.fn();
const mockGetPath = jest.fn();
const mockLoadFragment = jest.fn();

jest.unstable_mockModule('../../../scripts/aem.js', () => ({
  getMetadata: mockGetMetadata,
  getPath: mockGetPath,
}));

jest.unstable_mockModule('../../../blocks/fragment/fragment.js', () => ({
  loadFragment: mockLoadFragment,
}));

// Import the module under test after mocking
const { default: decorate } = await import('../../../blocks/footer/footer.js');

describe('Footer Block', () => {
  let mockBlock;
  let mockFooterContent;
  let mockFooterWrapper;

  beforeEach(() => {
    // Reset mocks
    jest.clearAllMocks();

    // Create mock footer wrapper (parent element)
    mockFooterWrapper = document.createElement('div');
    mockFooterWrapper.className = 'footer-wrapper';

    // Create mock block element
    mockBlock = document.createElement('div');
    mockBlock.innerHTML = '<div></div>';
    mockFooterWrapper.appendChild(mockBlock);

    // Create mock footer content structure that matches expected selectors
    mockFooterContent = document.createElement('div');
    mockFooterContent.innerHTML = `
      <div class="columns-wrapper">
        <div class="columns">
          <div>
            <h4>Quick Links</h4>
            <ul><li><a href="/products">Products</a></li></ul>
          </div>
        </div>
      </div>
      <div class="default-content-wrapper">
        <ul>
          <li>
            <p>Headquarters | <a href="/en/other-site">Other sites</a></p>
            <p>Baker Street.</p>
            <p>City, State 00700</p>
            <p>United States</p>
          </li>
          <li>
            <p><a href="/page">Worldwide Emails</a></p>
          </li>
          <li>
            <p><a href="/page">Worldwide Numbers</a></p>
          </li>
        </ul>
      </div>
    `;

    // Mock loadFragment to return the mock content
    mockLoadFragment.mockResolvedValue(mockFooterContent);
    mockGetMetadata.mockReturnValue(null);
    mockGetPath.mockResolvedValue('/shared/footer');
  });

  it('should add footer class to main block', async () => {
    await decorate(mockBlock);
    expect(mockBlock.classList.contains('footer')).toBe(true);
  });

  it('should add footer__links class to columns-wrapper element', async () => {
    await decorate(mockBlock);
    const linksElement = mockBlock.querySelector('.footer__links');
    expect(linksElement).toBeTruthy();
    expect(linksElement.classList.contains('columns-wrapper')).toBe(true);
  });

  it('should add footer__info class to default-content-wrapper element', async () => {
    await decorate(mockBlock);
    const infoElement = mockBlock.querySelector('.footer__info');
    expect(infoElement).toBeTruthy();
    expect(infoElement.classList.contains('default-content-wrapper')).toBe(true);
  });

  it('should create address element with footer__address class', async () => {
    await decorate(mockBlock);
    const addressElement = mockBlock.querySelector('.footer__address');
    expect(addressElement).toBeTruthy();
    expect(addressElement.tagName).toBe('ADDRESS');
  });

  it('should add footer__email class to email', async () => {
    await decorate(mockBlock);
    const emailElement = mockBlock.querySelector('.footer__email');
    expect(emailElement).toBeTruthy();
    expect(emailElement.tagName).toBe('DIV');
  });

  it('should add footer__phone class to phone', async () => {
    await decorate(mockBlock);
    const phoneElement = mockBlock.querySelector('.footer__phone');
    expect(phoneElement).toBeTruthy();
    expect(phoneElement.tagName).toBe('DIV');
  });

  it('should create and position social bar when footer has 3 children', async () => {
    const footerContentWithSocialBar = document.createElement('div');
    footerContentWithSocialBar.innerHTML = `
      <div class="social-bar">
        <ul>
          <li><a href="https://facebook.com">Facebook</a></li>
          <li><a href="https://twitter.com">Twitter</a></li>
        </ul>
      </div>
      <div class="columns-wrapper">
        <div class="columns">
          <div>
            <h4>Quick Links</h4>
            <ul><li><a href="/products">Products</a></li></ul>
          </div>
        </div>
      </div>
      <div class="default-content-wrapper">
        <p>Company Name</p>
        <p>123 Main Street</p>
        <p>City, State 12345</p>
        <p>email@company.com</p>
        <p>+1-555-123-4567</p>
      </div>
    `;
    mockLoadFragment.mockResolvedValue(footerContentWithSocialBar);
    await decorate(mockBlock);

    const socialBarElement = mockFooterWrapper.querySelector('.footer__social-bar');
    expect(socialBarElement).toBeTruthy();
    expect(socialBarElement.classList.contains('footer__social-bar')).toBe(true);
    expect(socialBarElement.nextElementSibling).toBe(mockBlock);
  });
});
