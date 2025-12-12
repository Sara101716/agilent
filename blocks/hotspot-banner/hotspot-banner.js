import {
  getPlaceholder,
  html,
  decorateIcons,
  decorateResponsiveMedia,
} from '../../scripts/aem.js';

const isMobile = window.matchMedia('(max-width: 767px)');
function decorateBackground(backgroundElem) {
  backgroundElem.className = 'hotspot-banner__background';
  decorateResponsiveMedia(backgroundElem);
  const title = backgroundElem.querySelector('h1,h2,h3,h4,h5');
  title.className = 'hotspot-banner__background-title';
  const picture = backgroundElem.querySelector('picture');
  picture.className = 'hotspot-banner__background-image';
}

function decorateDescription(descriptionElem) {
  descriptionElem.className = 'hotspot-banner__description';
  const title = descriptionElem.querySelector('h1,h2,h3,h4,h5');
  title.className = 'hotspot-banner__description-title';
  const content = html`<div class="hotspot-banner__description-content"></div>`;
  while (title.nextElementSibling) {
    content.append(title.nextElementSibling);
  }
  const actionContainers = content.querySelectorAll('.button-container + .button-container');
  actionContainers.forEach((container) => {
    const actionsWrapper = html`<div class="hotspot-banner__actions"></div>`;
    actionsWrapper.append(container.previousElementSibling, container);
    content.append(actionsWrapper);
  });
  title.after(content);
}

function openHotSpotCardPopover(slide) {
  const container = slide.closest('.hotspot-banner__hotspots');
  const productImageContainer = container.querySelector('.hotspot-banner__product-wrapper');
  productImageContainer.querySelector('.hotspot-banner__popover')?.remove();
  const clonedSlide = slide.cloneNode(true);
  const nav = clonedSlide.querySelector('.hotspot-banner__card-nav');
  clonedSlide.append(nav);
  const containerRect = productImageContainer.getBoundingClientRect();
  const xCoords = parseFloat(clonedSlide.dataset.xCoords.replace('%', ''));
  const yCoords = parseFloat(clonedSlide.dataset.yCoords.replace('%', ''));

  // Create a temporary popover to measure dimensions
  const tempPopover = html`<div data-card-index="${slide.dataset.cardIndex}" class="hotspot-banner__popover" style="position: absolute; visibility: hidden;">
    ${clonedSlide.innerHTML}
  </div>`;
  productImageContainer.appendChild(tempPopover);
  const popoverRect = tempPopover.getBoundingClientRect();
  productImageContainer.removeChild(tempPopover);

  // Convert percentage coordinates to pixel values
  const xPixels = (xCoords / 100) * containerRect.width;
  const yPixels = (yCoords / 100) * containerRect.height;

  let positionClass = '';
  let leftPos = xPixels;
  let topPos = yPixels;

  // Check available space on the right side
  const spaceOnRight = containerRect.width - xPixels;
  const popoverWidth = popoverRect.width;
  const popoverHeight = popoverRect.height;
  const markerSize = 10; // Marker width/height in pixels

  // Determine position based on available space
  if (spaceOnRight >= popoverWidth) {
    // Enough space on right - align to bottom right with marker offset
    positionClass = 'bottom-right';
    leftPos = xPixels + markerSize;
    topPos = yPixels - popoverHeight - markerSize;
  } else {
    // Not enough space on right - align to bottom left with marker offset
    positionClass = 'bottom-left';
    leftPos = xPixels - popoverWidth - markerSize;
    topPos = yPixels - popoverHeight - markerSize;
  }

  // Create the popover element
  const popover = html`<div class="hotspot-banner__popover" data-card-index="${slide.dataset.cardIndex}"  ${positionClass}" 
    style="left: ${leftPos}px; top: ${topPos}px;">
      ${clonedSlide.innerHTML}
    </div>`;
  // eslint-disable-next-line no-use-before-define
  registerNavigationEvents(popover);
  productImageContainer.appendChild(popover);
}

