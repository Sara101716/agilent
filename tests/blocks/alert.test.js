/* eslint-disable import/first */
/**
 * @jest-environment jsdom
 */
import { jest } from '@jest/globals';

jest.mock('../../scripts/aem.js', () => ({
  decorateIcon: jest.fn(),
}));

import decorate from '../../blocks/alert/alert.js';

describe('alert block click navigation', () => {
  let block;
  const sessionKey = 'alert-session1';
  let originalLocation;

  beforeAll(() => {
    // Save original location
    originalLocation = window.location;
    // Mock window.location
    delete window.location;
  });

  afterAll(() => {
    // Restore original location
    window.location = originalLocation;
  });

  beforeEach(() => {
    jest.useFakeTimers();
    sessionStorage.clear();
    block = document.createElement('div');
    block.classList.add('alert', 'banner-index-session1');
    document.body.appendChild(block);
  });
  afterEach(() => {
    document.body.innerHTML = '';
    jest.clearAllTimers();
    jest.clearAllMocks();
    window.location.href = '';
  });

  it('should remove parent element if session key is present and set to false', () => {
    sessionStorage.setItem(sessionKey, 'false');
    const parent = document.createElement('div');
    parent.appendChild(block);
    document.body.appendChild(parent);
    decorate(block);
    expect(document.body.contains(parent)).toBe(false);
  });
});
