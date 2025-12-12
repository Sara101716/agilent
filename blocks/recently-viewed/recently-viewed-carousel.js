import { getPlaceholder } from '../../scripts/aem.js';

export function createCarousel(container, ul, itemsPerPage = 4) {
  let currentPosition = 0;

  // Get total number of items
  const getTotalItems = () => ul.children.length;

  // Get maximum position (total pages - 1)
  const getMaxPosition = () => Math.max(0, Math.ceil(getTotalItems() / itemsPerPage) - 1);

  // Update button disabled states
  const updateButtonStates = () => {
    const leftButton = container.parentElement.querySelector('.carousel-btn-left');
    const rightButton = container.parentElement.querySelector('.carousel-btn-right');

    if (leftButton && rightButton) {
      leftButton.disabled = currentPosition <= 0;
      rightButton.disabled = currentPosition >= getMaxPosition();
    }
  };

  // Update transform to show current position
  const updatePosition = () => {
    ul.scrollTo({
      left: container.offsetWidth * currentPosition,
      behavior: 'smooth',
    });
    // Update button states
    updateButtonStates();
  };

  // Navigation functions
  const goToNext = () => {
    if (currentPosition < getMaxPosition()) {
      currentPosition += 1;
      updatePosition();
    }
  };

  const goToPrevious = () => {
    if (currentPosition > 0) {
      currentPosition -= 1;
      updatePosition();
    }
  };

  // Create navigation buttons
  const createButtons = () => {
    const leftButton = document.createElement('button');
    leftButton.className = 'carousel-btn carousel-btn-left';
    leftButton.innerHTML = '<span class="icon icon-chevron-left"></span>';
    leftButton.setAttribute('aria-label', getPlaceholder('Previous items'));
    leftButton.setAttribute('tabindex', '-1');

    const rightButton = document.createElement('button');
    rightButton.className = 'carousel-btn carousel-btn-right';
    rightButton.innerHTML = '<span class="icon icon-chevron-right"></span>';
    rightButton.setAttribute('aria-label', getPlaceholder('Next items'));
    rightButton.setAttribute('tabindex', '-1');

    // Add event listeners
    leftButton.addEventListener('click', goToPrevious);
    rightButton.addEventListener('click', goToNext);

    // Add buttons to container
    container.parentElement.appendChild(leftButton);
    container.parentElement.appendChild(rightButton);

    return { leftButton, rightButton };
  };

  const goToPosition = (position) => {
    currentPosition = Math.max(0, Math.min(position, getMaxPosition()));
    updatePosition();
  };

  // Initialize carousel
  const init = () => {
    // Add carousel wrapper class to container
    container.classList.add('carousel-container');

    // Create buttons
    const buttons = createButtons();

    // Set initial position
    updatePosition();

    // Add mobile swipe navigation
    let startX = 0;
    let isSwiping = false;

    container.addEventListener('touchstart', (e) => {
      startX = e.touches[0].clientX;
      isSwiping = true;
    }, { passive: true });

    container.addEventListener('touchmove', (e) => {
      if (!isSwiping) return;
      const currentX = e.touches[0].clientX;
      const diffX = startX - currentX;

      // Threshold for swipe
      if (Math.abs(diffX) > 50) {
        if (diffX > 0) {
          goToNext();
        } else {
          goToPrevious();
        }
        isSwiping = false; // Prevent multiple swipes
      }
    }, { passive: true });

    return buttons;
  };

  // Public API
  return {
    init,
    goToNext,
    goToPrevious,
    goToPosition,
    getCurrentPosition: () => currentPosition,
    getTotalPages: () => getMaxPosition() + 1,
    updatePosition,
  };
}
