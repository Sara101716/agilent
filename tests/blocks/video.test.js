import { jest } from '@jest/globals';
import decorate from '../../blocks/video/video.js';

/**
 * @jest-environment jsdom
 */

// Mock Video.js
const mockVideojs = jest.fn(() => ({
  ready: jest.fn((callback) => {
    if (callback) callback();
    return {
      on: jest.fn(),
    };
  }),
  on: jest.fn(),
  src: jest.fn(),
  play: jest.fn(),
  dispose: jest.fn(),
  addRemoteTextTrack: jest.fn((options) => ({
    track: {
      mode: 'hidden',
      kind: options.kind,
      src: options.src,
      srclang: options.srclang,
      label: options.label,
    },
  })),
  textTrackSettings: {
    show: jest.fn(),
  },
  controlBar: {
    captionsButton: {
      show: jest.fn(),
    },
    subtitlesButton: {
      show: jest.fn(),
    },
  },
}));

// Add getPlayer method to videojs
mockVideojs.getPlayer = jest.fn(() => ({
  ready: jest.fn((callback) => {
    if (callback) callback();
  }),
  on: jest.fn(),
}));

// Mock the Video.js library loading
global.window.videojs = mockVideojs;

// Mock IntersectionObserver
global.IntersectionObserver = jest.fn(() => ({
  observe: jest.fn(),
  unobserve: jest.fn(),
  disconnect: jest.fn(),
}));

// Helper to reset DOM between tests
function resetDOM() {
  document.body.innerHTML = '';
  document.head.innerHTML = '';
}

