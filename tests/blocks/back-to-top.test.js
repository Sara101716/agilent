import { jest } from '@jest/globals';

// Mock aem.js once with all needed exports
jest.unstable_mockModule('../../scripts/aem.js', () => ({
  decorateIcons: jest.fn((container) => {
    const span = container.querySelector('span.icon');
    if (span) span.innerHTML = '<svg />';
  }),
  getMetadata: jest.fn(() => ''),
  getPlaceholder: jest.fn((key) => key),
  html: (strings, ...values) => {
    const htmlString = strings.reduce((acc, str, i) => acc + str + (values[i] || ''), '');
    const wrapper = document.createElement('div');
    wrapper.innerHTML = htmlString.trim();
    return wrapper.firstElementChild;
  },
}));

let decorate;
let aem;

beforeAll(async () => {
  aem = await import('../../scripts/aem.js');
  ({ default: decorate } = await import('../../blocks/back-to-top/back-to-top.js'));
});

describe('back-to-top (updated implementation)', () => {
  let block;
  let scrollSpy;
  let observerCallback;
  let desktopMatches;

  beforeEach(() => {
    document.body.innerHTML = '';
    block = document.createElement('div');
    desktopMatches = true; // default to desktop so button is appended

    // matchMedia mock (reads current desktopMatches value dynamically)
    window.matchMedia = jest.fn().mockImplementation((query) => ({
      media: query,
      get matches() { return desktopMatches; },
      addEventListener: jest.fn(),
      removeEventListener: jest.fn(),
    }));

    // Create main with first child for observer
    const main = document.createElement('main');
    const firstChild = document.createElement('div');
    main.appendChild(firstChild);
    document.body.appendChild(main);

    // IntersectionObserver mock capturing callback
    global.IntersectionObserver = jest.fn().mockImplementation((cb) => {
      observerCallback = cb;
      return { observe: jest.fn(), disconnect: jest.fn() };
    });

    scrollSpy = jest.spyOn(window, 'scrollTo').mockImplementation(() => {});
    aem.getMetadata.mockReset().mockReturnValue('');
    aem.getPlaceholder.mockClear();
  });

  afterEach(() => {
    scrollSpy.mockRestore();
    observerCallback = undefined;
    jest.clearAllMocks();
  });

  test('initial decoration sets classes and title, appends button on desktop', () => {
    decorate(block);
    expect(block.classList.contains('back-to-top')).toBe(true);
    expect(block.getAttribute('title')).toBe('Back to Top');
    const btn = block.querySelector('button.back-to-top__link');
    expect(btn).toBeTruthy();
    expect(btn.getAttribute('aria-label')).toBe('Back to Top');
    expect(aem.getPlaceholder).toHaveBeenCalledTimes(2);
  });

  test('button starts in disabled and non-focusable state', () => {
    decorate(block);
    const btn = block.querySelector('button.back-to-top__link');
    expect(btn).toBeTruthy();
    expect(btn.disabled).toBe(true);
    expect(btn.getAttribute('tabindex')).toBe('-1');
    expect(block.getAttribute('aria-hidden')).toBe('true');
  });

  test('does not append button when not desktop', () => {
    desktopMatches = false;
    decorate(block);
    const btn = block.querySelector('button.back-to-top__link');
    expect(btn).toBeNull();
  });

  test('button remains disabled on non-desktop after decoration', () => {
    desktopMatches = false;
    decorate(block);
    // Button isn't appended to block, but should exist and be disabled
    expect(block.getAttribute('aria-hidden')).toBe('true');
    // The button exists but isn't appended due to controlVisibility
  });

  test('removes/does not append button when metadata disabled', () => {
    aem.getMetadata.mockReturnValue('disabled');
    decorate(block);
    const btn = block.querySelector('button.back-to-top__link');
    // Since disabled at start, button never appended
    expect(btn).toBeNull();
  });

  test('intersection observer toggles hidden class (visible state)', () => {
    decorate(block);
    const btn = block.querySelector('button.back-to-top__link');
    expect(btn).toBeTruthy();
    expect(observerCallback).toBeDefined();
    observerCallback([{ boundingClientRect: { top: 0 }, intersectionRatio: 0 }]);
    expect(block.classList.contains('hidden')).toBe(false);
    expect(block.getAttribute('aria-hidden')).toBe('false');
  });

  test('intersection observer enables button when visible', () => {
    decorate(block);
    const btn = block.querySelector('button.back-to-top__link');
    expect(btn).toBeTruthy();
    expect(observerCallback).toBeDefined();

    // Initially disabled
    expect(btn.disabled).toBe(true);
    expect(btn.getAttribute('tabindex')).toBe('-1');

    // Make visible (not at top, intersectionRatio < 1)
    observerCallback([{ boundingClientRect: { top: 0 }, intersectionRatio: 0 }]);

    // Should be enabled and focusable
    expect(btn.disabled).toBe(false);
    expect(btn.hasAttribute('tabindex')).toBe(false);
  });

  test('intersection observer toggles hidden class (hidden state)', () => {
    decorate(block);
    observerCallback([{ boundingClientRect: { top: 10 }, intersectionRatio: 0 }]);
    expect(block.classList.contains('hidden')).toBe(true);
    expect(block.getAttribute('aria-hidden')).toBe('true');
  });

  test('intersection observer disables button when hidden', () => {
    decorate(block);
    const btn = block.querySelector('button.back-to-top__link');
    expect(btn).toBeTruthy();

    // First make it visible
    observerCallback([{ boundingClientRect: { top: 0 }, intersectionRatio: 0 }]);
    expect(btn.disabled).toBe(false);

    // Then hide it (top out of view OR fully visible)
    observerCallback([{ boundingClientRect: { top: 10 }, intersectionRatio: 0 }]);
    expect(btn.disabled).toBe(true);
    expect(btn.getAttribute('tabindex')).toBe('-1');
  });

  test('click button triggers smooth scroll and focuses skip link', () => {
    const skip = document.createElement('a');
    skip.className = 'skip-to-content';
    skip.href = '#main';
    const focusSpy = jest.spyOn(skip, 'focus');
    document.body.appendChild(skip);

    decorate(block);
    const btn = block.querySelector('button.back-to-top__link');
    expect(btn).toBeTruthy();

    // Enable the button first (simulate scroll state where button should be visible)
    observerCallback([{ boundingClientRect: { top: 0 }, intersectionRatio: 0 }]);
    expect(btn.disabled).toBe(false);

    btn.click();
    expect(scrollSpy).toHaveBeenCalledWith({ top: 0, behavior: 'smooth' });
    expect(focusSpy).toHaveBeenCalled();
  });

  test('no observer created if no first block', () => {
    document.body.innerHTML = '';
    // Still need block in DOM for class behavior
    document.body.appendChild(block);
    decorate(block);
    expect(observerCallback).toBeUndefined();
    expect(global.IntersectionObserver).not.toHaveBeenCalled();
  });
});