function closeHotSpotCardPopover(slide) {
  const container = slide.closest('.hotspot-banner__hotspots');
  const productImageContainer = container.querySelector('.hotspot-banner__product-wrapper');
  const card = productImageContainer.querySelector('.hotspot-banner__popover');
  if (card) {
    const index = card.dataset.cardIndex;
    container.querySelector(`.hotspot-banner__marker[data-target="${index}"]`)?.classList.remove('open');
    card.remove();
  }
}

function goToSlide(slides, slide) {
  if (isMobile.matches) {
    slides.scrollTo({
      left: slide.offsetLeft,
      behavior: 'smooth',
    });
  } else {
    openHotSpotCardPopover(slide);
  }
}

function registerNavigationEvents(cardElem) {
  const handleNavigation = (button, direction) => {
    if (!button) return;
    button.addEventListener('click', (e) => {
      e.preventDefault();
      const popupCard = e.currentTarget.closest('.hotspot-banner__popover');

      if (popupCard) {
        const currentIndex = parseInt(popupCard.dataset.cardIndex, 10);
        const container = popupCard.closest('.hotspot-banner__product-wrapper');
        container.querySelector(`.hotspot-banner__marker[data-target="${currentIndex + direction}"]`)?.click();
      } else {
        const currentSlide = e.target.closest('.hotspot-banner__hotspot-card');
        const targetSlide = direction === 1
          ? currentSlide.nextElementSibling
          : currentSlide.previousElementSibling;
        if (targetSlide) {
          goToSlide(currentSlide.parentElement, targetSlide);
        }
      }
    });
  };

  const nextButton = cardElem.querySelector('.hotspot-banner__card-next');
  handleNavigation(nextButton, 1);
  const prevButton = cardElem.querySelector('.hotspot-banner__card-previous');
  handleNavigation(prevButton, -1);
}

function setupHotspotCarousel(cardsContainer, hotSpotContents) {
  const pagination = html`<div class="hotspot-banner__pagination">
    ${hotSpotContents.map((_, index) => html`<a href="#" class="hotspot-banner__pagination-item" data-card-index="${index}">
      </a>`)}
  </div>`;
  const slides = cardsContainer.querySelectorAll('.hotspot-banner__hotspot-card');
  let observer;

  const cleanupObserver = () => {
    if (observer) {
      observer.disconnect();
      observer = null;
    }
  };

  const setupIntersectionObserver = () => {
    cleanupObserver();
    observer = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting && entry.intersectionRatio === 1) {
          const { cardIndex } = entry.target.dataset;
          pagination.querySelectorAll('.hotspot-banner__pagination-item').forEach((item, index) => {
            item.classList.toggle('active', index === parseInt(cardIndex, 10));
          });
        }
      });
    }, {
      threshold: 1.0,
      root: cardsContainer,
    });

    slides.forEach((slide, index) => {
      observer.observe(slide);
      pagination.children[index].addEventListener('click', (e) => {
        e.preventDefault();
        const { currentTarget } = e;
        const { cardIndex } = currentTarget.dataset;
        goToSlide(slide.parentElement, slides[parseInt(cardIndex, 10)]);
      });
    });
  };

  const updateObserver = (isMobileMatches) => {
    if (isMobileMatches) {
      setupIntersectionObserver();
    } else {
      cleanupObserver();
    }
    pagination.setAttribute('aria-hidden', !isMobileMatches);
  };

  const mediaQuery = window.matchMedia('(max-width: 767px)');
  updateObserver(mediaQuery.matches);
  mediaQuery.addEventListener('change', (e) => updateObserver(e.matches));
  cardsContainer.append(pagination);
}

