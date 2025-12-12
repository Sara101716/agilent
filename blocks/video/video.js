import { decorateIcons, getPlaceholder, loadEnvConfig } from '../../scripts/aem.js';

/**
 * Loads Video.js library and CSS
 */
async function loadVideoJS() {
  // Load Video.js CSS
  const link = document.createElement('link');
  link.rel = 'stylesheet';
  link.href = '/scripts/videojs/videojs.css';
  document.head.appendChild(link);

  // Load Video.js JavaScript
  if (!window.videojs) {
    const script = document.createElement('script');
    script.src = '/scripts/videojs/video.min.js';
    script.async = true;

    return new Promise((resolve, reject) => {
      script.onload = () => resolve(window.videojs);
      script.onerror = reject;
      document.head.appendChild(script);
    });
  }

  return window.videojs;
}

/**
 * Creates video element with Video.js player
 * @param {Object} config - Video configuration
 * @returns {HTMLElement} - Video element
 */
function createVideoPlayer(config) {
  const {
    src,
    poster,
    autoplay = false,
    muted = false,
    controls = true,
    loop = false,
    width = '100%',
    height = 'auto',
    playsinline = true,
    transcripts = [],
  } = config;
  const videoId = `video-${Math.random().toString(36).substr(2, 9)}`;

  const videoElement = document.createElement('video-js');
  videoElement.id = videoId;
  videoElement.className = 'vjs-default-skin video-block__player';
  videoElement.setAttribute('data-setup', '{}');

  // Set video attributes
  if (controls) videoElement.controls = true;
  if (autoplay) videoElement.autoplay = true;
  if (muted) videoElement.muted = true;
  if (loop) videoElement.loop = true;
  if (playsinline) videoElement.setAttribute('playsinline', '');
  if (poster) videoElement.poster = poster;

  videoElement.style.width = width;
  videoElement.style.height = height;

  // Add source element
  if (src) {
    const source = document.createElement('source');
    source.src = src;

    // Determine type based on file extension
    if (src.includes('.m3u8')) {
      source.type = 'application/x-mpegURL';
    } else if (src.includes('.mp4')) {
      source.type = 'video/mp4';
    } else if (src.includes('.webm')) {
      source.type = 'video/webm';
    } else if (src.includes('.ogg')) {
      source.type = 'video/ogg';
    }

    videoElement.appendChild(source);
  }

  function extractIsoCodeFromUrl(url) {
    const match = url.match(/-([a-z]{2})\.vtt$/i);
    return match ? match[1] : 'en';
  }

  async function fetchLanguageMap(transcriptList) {
    try {
      const data = await loadEnvConfig();
      const isoToLanguageMap = typeof data.lang === 'object' ? data.lang : {};

      return transcriptList
        ?.map((transcript, index) => {
          if (!transcript || !transcript.src) return null;
          const isoCode = extractIsoCodeFromUrl(transcript.src);
          const label = isoToLanguageMap[isoCode] || isoCode;
          return {
            ...transcript,
            srclang: isoCode,
            label,
            default: index === 0,
          };
        })
        .filter(Boolean);
    } catch (error) {
      // eslint-disable-next-line no-console
      console.error('Error fetching language map:', error);
      return [];
    }
  }

  function addTracksToVideo(videoElem, transcriptList) {
    transcriptList.forEach((transcript, index) => {
      if (transcript) {
        const track = document.createElement('track');
        track.kind = 'subtitles';
        track.src = transcript.src;
        track.srclang = transcript.srclang || 'en';
        track.label = transcript.label || transcript.title || 'English';
        if (index === 0) {
          track.default = true;
        }
        videoElem.appendChild(track);
      }
    });
  }

  if (transcripts && transcripts.length > 0) {
    fetchLanguageMap(transcripts).then((mappedTranscripts) => {
      addTracksToVideo(videoElement, mappedTranscripts);
    });
  }

  return { videoElement, videoId };
}

/**
 * Sets up lazy loading for video using Intersection Observer
 * @param {HTMLElement} block - Video block element
 * @param {Object} config - Video configuration
 * @param {Function} initializeCallback - Function to call when video enters viewport
 */
function setupLazyLoading(block, config, initializeCallback) {
  // Create placeholder if poster is not available
  if (!config.poster) {
    const placeholder = document.createElement('div');
    placeholder.className = 'video-block__lazy-placeholder';
    placeholder.innerHTML = `
      <div class="video-block__lazy-content">
        <div class="video-block__lazy-icon">▶</div>
        <div class="video-block__lazy-text">${
  config.title || 'Click to load video'
}</div>
      </div>
    `;

    const container = block.querySelector('.video-block__container');
    container.appendChild(placeholder);
  }

  // Set up Intersection Observer
  const observer = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          // Video is in viewport, initialize it
          initializeCallback();
          observer.unobserve(entry.target);
        }
      });
    },
    {
      root: null,
      rootMargin: '50px', // Start loading 50px before entering viewport
      threshold: 0.1, // Trigger when 10% of video is visible
    },
  );

  observer.observe(block);

  return observer;
}

