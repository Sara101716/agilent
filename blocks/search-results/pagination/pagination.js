import { decorateIcons, html, getPlaceholder } from '../../../scripts/aem.js';
import {
  getContentController,
} from '../../../scripts/coveo/headless/index.js';
import {
  getCommerceController,
} from '../../../scripts/coveo/headless/commerce/index.js';
import { registerPaginationEvent } from './pagination.analytics.js';

const normalizePaginationState = (controller, engineType) => {
  const defaultConfig = {
    currentPage: 1,
    totalPages: 1,
    resultsPerPage: null,
    totalResults: null,
    hasNextPage: false,
    hasPreviousPage: false,
    currentPages: [],
  };

  const { state } = controller.pagination;
  if (engineType === 'commerce') {
    return {
      ...defaultConfig,
      currentPage: state.page + 1,
      totalPages: state.totalPages,
      resultsPerPage: state.pageSize,
      totalResults: state.totalEntries,
      hasNextPage: state.page < state.totalPages - 1,
      hasPreviousPage: state.page > 0,
      nextPage: controller.pagination.nextPage,
      previousPage: controller.pagination.previousPage,
      selectPage: (pageNum) => controller.pagination.selectPage(pageNum - 1),
    };
  } if (engineType === 'content') {
    return {
      currentPage: state.currentPage,
      totalPages: state.maxPage,
      resultsPerPage: controller.resultsPerPage.state.numberOfResults,
      totalResults: controller.summary.state.total,
      hasNextPage: state.hasNextPage,
      hasPreviousPage: state.hasPreviousPage,
      currentPages: state.currentPages,
      nextPage: controller.pagination.nextPage,
      previousPage: controller.pagination.previousPage,
      selectPage: controller.pagination.selectPage,
    };
  }
  // eslint-disable-next-line no-console
  console.warn('Unknown pagination state structure');
  return defaultConfig;
};