function updateHotspotProductImage(card, xyCoords, hotspotContainer) {
  const productWrapper = hotspotContainer.querySelector('.hotspot-banner__product-wrapper');
  const hotspotItem = html`<button data-target="${card.dataset.cardIndex}" class="hotspot-banner__marker" style="left: ${xyCoords[0]}; top: ${xyCoords[1]};"><span class="icon icon-plus"></span></button>`;
  decorateIcons(hotspotItem);
  hotspotItem.addEventListener('click', (e) => {
    e.preventDefault();
    const currentHotspotItem = e.currentTarget;
    if (currentHotspotItem.classList.contains('open')) {
      currentHotspotItem.classList.remove('open');
      closeHotSpotCardPopover(card);
    } else {
      const markers = hotspotContainer.querySelectorAll('.hotspot-banner__marker.open');
      [...markers].forEach((item) => item.classList.remove('open'));
      currentHotspotItem.classList.add('open');
      goToSlide(card.parentElement, card);
    }
  });
  productWrapper.append(hotspotItem);
}

function decorateHotspotContentCard(cardItemHTML) {
  const cardElem = html`<div class="hotspot-banner__card">${cardItemHTML}</div>`;
  const cardTitle = cardElem.querySelector('strong');
  if (cardTitle) {
    cardElem.dataset.title = cardTitle.textContent;
    cardTitle.remove();
  }
  const media = cardElem.querySelector('a:has(picture)');
  let mediaWrapper = '';
  let contentWrapper = '';
  if (media) {
    media.classList.add('media');
    media.append(html`<span class="play"><span class="icon icon-play-video"></span></span>`);
    mediaWrapper = html`<div class="hotspot-banner__card-media">${media}</div>`;
  }
  const cardHeading = cardElem.querySelector('p.button-container, p:has(a)');
  if (cardHeading) {
    cardHeading.className = 'hotspot-banner__card-heading';
    const cardDescription = cardHeading.nextElementSibling;
    if (cardDescription) {
      cardDescription.className = 'hotspot-banner__card-description';
      contentWrapper = html`<div class="hotspot-banner__card-content">${cardHeading} ${cardDescription}</div>`;
    } else {
      contentWrapper = html`<div class="hotspot-banner__card-content">${cardHeading}</div>`;
    }
  }
  cardElem.innerHTML = '';
  cardElem.append(...[mediaWrapper, contentWrapper]);
  return cardElem.outerHTML;
}

function decorateHotspotContents(hotspotContainer, hotSpotContents) {
  const cards = html`<div class="hotspot-banner__hotspot-cards"></div>`;
  hotSpotContents.forEach(({ content, coords }, index) => {
    const prevCard = hotSpotContents[index - 1];
    let previousButton;
    let nextButton;
    let nextCardTitle;
    if (prevCard) {
      previousButton = '<button class="agt-link hotspot-banner__card-previous"><span class="icon icon-arrow-left"></span></button>';
    }
    const nextCard = hotSpotContents[index + 1];
    if (nextCard) {
      const nextCardContentElem = document.createElement('div');
      nextCardContentElem.innerHTML = nextCard.content;
      const nextCardTitleElem = nextCardContentElem.querySelector('p > strong');
      nextCardTitle = nextCardTitleElem ? nextCardTitleElem.textContent : '';
      nextButton = '<button class="agt-link hotspot-banner__card-next"><span class="icon icon-arrow-right"></span></button>';
    }
    const xyCoords = coords.split(',');

    const card = html`<div 
      data-card-index="${index}" 
      data-x-coords="${xyCoords[0]}" 
      data-y-coords="${xyCoords[1]}" 
      class="hotspot-banner__hotspot-card">
      <div class ="hotspot-banner__card-nav">
        ${previousButton}
        <span class="hotspot-banner__card-title">${nextCardTitle ? `${getPlaceholder('Next')}: ` : ''} <span class="highlight">${nextCardTitle}</span></span>
        ${nextButton}
      </div>
       <div class ="hotspot-banner__card-wrapper"> ${decorateHotspotContentCard(content)}</div>
      </div>`;
    decorateIcons(card);
    registerNavigationEvents(card);
    updateHotspotProductImage(card, xyCoords, hotspotContainer);
    cards.append(card);
  });
  const cardsWrapper = html`<div class="hotspot-banner__hotspot-inner"></div>`;
  cardsWrapper.append(cards);
  hotspotContainer.append(cardsWrapper);
  setupHotspotCarousel(cardsWrapper, hotSpotContents);

  const checkCarousel = (matches) => {
    if (matches) {
      cards.classList.add('carousel');
      cardsWrapper.classList.remove('hidden');
      cardsWrapper.setAttribute('aria-hidden', false);
      hotspotContainer.querySelector('.hotspot-banner__popover')?.remove();
    } else {
      cards.classList.remove('carousel');
      cardsWrapper.classList.add('hidden');
      cardsWrapper.setAttribute('aria-hidden', true);
    }
  };

  checkCarousel(isMobile.matches);
  isMobile.addEventListener('change', (e) => {
    checkCarousel(e.matches);
  });
}

