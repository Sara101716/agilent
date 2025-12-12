import { getPlaceholder } from '../../../scripts/aem.js';
import { getContentController } from '../../../scripts/coveo/headless/index.js';
import { getCommerceController } from '../../../scripts/coveo/headless/commerce/index.js';
import { updateBreadcrumbQuery } from '../../breadcrumb/breadcrumb.js';

export default async function decorate(block) {
  block.innerHTML = `
    <h1 class="query">&nbsp;</h1>
    <p class="suggest">&nbsp;</p>
  `;
  const queryDiv = block.querySelector('.query');
  const suggestDiv = block.querySelector('.suggest');

  const searchInsteadPlaceholder = await getPlaceholder('Search instead for', '{0}');
  const [beforeLinkText = '', afterLinkText = ''] = searchInsteadPlaceholder.split('{0}');

  const commerceController = await getCommerceController();
  const contentController = await getContentController();

  const section = block.closest('.section');

  const update = async () => {
    const {
      active,
      summary,
      didYouMean,
    } = section.getCurrentTabId?.() === 'products' ? commerceController : contentController;
    const {
      updateState,
    } = section.getCurrentTabId?.() === 'products' ? contentController : commerceController;

    if (!active) {
      return;
    }

    queryDiv.textContent = await getPlaceholder('Results for', summary?.state?.query);

    const url = new URL(window.location.href);
    if (didYouMean?.state?.wasAutomaticallyCorrected) {
      suggestDiv.classList.remove('hidden');
      suggestDiv.innerHTML = await getPlaceholder('Search was corrected from', didYouMean?.state?.originalQuery);
      url.searchParams.set('q', summary?.state?.query);
      window.history.replaceState(window.history.state, '', url.href);
      // Update breadcrumb value with the suggested term clicked
      const breadCrumbList = document.querySelector('.breadcrumb__list');
      updateBreadcrumbQuery(breadCrumbList, summary?.state?.query, true);
      updateState();
    } else if (didYouMean?.state?.hasQueryCorrection) {
      const { correctedQuery } = didYouMean?.state?.queryCorrection || {};
      const searchInsteadLabel = await getPlaceholder('Search instead for', correctedQuery);
      url.searchParams.set('q', correctedQuery);
      suggestDiv.innerHTML = `${beforeLinkText}<a role="status" aria-live="polite" tabindex="0">${correctedQuery}</a>${afterLinkText}`;
      const link = suggestDiv.querySelector('a');
      if (link) {
        link.href = url.href;
        link.setAttribute('aria-label', searchInsteadLabel);
        link.addEventListener('click', async (e) => {
          e.preventDefault();
          didYouMean.applyCorrection();
          updateState();
          // Update breadcrumb value with the suggested term clicked
          const breadCrumbList = document.querySelector('.breadcrumb__list');
          updateBreadcrumbQuery(breadCrumbList, correctedQuery, true);
        });
      }
    } else {
      suggestDiv.innerHTML = '&nbsp;';
    }
  };

  // Handling Breadcrumb on browser back button
  window.addEventListener('popstate', () => {
    const url = new URL(window.location.href);
    const query = url.searchParams.get('q');
    if (query) {
      const breadCrumbList = document.querySelector('.breadcrumb__list');
      updateBreadcrumbQuery(breadCrumbList, query, true);
    }
  });

  update();
  contentController.didYouMean.subscribe(() => update());
  commerceController.search.didYouMean().subscribe(() => update());
  section.addEventListener('searchResultTabSelected', () => update());
}