/**
 * Initializes Video.js player with options and handles poster overlay
 * @param {string} videoId - Video element ID
 * @param {Object} options - Video.js options
 * @param {HTMLElement} posterOverlay - Poster overlay element
 */
async function initializePlayer(videoId, options = {}, posterOverlay = null) {
  const videojs = await loadVideoJS();

  const defaultOptions = {
    responsive: true,
    fluid: true,
    playbackRates: [0.5, 1, 1.25, 1.5, 2],
    controls: true,
    preload: 'metadata',
    // Configure text track settings but don't auto-open
    textTrackSettings: false,
    ...options,
  };

  // Initialize Video.js player
  const player = videojs(videoId, defaultOptions);

  // Prevent automatic text track settings modal from opening
  player.ready(() => {
    // Ensure text track settings modal is closed initially
    if (player.textTrackSettings && player.textTrackSettings.dialog) {
      player.textTrackSettings.dialog.close();
    }

    // Override any automatic opening of text track settings
    const originalShow = player.textTrackSettings?.show;
    if (originalShow) {
      let manuallyOpened = false;
      player.textTrackSettings.show = () => {
        // Only show if user manually triggered it
        if (manuallyOpened) {
          return originalShow.call(this);
        }
        return undefined;
      };

      // Allow manual opening when user clicks the button
      const textTrackButton = player.controlBar?.textTrackButton;
      if (textTrackButton) {
        textTrackButton.on('click', () => {
          manuallyOpened = true;
          setTimeout(() => {
            manuallyOpened = false;
          }, 100);
        });
      }
    }
  });

  // Hide video player initially if poster overlay exists
  if (posterOverlay) {
    const videoElement = document.getElementById(videoId);
    if (videoElement) {
      videoElement.style.opacity = '0';
      videoElement.style.pointerEvents = 'none';
    }

    // Handle poster overlay click
    const playButton = posterOverlay.querySelector('.video-block__play-button');
    const handlePlay = () => {
      posterOverlay.style.opacity = '0';
      posterOverlay.style.pointerEvents = 'none';
      if (videoElement) {
        videoElement.style.opacity = '1';
        videoElement.style.pointerEvents = 'auto';
      }
      player.play();
    };

    posterOverlay.addEventListener('click', handlePlay);
    if (playButton) {
      playButton.addEventListener('click', handlePlay);
    }

    // Show video when it's ready to play
    player.ready(() => {
      player.on('canplaythrough', () => {
        // Video is fully loaded and ready
        if (!options.autoplay) {
          // Keep poster visible for manual play
          return;
        }
        // For autoplay videos, hide poster when ready
        handlePlay();
      });

      player.on('play', () => {
        posterOverlay.style.opacity = '0';
        posterOverlay.style.pointerEvents = 'none';
        if (videoElement) {
          videoElement.style.opacity = '1';
          videoElement.style.pointerEvents = 'auto';
        }
      });
    });
  }

  if (options.src && options.src.includes('.m3u8')) {
    player.ready(() => {
      player.src({
        src: options.src,
        type: 'application/x-mpegURL',
      });
    });
  }

  return player;
}

/**
 * Parses video configuration from block content
 * @param {Element} block - Video block element
 * @returns {Object} - Video configuration
 */
function parseVideoConfig(block) {
  const config = {};
  // Look for video source in various formats
  const videoLink = block.querySelector(
    'a[href*=".mp4"], a[href*=".m3u8"], a[href*=".webm"], a[href*=".ogg"]',
  );

  if (!videoLink) {
    const videoTag = block.querySelector(
      'video source[src*=".mp4"], video[src*=".mp4"]',
    );
    if (videoTag) {
      config.src = videoTag.src || videoTag.getAttribute('src');
      config.title = videoTag.title || videoTag.getAttribute('title') || 'MP4 Video';
    }
  } else {
    config.src = videoLink.textContent.trim();
    config.title = videoLink.title.trim();
  }

  // Look for poster image
  const posterImg = block.querySelector('picture img, img');
  if (posterImg) {
    config.poster = posterImg.src || posterImg.dataset.src;
  }

  // Parse configuration from data attributes or text content
  const rows = [...block.querySelectorAll(':scope > div')];
  rows.forEach((row) => {
    const cells = [...row.querySelectorAll('div')];
    if (cells.length >= 2) {
      const key = cells[0].textContent.trim().toLowerCase();
      const value = cells[1].textContent.trim();
      switch (key) {
        case 'autoplay':
          config.autoplay = value.toLowerCase() === 'true';
          break;
        case 'muted':
          config.muted = value.toLowerCase() === 'true';
          break;
        case 'loop':
          config.loop = value.toLowerCase() === 'true';
          break;
        case 'controls':
          config.controls = value.toLowerCase() !== 'false';
          break;
        case 'loadlazy':
        case 'load-lazy':
          config.loadLazy = value.toLowerCase() === 'true';
          break;
        case 'width':
          config.width = value;
          break;
        case 'height':
          config.height = value;
          break;
        case 'poster':
          if (!config.poster) config.poster = value;
          break;
        case 'src':
        case 'source':
          if (!config.src) config.src = value;
          break;
        case 'closed captions':
          // eslint-disable-next-line no-case-declarations
          const anchors = Array.from(cells[1].querySelectorAll('a'));

          config.transcripts = anchors.map((anchor) => ({
            title: anchor.title || anchor.textContent.trim(),
            src: anchor.innerText,
          }));

          break;
        default:
          break;
      }
    }
  });

  return config;
}