describe('Video Block', () => {
  beforeEach(() => {
    resetDOM();
    jest.clearAllMocks();
  });

  it('should create video block with MP4 source', async () => {
    const block = document.createElement('div');
    block.className = 'video';
    block.innerHTML = `
      <div>
        <div><a href="https://example.com/video.mp4">Test Video</a></div>
      </div>
    `;
    document.body.appendChild(block);

    await decorate(block);

    expect(block.querySelector('.video-block__wrapper')).not.toBeNull();
    expect(block.querySelector('.video-block__container')).not.toBeNull();
    expect(block.querySelector('video-js')).not.toBeNull();
    // Check that a source element was created
    expect(block.querySelector('source')).not.toBeNull();
  });

  it('should create video block with HLS source', async () => {
    const block = document.createElement('div');
    block.className = 'video';
    block.innerHTML = `
      <div>
        <div><a href="https://example.com/video.m3u8">HLS Video</a></div>
      </div>
    `;
    document.body.appendChild(block);

    await decorate(block);

    expect(block.querySelector('video-js')).not.toBeNull();
    const source = block.querySelector('source');
    expect(source).not.toBeNull();
    // Check that it's an HLS source (either by type or src)
    expect(source.src || source.type).toBeTruthy();
  });

  it('should parse configuration from block content', async () => {
    const block = document.createElement('div');
    block.className = 'video';
    block.innerHTML = `
      <div>
        <div><a href="https://example.com/video.mp4">Test Video</a></div>
      </div>
      <div>
        <div>autoplay</div>
        <div>true</div>
      </div>
      <div>
        <div>muted</div>
        <div>true</div>
      </div>
      <div>
        <div>controls</div>
        <div>true</div>
      </div>
    `;
    document.body.appendChild(block);

    await decorate(block);

    const videoElement = block.querySelector('video-js');
    expect(videoElement).not.toBeNull();
    // Check if properties are set correctly
    expect(videoElement.autoplay).toBe(true);
    expect(videoElement.muted).toBe(true);
    expect(videoElement.controls).toBe(true);
  });

  it('should add poster image if provided', async () => {
    const block = document.createElement('div');
    block.className = 'video';
    block.innerHTML = `
      <div>
        <div><img src="https://example.com/poster.jpg" alt="Poster"></div>
        <div><a href="https://example.com/video.mp4">Test Video</a></div>
      </div>
    `;
    document.body.appendChild(block);

    await decorate(block);

    // Check that poster overlay is created
    const posterOverlay = block.querySelector('.video-block__poster-overlay');
    expect(posterOverlay).not.toBeNull();

    const posterImage = block.querySelector('.video-block__poster-image');
    expect(posterImage).not.toBeNull();
    expect(posterImage.src).toBe('https://example.com/poster.jpg');

    const playButton = block.querySelector('.video-block__play-button');
    expect(playButton).not.toBeNull();

    const videoElement = block.querySelector('video-js');
    expect(videoElement).not.toBeNull();
  });

  it('should show error message if no video source provided', async () => {
    const block = document.createElement('div');
    block.className = 'video';
    block.innerHTML = `
      <div>
        <div>No video link here</div>
      </div>
    `;
    document.body.appendChild(block);

    await decorate(block);

    expect(block.querySelector('.video-block__error')).not.toBeNull();
    expect(block.textContent).toContain('No video source provided');
  });

  it('should handle different video formats', async () => {
    const formats = [
      { url: 'https://example.com/video.mp4', extension: '.mp4' },
      { url: 'https://example.com/video.webm', extension: '.webm' },
      { url: 'https://example.com/video.ogg', extension: '.ogg' },
      { url: 'https://example.com/video.m3u8', extension: '.m3u8' },
    ];
    // eslint-disable-next-line no-restricted-syntax
    for (const format of formats) {
      resetDOM();

      const block = document.createElement('div');
      block.className = 'video';
      block.innerHTML = `
        <div>
          <div><a href="${format.url}">Test Video</a></div>
        </div>
      `;
      document.body.appendChild(block);
      // eslint-disable-next-line no-await-in-loop
      await decorate(block);

      const source = block.querySelector('source');
      expect(source).not.toBeNull();
      // Just check that a source was created for each format
      expect(source.src || source.textContent).toBeTruthy();
    }
  });

  it('should add loading and ready classes', async () => {
    const block = document.createElement('div');
    block.className = 'video';
    block.innerHTML = `
      <div>
        <div><a href="https://example.com/video.mp4">Test Video</a></div>
      </div>
    `;
    document.body.appendChild(block);

    await decorate(block);

    // After decoration, should have ready class (since player.ready() is called
    // immediately in mock)
    expect(block.classList.contains('video-block--ready')).toBe(true);
  });

  it('should handle poster overlay click to play video', async () => {
    const block = document.createElement('div');
    block.className = 'video';
    block.innerHTML = `
      <div>
        <div><img src="https://example.com/poster.jpg" alt="Poster"></div>
        <div><a href="https://example.com/video.mp4">Test Video</a></div>
      </div>
    `;
    document.body.appendChild(block);

    await decorate(block);

    const posterOverlay = block.querySelector('.video-block__poster-overlay');
    const playButton = block.querySelector('.video-block__play-button');
    const videoElement = block.querySelector('video-js');

    expect(posterOverlay).not.toBeNull();
    expect(playButton).not.toBeNull();
    expect(videoElement).not.toBeNull();

    // Initially video should be hidden and poster visible
    expect(videoElement.style.opacity).toBe('0');
    expect(videoElement.style.pointerEvents).toBe('none');

    // Click the poster overlay
    posterOverlay.click();

    // After click, poster should start fading and video should become visible
    expect(posterOverlay.style.opacity).toBe('0');
    expect(posterOverlay.style.pointerEvents).toBe('none');
    expect(videoElement.style.opacity).toBe('1');
    expect(videoElement.style.pointerEvents).toBe('auto');
  });

  it('should parse custom dimensions from configuration', async () => {
    const block = document.createElement('div');
    block.className = 'video';
    block.innerHTML = `
      <div>
        <div><a href="https://example.com/video.mp4">Test Video</a></div>
      </div>
      <div>
        <div>width</div>
        <div>800px</div>
      </div>
      <div>
        <div>height</div>
        <div>450px</div>
      </div>
    `;
    document.body.appendChild(block);

    await decorate(block);

    const videoElement = block.querySelector('video-js');
    expect(videoElement.style.width).toBe('800px');
    expect(videoElement.style.height).toBe('450px');
  });

  it('should enable lazy loading when loadLazy is true', async () => {
    const block = document.createElement('div');
    block.className = 'video';
    block.innerHTML = `
      <div>
        <div><a href="https://example.com/video.mp4">Test Video</a></div>
      </div>
      <div>
        <div>loadLazy</div>
        <div>true</div>
      </div>
    `;
    document.body.appendChild(block);

    await decorate(block);

    // Should have lazy loading class
    expect(block.classList.contains('video-block--lazy')).toBe(true);

    // Should have lazy placeholder when no poster
    const lazyPlaceholder = block.querySelector('.video-block__lazy-placeholder');
    expect(lazyPlaceholder).not.toBeNull();

    const lazyIcon = block.querySelector('.video-block__lazy-icon');
    const lazyText = block.querySelector('.video-block__lazy-text');
    expect(lazyIcon).not.toBeNull();
    expect(lazyText).not.toBeNull();
  });

  it('should load immediately when loadLazy is false or not set', async () => {
    const block = document.createElement('div');
    block.className = 'video';
    block.innerHTML = `
      <div>
        <div><a href="https://example.com/video.mp4">Test Video</a></div>
      </div>
    `;
    document.body.appendChild(block);

    await decorate(block);

    // Should not have lazy loading class
    expect(block.classList.contains('video-block--lazy')).toBe(false);

    // Should have either loading or ready class (since tests run synchronously)
    expect(
      block.classList.contains('video-block--loading')
      || block.classList.contains('video-block--ready'),
    ).toBe(true);
  });
});
