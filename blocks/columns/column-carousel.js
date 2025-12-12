import { getPlaceholder, decorateIcons } from '../../scripts/aem.js';

function createSlides(block, allItems) {
  const isMobile = window.innerWidth <= 767;
  const itemsPerSlide = isMobile ? 4 : 8;
  const slideCount = Math.ceil(allItems.length / itemsPerSlide);
  const existingNav = block.querySelector('.columns__nav');
  block.innerHTML = '';
  for (let slideIndex = 0; slideIndex < slideCount; slideIndex += 1) {
    const slideElement = document.createElement('div');
    slideElement.classList.add('columns__slide');
    const startIndex = slideIndex * itemsPerSlide;
    const endIndex = Math.min(startIndex + itemsPerSlide, allItems.length);
    for (let itemIndex = startIndex; itemIndex < endIndex; itemIndex += 1) {
      if (allItems[itemIndex]) {
        slideElement.appendChild(allItems[itemIndex].cloneNode(true));
      }
    }
    block.appendChild(slideElement);
  }
  if (existingNav) {
    block.appendChild(existingNav);
  }
  return slideCount;
}

let isProgrammaticScroll = false;
function createNavigation(block) {
  const existingNav = block.querySelector('.columns__nav');
  if (existingNav) {
    existingNav.remove();
  }

  const slides = block.querySelectorAll('.columns__slide');
  const slideCount = slides.length;

  if (slideCount <= 1) {
    return;
  }
  const navContainer = document.createElement('div');
  navContainer.classList.add('columns__nav');

  const prevButton = document.createElement('button');
  prevButton.type = 'button';
  prevButton.classList.add(
    'agt-link--dark',
  );
  const prevIcon = document.createElement('span');
  prevIcon.classList.add('icon', 'icon-chevron-left');
  prevButton.appendChild(prevIcon);
  prevButton.setAttribute('aria-label', getPlaceholder('Previous slide'));

  // Create next button
  const nextButton = document.createElement('button');
  nextButton.type = 'button';
  nextButton.classList.add(
    'agt-link--dark',
  );
  const nextIcon = document.createElement('span');
  nextIcon.classList.add('icon', 'icon-chevron-right');
  nextButton.appendChild(nextIcon);
  nextButton.setAttribute('aria-label', getPlaceholder('Next slide'));

  // Create dots container
  const dotsContainer = document.createElement('div');
  dotsContainer.classList.add('columns__nav-dots');

  // Create dots for each slide
  for (let i = 0; i < slideCount; i += 1) {
    const dot = document.createElement('button');
    dot.classList.add('columns__nav-dot');
    if (i === 0) dot.classList.add('active');
    dot.setAttribute('aria-label', getPlaceholder(`Go to slide ${i + 1}${dot.classList.contains('active') ? 'Selected' : ''}`));
    dot.setAttribute('aria-selected', dot.classList.contains('active') ? 'true' : 'false');
    dot.dataset.slideIndex = i;
    dotsContainer.appendChild(dot);
  }

  // Add navigation elements to container
  navContainer.appendChild(prevButton);
  navContainer.appendChild(dotsContainer);
  navContainer.appendChild(nextButton);

  // Add navigation to block
  block.appendChild(navContainer);

  decorateIcons(navContainer);

  // Initialize current slide index
  block.dataset.currentSlide = '0';
  function showSlide(index) {
    // Mark that we're doing a programmatic scroll
    isProgrammaticScroll = true;
    [...slides].forEach((slide) => slide.classList.remove('active'));
    if (slides[index]) {
      slides[index].classList.add('active');
    }

    const dots = block.querySelectorAll('.columns__nav-dot');
    [...dots].forEach((dot, i) => {
      dot.classList.remove('active');
      dot.setAttribute('aria-label', getPlaceholder(`Go to slide ${i + 1}${i === index ? ' Selected' : ''}`));
      dot.setAttribute('aria-selected', i === index ? 'true' : 'false');
    });
    if (dots[index]) {
      dots[index].classList.add('active');
    }
    if (slides[index]) {
      const carousel = block.closest('.column-carousel');
      const slideOffsetLeft = slides[index].offsetLeft;
      carousel.scrollTo({
        left: slideOffsetLeft,
        behavior: 'smooth',
      });
      // Reset the flag after animation completes
      setTimeout(() => {
        isProgrammaticScroll = false;
      }, 500);
    }
    block.dataset.currentSlide = index;
  }
  // Show initial slide
  showSlide(0);
  // Navigation functionality

  function nextSlide() {
    const currentIndex = parseInt(block.dataset.currentSlide || '0', 10);
    const newIndex = currentIndex < slideCount - 1 ? currentIndex + 1 : 0;
    showSlide(newIndex);
  }

  function prevSlide() {
    const currentIndex = parseInt(block.dataset.currentSlide || '0', 10);
    const newIndex = currentIndex > 0 ? currentIndex - 1 : slideCount - 1;
    showSlide(newIndex);
  }

  // Add event listeners
  nextButton.addEventListener('click', nextSlide);
  prevButton.addEventListener('click', prevSlide);

  dotsContainer.addEventListener('click', (event) => {
    if (event.target.classList.contains('columns__nav-dot')) {
      const slideIndex = parseInt(event.target.dataset.slideIndex, 10);
      showSlide(slideIndex);
    }
  });

  block.addEventListener('keydown', (event) => {
    if (event.key === 'ArrowLeft') {
      event.preventDefault();
      prevSlide(event);
    } else if (event.key === 'ArrowRight') {
      event.preventDefault();
      nextSlide(event);
    }
  });
  block.isProgrammaticScrolling = () => isProgrammaticScroll;
}