/**
 * Creates poster overlay that shows while video loads
 * @param {Object} config - Video configuration
 * @returns {HTMLElement} - Poster overlay element
 */
function createPosterOverlay(config) {
  if (!config.poster) return null;

  const overlay = document.createElement('div');
  overlay.className = 'video-block__poster-overlay';

  const img = document.createElement('img');
  img.src = config.poster;
  img.alt = config.title || 'Video poster';
  img.className = 'video-block__poster-image';

  const playButton = document.createElement('button');
  playButton.className = 'video-block__play-button';
  playButton.innerHTML = '▶';
  playButton.setAttribute('aria-label', getPlaceholder('Play video'));

  overlay.appendChild(img);
  overlay.appendChild(playButton);

  return overlay;
}

/**
 * Creates video block wrapper with optional controls
 * @param {Object} config - Video configuration
 * @returns {HTMLElement} - Video block wrapper
 */
function createVideoBlock(config) {
  const wrapper = document.createElement('div');
  wrapper.className = 'video-block__wrapper';

  // Create video container
  const container = document.createElement('div');
  container.className = 'video-block__container';

  // Add poster overlay if poster is configured
  const posterOverlay = createPosterOverlay(config);
  if (posterOverlay) {
    container.appendChild(posterOverlay);
    container.classList.add('video-block__container--with-poster');
  }

  const { videoElement, videoId } = createVideoPlayer(config);
  container.appendChild(videoElement);
  wrapper.appendChild(container);

  return { wrapper, videoId, posterOverlay };
}

/**
 * Decorates the video block
 * @param {Element} block - Video block element
 */
export default async function decorate(block, options = null) {
  try {
    // Parse video configuration
    const config = options || parseVideoConfig(block);
    if (!config.src) {
      // eslint-disable-next-line no-console
      console.warn('Video block: No video source found');
      block.innerHTML = `<p class="video-block__error">${getPlaceholder(
        'No video source provided',
      )}</p>`;
      return;
    }

    // Create video block
    const { wrapper, videoId, posterOverlay } = createVideoBlock(config);

    // Replace block content
    block.innerHTML = '';
    block.appendChild(wrapper);

    if (options && options.style) {
      block.classList.add('video');
      block.classList.add(options.style);
    }

    // Handle lazy loading or immediate initialization
    if (config.loadLazy) {
      // Set up lazy loading
      block.classList.add('video-block--lazy');

      const initializeVideo = async () => {
        block.classList.remove('video-block--lazy');
        block.classList.add('video-block--loading');

        // Initialize Video.js player with poster overlay handling
        await initializePlayer(
          videoId,
          {
            src: config.src,
            autoplay: config.autoplay,
            muted: config.muted,
            loop: config.loop,
            controls: config.controls,
            transcripts: config.transcripts,
          },
          posterOverlay,
        );

        // Remove loading class when player is ready
        const player = window.videojs.getPlayer(videoId);
        if (player) {
          player.ready(() => {
            block.classList.remove('video-block--loading');
            block.classList.add('video-block--ready');
          });
        }
      };

      setupLazyLoading(block, config, initializeVideo);
    } else {
      // Initialize immediately
      block.classList.add('video-block--loading');

      // Initialize Video.js player with poster overlay handling
      await initializePlayer(
        videoId,
        {
          src: config.src,
          autoplay: config.autoplay,
          muted: config.muted,
          loop: config.loop,
          controls: config.controls,
          transcripts: config.transcripts,
        },
        posterOverlay,
      );

      // Remove loading class when player is ready
      const player = window.videojs.getPlayer(videoId);
      if (player) {
        player.ready(() => {
          block.classList.remove('video-block--loading');
          block.classList.add('video-block--ready');
        });
      }
    }
  } catch (error) {
    // eslint-disable-next-line no-console
    console.error('Error decorating video block:', error);
    block.innerHTML = `<p class="video-block__error">${getPlaceholder(
      'Error loading video player',
    )}</p>`;
  }

  // Decorate any icons in the block
  decorateIcons(block);
}