function getHotSpotData(hotspotWrapperElem) {
  // TODO: change the below line to read from picture url query params.
  const hotSpotCoords = [...hotspotWrapperElem.querySelectorAll('ol:nth-of-type(2) > li')].map((item) => item.innerHTML);
  const hotSpotContents = [...hotspotWrapperElem.querySelectorAll('ol:nth-of-type(1) > li')];
  if (hotSpotCoords.length !== hotSpotContents.length) {
    // Handle error case
    // eslint-disable-next-line no-console
    console.warn('hotspot authoring error: the number of hotspot is not equal to content configured.', hotSpotCoords.length, hotSpotContents.length);
    return [];
  }
  return hotSpotContents
    .map((item, index) => ({
      content: item.innerHTML,
      coords: hotSpotCoords[index],
    }));
}

function decorateHotspots(hotspotWrapperElem) {
  const block = hotspotWrapperElem.closest('.block');
  hotspotWrapperElem.className = 'hotspot-banner__hotspots';
  const productImage = hotspotWrapperElem.querySelector('picture');
  const hotSpotContents = getHotSpotData(hotspotWrapperElem);

  const hotspotContainer = html`<div class="hotspot-banner__hotspot-container"></div>`;
  const productImageWrapper = html`<div class="hotspot-banner__product-wrapper"></div>`;
  productImageWrapper.append(productImage);
  hotspotContainer.append(productImageWrapper);
  const blockBackground = block.querySelector('.hotspot-banner__background-image');
  const mobileBackground = blockBackground.cloneNode(true);
  mobileBackground.className = 'hotspot-banner__hotspot-background';
  productImage.className = 'hotspot-banner__product-image';
  hotspotContainer.append(mobileBackground);
  hotspotContainer.append(productImageWrapper);
  hotspotWrapperElem.append(hotspotContainer);

  if (hotSpotContents.length > 0) {
    decorateHotspotContents(hotspotWrapperElem, hotSpotContents);
  }

  hotspotWrapperElem.children[0].remove();
}

function observeBlockForAnimation(block) {
  const animationObserver = new IntersectionObserver((entries) => {
    entries.forEach((entry) => {
      if (entry.isIntersecting && entry.intersectionRatio === 1) {
        entry.target.classList.add('animate');
        animationObserver.unobserve(entry.target);
        setTimeout(() => {
          entry.target.classList.add('animate--done');
        }, 6000);
      }
    });
  }, {
    threshold: 1.0,
  });
  animationObserver.observe(block);
}

export default function decorate(block) {
  if (block.children.length >= 3) {
    const [backgroundWrapper, descriptionWrapper, hotspotWrapper] = [...block.children];
    decorateBackground(backgroundWrapper);
    decorateDescription(descriptionWrapper);
    decorateHotspots(hotspotWrapper);
    // Add intersection observer for animation on large screens
    const largeScreen = window.matchMedia('(min-width: 1441px)');
    if (largeScreen.matches) {
      observeBlockForAnimation(block);
    }
    largeScreen.addEventListener('change', (e) => {
      if (e.matches) {
        observeBlockForAnimation(block);
      }
    });
  } else {
    // eslint-disable-next-line no-console
    console.warn('Block should have atleast 3 childs.');
  }
}
