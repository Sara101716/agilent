import { getPlaceholder, html } from '../../../scripts/aem.js';
import {
  getCommerceController,
} from '../../../scripts/coveo/headless/commerce/index.js';
import {
  getContentController,
} from '../../../scripts/coveo/headless/index.js';

function toggleContentVisibility(block, isLoading) {
  if (block.parentNode) {
    const tabContentEls = block.parentNode.querySelectorAll('.results, .search-results__filters, .null-results');
    tabContentEls.forEach((el) => {
      if (isLoading) {
        el.style.opacity = '0';
      } else {
        el.style.opacity = '0';
        el.style.transition = 'opacity 0.3s ease-in';
        setTimeout(() => {
          el.style.opacity = '1';
        }, 10);
      }
    });
  }
}

export function showLoader(block) {
  const isBlockAlreadyLoading = block.querySelector('.spinner');
  if (isBlockAlreadyLoading) {
    return isBlockAlreadyLoading;
  }

  toggleContentVisibility(block, true);
  const spinner = html`<div class="spinner"></div>`;
  spinner.style.opacity = '0';
  spinner.style.transition = 'opacity 0.3s ease-in';
  setTimeout(() => {
    spinner.style.opacity = '1';
  }, 10);
  block.appendChild(spinner);
  let srAnnouncement = block.parentNode.querySelector('.sr-only[aria-live="assertive"]');

  if (!srAnnouncement) {
    srAnnouncement = html`<div class="sr-only" aria-live="assertive">${getPlaceholder('Search results are loading')}</div>`;
    block.after(srAnnouncement);
  } else {
    srAnnouncement.textContent = getPlaceholder('Search results are loading');
  }
  return spinner;
}

export function hideLoader(block) {
  toggleContentVisibility(block, false);
  block.innerHTML = '';
  const srAnnouncement = block.parentNode.querySelector('.sr-only[aria-live="assertive"]');
  if (srAnnouncement) {
    setTimeout(() => {
      srAnnouncement.remove();
    }, 500);
  }
}

export default async function decorate(block) {
  block.loading = () => showLoader(block);
  block.loaded = () => hideLoader(block);
  const determineLoading = (isLoading) => {
    if (isLoading && block.parentNode.classList.contains('results-wrapper')) {
      block.loading(); // only listen for controller load state to start loading.
    }
  };

  window.addEventListener('searchResults:Updated', () => {
    block.loaded(); // listen for render complete event to hide loader.
  });

  showLoader(block);

  const contentController = await getContentController();
  const commerceController = await getCommerceController();
  commerceController.search.subscribe(async () => {
    const { isLoading } = commerceController.search.state;
    determineLoading(isLoading || !commerceController.active);
  });
  contentController.results.subscribe(async () => {
    const { isLoading } = contentController.results.state;
    determineLoading(isLoading || !contentController.active);
  });
}
