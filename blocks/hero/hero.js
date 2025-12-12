import {
  decorateIcons,
  html,
  getPlaceholder,
  readBlockConfig,
  forceCssReflow,
  decorateResponsiveMedia,
  toCamelCase,
  setBlockToFullViewportWidth,
} from '../../scripts/aem.js';

const getMediaElement = (parentEl) => parentEl.querySelector('.responsive-media, video, picture');

/**
 * Replaces the parent element with its children.
 * This function is useful when you want to flatten the DOM structure
 * by removing the parent element and keeping its children.
 * @param {HTMLElement} element - The element whose parent will be replaced with its children
 * @example
 * replaceParentWithChildrens(document.querySelector('.my-element'));
 */
export const replaceParentWithChildrens = (element) => {
  if (!element || !element.parentElement) {
    return;
  }

  const parent = element.parentElement;

  parent.replaceWith(...parent.children);
};

export const hasOnlyLinksAsChild = (element) => {
  // Filter out text nodes with only whitespace
  const nonWhitespaceNodes = Array.from(element.childNodes).filter((node) => node.nodeType === 1 || (node.nodeType === 3 && node.nodeValue.trim() !== ''));

  return nonWhitespaceNodes.every((el) => el.nodeType === 1 && el.tagName === 'A');
};

const getSlideConfig = (block) => {
  const rows = block.querySelectorAll(':scope > div');

  rows.forEach((row, index) => {
    const [name, value] = row.querySelectorAll(':scope > div');

    if (name.textContent === 'style') {
      const cell = rows[index - 1].querySelector(':scope > div');
      const classNames = value.textContent
        .trim()
        .split(',')
        .map((el) => el.trim().replace(/\s+/g, '-'));
      cell.classList.add(...classNames);
      row.remove();
    }
  });
};

const addChangeSlideOnSwipe = (slideContainer, changeSlide) => {
  let touchStartX = 0;
  let touchEndX = 0;

  const handleSwipe = () => {
    const swipeThreshold = 50; // Minimum distance for a swipe to be recognized
    const swipeDistance = touchEndX - touchStartX;

    if (swipeDistance > swipeThreshold) {
      changeSlide(-1);
    } else if (swipeDistance < -swipeThreshold) {
      changeSlide(1);
    }
  };

  slideContainer.addEventListener('touchstart', (event) => {
    touchStartX = event.touches[0].clientX;
  }, { passive: true });

  slideContainer.addEventListener('touchend', (event) => {
    touchEndX = event.changedTouches[0].clientX;
    handleSwipe();
  });
};

const decorateButtons = (buttons) => {
  buttons.forEach((button) => {
    button.classList.remove('agt-link');

    if (!button.classList.contains('agt-button--primary')) {
      button.classList.add('agt-button--ghost-dark');
    }

    if (button.closest('.hero__slide.dark')) {
      if (button.classList.contains('agt-button--primary')) {
        button.classList.remove('agt-button--primary');
        button.classList.add('agt-button--secondary');
      } else {
        button.classList.remove('agt-button--ghost-dark');
        button.classList.add('agt-button--ghost-light');
      }
    }
  });
};

const createSlide = (slideContent) => {
  const mediaEl = getMediaElement(slideContent);
  const headings = slideContent.querySelectorAll('h1, h2, h3, h4, h5, h6');
  const allLinks = slideContent.querySelectorAll('a');
  const buttons = [];
  const textParagraphs = slideContent.querySelectorAll('p');

  replaceParentWithChildrens(mediaEl);

  allLinks.forEach((link) => {
    const hasLinksOnly = hasOnlyLinksAsChild(link.parentElement);

    if (hasLinksOnly) {
      link.closest('p').replaceWith(...link.parentElement.children);
      buttons.push(link);
    }
  });

  [...headings, ...textParagraphs].forEach((textEl) => {
    const wrapper = html`<span class="hero__animation-el">${textEl.innerHTML}</span>`;
    textEl.innerHTML = '';
    textEl.appendChild(wrapper);
    textEl.classList.add('hero__animation-wrapper');
  });

  headings.forEach((heading) => heading.classList.add('hero__slide-heading'));
  textParagraphs.forEach((textEl) => textEl.classList.add('hero__slide-text'));
  buttons.forEach((button) => {
    button.classList.add('hero__slide-link', 'agt-button');
  });

  const slideElements = html`
    <li class="hero__slide ${slideContent.className}">
      <div class="hero__slide-media">
        ${mediaEl}
      </div>
      <div class="hero__slide-content">
        ${headings}
        ${textParagraphs}
        <div class="hero__actions">
          ${buttons}
        </div>
      </div>
    </li>
  `;

  slideElements.addEventListener('click', (event) => {
    if (event.target.tagName === 'A' || event.target.closest('a')) {
      return;
    }

    if (buttons[0] && buttons[0].href) {
      buttons[0].click();
    }
  });

  decorateButtons(buttons);

  return slideElements;
};

const createNavigation = (slides) => {
  if (slides.length <= 1) {
    return '';
  }

  return html`
    <div class="hero__navigation">
      <button class="hero__navigation-button hero__navigation-button--prev" aria-label="${getPlaceholder('Previous slide')}">
        <span class="icon icon-chevron-left"></span>
      </button>

      <div class="hero__navigation-indicators">
        ${slides.map((_, index) => html`
            <button class="hero__navigation-indicator" aria-label="${getPlaceholder(index === 0 ? 'hero slide selected index' : 'hero slide index', index + 1, slides.length)}" ${index === 0 ? 'aria-current="true"' : ''}>
            </button>
          `)}
      </div>

      <button class="hero__navigation-button hero__navigation-button--next" aria-label="${getPlaceholder('Next slide')}">
        <span class="icon icon-chevron-right"></span>
      </button>

      <button class="hero__navigation-button hero__navigation-button--pause" aria-label="${getPlaceholder('Pause slides')}">
        <span class="icon icon-pause"></span>
      </button>

      <button class="hero__navigation-button hero__navigation-button--play" aria-label="${getPlaceholder('Play slides')}">
        <span class="icon icon-play"></span>
      </button>
    </div>
  `;
};

