import { changeSearchAttempt, setSearchPerformedProps } from '../search-results.analytics.js';

const trackPaginationEvents = (pageNumber) => {
  changeSearchAttempt();
  setSearchPerformedProps({ userAction: 'page-change', pageNumber });
};

export const registerPaginationEvent = (block, currentPage, totalPages) => {
  const prevButton = block.querySelector('.pagination__button--prev');
  const nextButton = block.querySelector('.pagination__button--next');
  const pageButtons = block.querySelectorAll('.pagination__button[data-page]');

  if (prevButton) {
    prevButton.addEventListener('click', (e) => {
      e.preventDefault();
      if (!prevButton.disabled && currentPage > 1) {
        trackPaginationEvents(currentPage - 1);
      }
    });
  }

  if (nextButton) {
    nextButton.addEventListener('click', (e) => {
      e.preventDefault();
      if (!nextButton.disabled && currentPage < totalPages) {
        trackPaginationEvents(currentPage + 1);
      }
    });
  }

  pageButtons.forEach((button) => {
    button.addEventListener('click', (e) => {
      e.preventDefault();
      const pageNum = parseInt(button.dataset.page, 10);
      if (pageNum && pageNum !== currentPage) {
        trackPaginationEvents(pageNum);
      }
    });
  });
};