const buildPaginationUI = async (block, controller) => {
  const tabContainer = block.closest('div[data-engine-type]');
  const engineType = tabContainer ? tabContainer.dataset.engineType : 'content';
  const normalizedState = normalizePaginationState(controller, engineType);
  const {
    currentPage,
    totalPages,
    resultsPerPage,
    totalResults,
    hasNextPage,
    hasPreviousPage,
    currentPages,
    nextPage,
    previousPage,
    selectPage,
  } = normalizedState;

  const createPaginationTemplate = () => html`
    <nav class="pagination" aria-label="${getPlaceholder('pagination')}">
      <ul class="pagination__item--list">
      </ul>
      <div class="pagination__info"></div>
    </nav>
  `;

  const renderPageNumbers = (container) => {
    if (totalPages <= 1) return;

    let pageNumbersHTML = '';
    const maxVisible = 3;
    let pagesToShow = [];

    if (engineType === 'search' && currentPages.length > 0) {
      pagesToShow = currentPages.slice(0, maxVisible);
    } else {
      let start = Math.max(1, currentPage - 1);
      const end = Math.min(totalPages, start + 2);

      if (end === totalPages && end - start < 2) {
        start = Math.max(1, end - 2);
      }

      for (let i = start; i <= end; i += 1) {
        pagesToShow.push(i);
      }
    }

    if (hasPreviousPage) {
      const previousButton = `<li class="pagination__item pagination__item--prev">
        <button aria-label="${getPlaceholder('Previous')}" class="pagination__button pagination__button--prev agt-link" ${currentPage === 1 ? 'disabled' : ''}>
          <span class="icon icon-chevron-left"></span>
        </button>
      </li>`;
      pageNumbersHTML += previousButton;
    }

    if (!pagesToShow.includes(1) && totalPages > 3) {
      pageNumbersHTML += `<li class="pagination__item pagination__item--number"><button class="pagination__button agt-button ${currentPage === 1 ? 'agt-button--primary' : 'agt-link'}" data-page="1"${currentPage === 1 ? ` aria-current="${getPlaceholder('page')}"` : ''}>1</button></li>`;
      if (pagesToShow[0] > 2) {
        pageNumbersHTML += '<li class="pagination__item pagination__item--ellipsis"><span class="pagination__ellipsis">...</span></li>';
      }
    }

    pagesToShow.forEach((pageNum) => {
      pageNumbersHTML += `<li class="pagination__item pagination__item--number"><button class="pagination__button agt-button ${currentPage === pageNum ? 'agt-button--primary' : 'agt-link'}" data-page="${pageNum}"${currentPage === pageNum ? ` aria-current="${getPlaceholder('page')}"` : ''}>${pageNum}</button></li>`;
    });

    if (!pagesToShow.includes(totalPages) && totalPages > 3) {
      const lastPageInRange = pagesToShow[pagesToShow.length - 1];
      if (lastPageInRange < totalPages - 1) {
        pageNumbersHTML += '<li class="pagination__item pagination__item--ellipsis"><span class="pagination__ellipsis">...</span></li>';
      }
      pageNumbersHTML += `<li class="pagination__item pagination__item--number"><button class="pagination__button agt-button ${currentPage === totalPages ? 'agt-button--primary' : 'agt-link'}" data-page="${totalPages}"${currentPage === totalPages ? ` aria-current="${getPlaceholder('page')}"` : ''}>${totalPages}</button></li>`;
    }

    if (hasNextPage) {
      const nextButton = `<li class="pagination__item pagination__item--next">
        <button aria-label="${getPlaceholder('Next')}" class="pagination__button pagination__button--next agt-link" ${currentPage === totalPages ? 'disabled' : ''}>
          <span class="icon icon-chevron-right"></span>
        </button>
      </li>`;
      pageNumbersHTML += nextButton;
    }

    container.innerHTML = pageNumbersHTML;
  };

  const renderPaginationInfo = (container) => {
    if (totalResults !== null && resultsPerPage !== null && totalResults > 0) {
      const startIndex = (currentPage - 1) * resultsPerPage + 1;
      const endIndex = Math.min(currentPage * resultsPerPage, totalResults);
      container.textContent = `${startIndex} - ${endIndex} of ${totalResults} results`;
    } else {
      container.textContent = '';
    }
  };

  const registerScrollToTop = (el) => {
    window.addEventListener('searchResults:Updated', () => {
      const tabContent = el.closest('.search-results__items');
      const resultsContainer = tabContent?.querySelector('.results');
      if (resultsContainer) {
        resultsContainer.scrollIntoView({ behavior: 'smooth' });
      }
    }, { once: true });
  };

  const paginationWrapper = createPaginationTemplate();
  const paginationList = paginationWrapper.querySelector('.pagination__item--list');
  const paginationInfoContainer = paginationWrapper.querySelector('.pagination__info');

  renderPageNumbers(paginationList);
  renderPaginationInfo(paginationInfoContainer);

  block.innerHTML = '';
  block.appendChild(paginationWrapper);
  decorateIcons(block);

  const prevButton = block.querySelector('.pagination__button--prev');
  const nextButton = block.querySelector('.pagination__button--next');
  const pageButtons = block.querySelectorAll('.pagination__button[data-page]');

  if (prevButton) {
    prevButton.addEventListener('click', (e) => {
      e.preventDefault();
      if (!prevButton.disabled && currentPage > 1) {
        previousPage();
        registerScrollToTop(block);
      }
    });
  }

  if (nextButton) {
    nextButton.addEventListener('click', (e) => {
      e.preventDefault();
      if (!nextButton.disabled && currentPage < totalPages) {
        nextPage();
        registerScrollToTop(block);
      }
    });
  }

  pageButtons.forEach((button) => {
    button.addEventListener('click', (e) => {
      e.preventDefault();
      const pageNum = parseInt(button.dataset.page, 10);
      if (pageNum && pageNum !== currentPage) {
        selectPage(pageNum);
        registerScrollToTop(block);
      }
    });
  });
  registerPaginationEvent(block, currentPage, totalPages);
};

export default async function decorate(block) {
  const productContainer = block.closest('div[data-tab-content="products"]');
  if (productContainer) {
    const commerceController = await getCommerceController();
    const paginationController = commerceController.pagination;
    commerceController.search.subscribe(async () => {
      if (paginationController.state.totalPages > 1) {
        buildPaginationUI(block, commerceController);
      } else {
        block.innerHTML = '';
      }
    });

    if (paginationController.state.totalPages > 1) {
      buildPaginationUI(block, commerceController);
    }
  } else {
    const contentController = await getContentController();
    contentController.results.subscribe(async () => {
      if (contentController.pagination.state.maxPage > 1) {
        buildPaginationUI(block, contentController);
      } else {
        block.innerHTML = '';
      }
    });

    if (contentController.pagination.state.maxPage > 1) {
      buildPaginationUI(block, contentController);
    }
  }
}