function watchSlideScroll(block) {
  // Intersection Observer for slide visibility
  const observerOptions = {
    root: null,
    rootMargin: '0px',
    threshold: 0.5,
  };

  const slides = block.querySelectorAll('.columns__slide');
  const slideObserver = new IntersectionObserver((entries) => {
    if (isProgrammaticScroll) {
      return;
    }
    entries.forEach((entry) => {
      if (entry.isIntersecting) {
        const slide = entry.target;
        const slideIndex = Array.from(slides).indexOf(slide);

        // Update active slide
        slides.forEach((s) => s.classList.remove('active'));
        slide.classList.add('active');
        // Update active dot and ARIA attributes
        const dots = block.querySelectorAll('.columns__nav-dot');
        dots.forEach((dot, i) => {
          dot.classList.remove('active');
          dot.setAttribute('aria-label', getPlaceholder(`Go to slide ${i + 1}${i === slideIndex ? ' Selected' : ''}`));
          dot.setAttribute('aria-selected', i === slideIndex ? 'true' : 'false');
        });
        if (dots[slideIndex]) {
          dots[slideIndex].classList.add('active');
        }
        // Update current slide index
        block.dataset.currentSlide = slideIndex;
      }
    });
  }, observerOptions);
  slides.forEach((slide) => slideObserver.observe(slide));
  return slideObserver;
}

export function decorateColumnCarousel(block) {
  // Get all individual column items from all rows
  const allItems = [];
  const rows = Array.from(block.children);

  // Extract all individual column items from rows
  rows.forEach((row) => {
    const items = Array.from(row.children);
    allItems.push(...items);
  });

  // Create initial slides and navigation
  createSlides(block, allItems);
  createNavigation(block);
  let slideObserver = watchSlideScroll(block);
  // Handle responsive changes
  const mediaQuery = window.matchMedia('(max-width: 767px)');
  const handleMediaChange = () => {
    isProgrammaticScroll = true;

    if (slideObserver) {
      slideObserver.disconnect();
    }
    const currentSlideIndex = parseInt(block.dataset.currentSlide || '0', 10);
    const oldItemsPerSlide = window.innerWidth <= 767 ? 4 : 8;
    const approximateItemIndex = currentSlideIndex * oldItemsPerSlide;
    createSlides(block, allItems);
    createNavigation(block);
    // Try to maintain relative position after resize
    const newSlides = block.querySelectorAll('.columns__slide');
    if (newSlides.length > 0) {
      const newItemsPerSlide = window.innerWidth <= 767 ? 4 : 8;
      const newIndex = Math.min(
        Math.floor(approximateItemIndex / newItemsPerSlide),
        newSlides.length - 1,
      );
      const slideToShow = newSlides[newIndex];
      if (slideToShow) {
        slideToShow.classList.add('active');
        block.dataset.currentSlide = newIndex;
        // Use immediate scroll first for positioning
        block.scrollTo({
          left: slideToShow.offsetLeft,
          behavior: 'auto',
        });
        // Update dots and ARIA attributes
        const dots = block.querySelectorAll('.columns__nav-dot');
        dots.forEach((dot, index) => {
          dot.classList.toggle('active', index === newIndex);
          dot.setAttribute('aria-label', getPlaceholder(`Go to slide ${index + 1}${index === newIndex ? ' Selected' : ''}`));
          dot.setAttribute('aria-selected', index === newIndex ? 'true' : 'false');
        });
        setTimeout(() => {
          slideObserver = watchSlideScroll(block);
          isProgrammaticScroll = false;
        }, 800);
      }
    }
  };
  mediaQuery.addEventListener('change', handleMediaChange);
}