const addChangeSlideLogic = (slides, navigation, blockOptions) => {
  const autoplayVideo = (slide) => {
    const video = slide.querySelector('video');
    if (slide.classList.contains('hero__slide--active') && video) {
      // Add required attributes for mobile autoplay
      video.setAttribute('playsinline', '');
      video.setAttribute('muted', '');
      video.muted = true; // Explicitly set muted property

      // Handle play promise
      const playPromise = video.play();
      if (playPromise !== undefined) {
        playPromise.catch((error) => {
          // eslint-disable-next-line no-console
          console.warn('Video autoplay was prevented:', error);
        });
      }
    }
  };

  if (slides.length < 2) {
    const slide = slides[0];
    slide.classList.add('hero__slide--active');
    forceCssReflow(slide);
    slide.classList.add('hero__slide--animation-start');
    autoplayVideo(slide);

    return;
  }

  const slideContainer = navigation.closest('.hero__container');
  const prevButton = navigation.querySelector('.hero__navigation-button--prev');
  const nextButton = navigation.querySelector('.hero__navigation-button--next');
  const pauseButton = navigation.querySelector('.hero__navigation-button--pause');
  const playButton = navigation.querySelector('.hero__navigation-button--play');
  const indicators = navigation.querySelectorAll('.hero__navigation-indicator');

  let slideTimeChange = 5000;
  let currentSlideIndex = 0;
  let autoPlayInterval;
  let startAutoplay;

  if (blockOptions.autoplayTime) {
    try {
      slideTimeChange = parseInt(blockOptions.autoplayTime, 10) * 1000;
    } catch (e) {
      // eslint-disable-next-line no-console
      console.error("Error parsing 'autoplay-time' option, using default value of 5s.\n");
    }
  }

  const updateActiveSlide = (disableReflow) => {
    slides.forEach((slide, index) => {
      slide.classList.toggle('hero__slide--active', index === currentSlideIndex);
      const isSelected = index === currentSlideIndex;
      indicators[index].setAttribute('aria-current', isSelected);
      indicators[index].setAttribute(
        'aria-label',
        getPlaceholder(isSelected ? 'hero slide selected index' : 'hero slide index', index + 1, slides.length),
      );

      if (!disableReflow) {
        forceCssReflow(slide);
      }

      slide.classList.toggle('hero__slide--animation-start', index === currentSlideIndex);

      autoplayVideo(slide);
    });
  };

  const changeSlide = (direction) => {
    currentSlideIndex = (currentSlideIndex + direction + slides.length) % slides.length;
    updateActiveSlide();
    startAutoplay?.();
  };

  startAutoplay = () => {
    clearInterval(autoPlayInterval);

    if (slideTimeChange <= 0) {
      return;
    }

    autoPlayInterval = setInterval(() => {
      if (slideContainer.classList.contains('paused')) {
        clearInterval(autoPlayInterval);

        return;
      }

      changeSlide(1);
    }, slideTimeChange);
  };

  prevButton.addEventListener('click', () => changeSlide(-1));
  nextButton.addEventListener('click', () => changeSlide(1));
  pauseButton.addEventListener('click', () => {
    slideContainer.classList.add('paused');
    pauseButton.style.display = 'none';
    playButton.style.display = 'block';
    playButton.focus();
  });

  playButton.addEventListener('click', () => {
    slideContainer.classList.remove('paused');
    pauseButton.style.display = 'block';
    playButton.style.display = 'none';
    pauseButton.focus();
    startAutoplay();
  });

  indicators.forEach((indicator, index) => {
    indicator.addEventListener('click', () => {
      currentSlideIndex = index;
      updateActiveSlide();
    });
  });

  slideContainer.addEventListener('mouseenter', () => {
    clearInterval(autoPlayInterval);
  });

  slideContainer.addEventListener('mouseleave', () => {
    startAutoplay();
  });

  // initialize the first slide as active
  updateActiveSlide(true);
  addChangeSlideOnSwipe(slideContainer, changeSlide);
  playButton.style.display = 'none';
  startAutoplay();
};

export default async function decorate(block) {
  const blockOptions = readBlockConfig(block);
  [...block.children].forEach((row) => {
    if (row.children.length === 2 && toCamelCase(row.children[0].textContent) === 'autoplayTime') {
      row.remove();
    }
  });
  const isChinaVariant = block.classList.contains('china');

  getSlideConfig(block);
  decorateResponsiveMedia(block);

  const slidesContent = [...block.querySelectorAll(':scope > div > div')];
  const slides = slidesContent.map(createSlide);

  if (isChinaVariant) {
    block.classList.add('hero--china');
    block.classList.remove('china');
  }

  const heroBlock = html`
    <div class="hero__container">
      <ul class="hero__slides">
        ${slides}
      </ul>
      ${createNavigation(slides)}
    </div>
  `;

  block.innerHTML = '';
  block.append(heroBlock);
  block.setAttribute('role', 'banner');

  setBlockToFullViewportWidth(block);
  addChangeSlideLogic(slides, block.querySelector('.hero__navigation'), blockOptions);
  decorateIcons(block);
}
