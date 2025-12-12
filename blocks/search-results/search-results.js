import {
  html,
  getPlaceholder,
  decorateBlock,
  loadBlock,
  readBlockConfig,
  toCamelCase,
  decorateIcons,
  getLocale,
  loadEnvConfig,
  isLoggedIn,
} from '../../scripts/aem.js';
import {
  getCommerceController,
} from '../../scripts/coveo/headless/commerce/index.js';
import {
  getContentController,
} from '../../scripts/coveo/headless/index.js';
import { fetchFacetsConfig } from '../../scripts/coveo/utils.js';
import { fetchEcomEnabled, isPartECSaleable } from '../../scripts/services/atg.api.js';

export const SEARCH_RESULT_LAYOUT = {
  LIST: 'list',
  GRID: 'grid',
  CONFIG: 'selected-product-view',
};

let blockConfig;

const finalizeTimers = new Map();
const lastProcessedUid = new Map();
const pendingMiddlePromos = new Map();
let currentPromoSearchUid = null;

function getAgilentSparkIconAttribute(config) {
  if (!config) return '';
  if (typeof config === 'object') {
    return JSON.stringify(config).replace(/"/g, '&quot;');
  }
  return config;
}

function scheduleFinalize(tabId, fn, wait = 100) {
  const prevTimer = finalizeTimers.get(tabId);
  if (prevTimer) clearTimeout(prevTimer);
  const newTimer = setTimeout(fn, wait);
  finalizeTimers.set(tabId, newTimer);
}

function getProductResultLayout(id) {
  if (id === 'products') {
    const previousSetConfig = window.localStorage.getItem(SEARCH_RESULT_LAYOUT.CONFIG);
    return previousSetConfig || SEARCH_RESULT_LAYOUT.GRID;
  }
  return SEARCH_RESULT_LAYOUT.LIST;
}

function formatNumber(num) {
  if (typeof num !== 'number') return num;
  if (num < 1000) return num;
  const { languageCountry } = getLocale() || {};
  try {
    return num.toLocaleString(languageCountry);
  } catch (e) {
    return num.toLocaleString();
  }
}

async function buildSortConfig(id) {
  const prefixes = [
    'sort',
    `${id}Sort`,
  ];

  const envConfig = await loadEnvConfig();
  const mergedConfig = { ...envConfig, ...blockConfig };
  return Object.keys(mergedConfig)
    .filter((key) => prefixes.some((prefix) => key.startsWith(prefix)))
    .reduce((config, key) => {
      config[toCamelCase(key.replace(prefixes.find((prefix) => key.startsWith(prefix)), '') || 'sort')] = mergedConfig[key];
      return config;
    }, {});
}

async function buildTab(id, filtersConfig) {
  const viewSelect = id === 'products' ? `
    <div class="view-selection">
      <button class="grid-select" data-view="grid" aria-label="${getPlaceholder('Grid View')}" aria-pressed="${getProductResultLayout(id) === SEARCH_RESULT_LAYOUT.GRID}"></button>
      <button class="list-select" data-view="list" aria-label="${getPlaceholder('List View')}" aria-pressed="${getProductResultLayout(id) === SEARCH_RESULT_LAYOUT.LIST}"></button>
    </div>
  ` : '';

  let genAnswerBlockEl = '';
  if (id === 'documentsSupport') {
    genAnswerBlockEl = html`<div class="search-results__generated-answer block"></div>`;
    genAnswerBlockEl.dataset.blockConfig = JSON.stringify(blockConfig);
  }

  const tabContentEl = html`
    <div class="search-results__tab-content hidden" data-tab-content="${id}" aria-labelledby="${id}-tab" role="tabpanel" data-engine-type="${id === 'products' ? 'commerce' : 'content'}">
      <div class="search-results__filters-wrapper">
        <div class="search-results__loading block"></div>
        <div class="search-results__filters block" data-tab-name="${id}"></div>
      </div>
      <div class="search-results__items block ${getProductResultLayout(id)}">
        <div class="controls__container">
          <div class="num-results" aria-live="polite" aria-atomic="true"></div>
          <button class="filter-toggle" aria-label="Toggle Filters"></button>
          <div class="search-results__sort block"></div>
          ${viewSelect}
          <div class="search-results__applied-filters block" data-tab-name="${id}"></div>
        </div>
        ${genAnswerBlockEl}
        ${id !== 'products' ? '<div class="promo-spot top"></div>' : ''}
        <div class="results-wrapper">
          <div class="search-results__loading block"></div>
          <div class="results" data-agilent-spark-icon="${getAgilentSparkIconAttribute(blockConfig.agilentSparkIcon)}"></div>
        </div>
        ${id !== 'products' ? '<div class="promo-spot bottom"></div>' : ''}
        <div class="search-results__pagination block"></div>
      </div>
    </div>
  `;
  tabContentEl.querySelector('.search-results__filters').dataset.filtersConfig = JSON.stringify(filtersConfig);
  tabContentEl.querySelector('.search-results__sort').dataset.config = JSON.stringify(await buildSortConfig(id));
  const loaders = tabContentEl.querySelectorAll('.search-results__loading');
  loaders.forEach((loader) => loader.loading?.());
  return tabContentEl;
}

async function checkForAlertMessageText(placeholder) {
  const alertContainer = document.createElement('div');
  alertContainer.classList.add('search-results__hcm-alert');

  const alertBlock = html`
    <div class="alert alert-danger no-close" role="region" aria-label="Alert Banner">
      <p>
        <span class="icon icon-info"></span>
        <span>${placeholder}</span>
      </p>
    </div>
  `;

  alertContainer.innerHTML = '';
  alertContainer.appendChild(alertBlock);
  const resultsWrapper = document.querySelector('.results-wrapper');
  resultsWrapper.parentNode.insertBefore(alertContainer, resultsWrapper);
  decorateBlock(alertBlock);
  await loadBlock(alertBlock);
}

const checkForAlertMessage = async () => {
  const ecomEnabled = await fetchEcomEnabled();
  if ((!ecomEnabled && !isLoggedIn()) || (isLoggedIn() && ecomEnabled == null)) {
    checkForAlertMessageText(getPlaceholder('NON ECOM'));
  }
  if (ecomEnabled === 'hybrid' && !isLoggedIn()) {
    checkForAlertMessageText(getPlaceholder('ECOM HYBRID'));
  }
};

function selectTab(block, id) {
  [...block.children].forEach((content) => {
    if (content.dataset.tabContent === id) {
      content.classList.remove('hidden');
    } else {
      content.classList.add('hidden');
    }
  });
}

function setAttributesToTabConentElement(element, requestId, count) {
  const searchId = element.getAttribute('data-search-id');

  if (!searchId || (searchId && searchId !== requestId)) {
    element.setAttribute('data-search-id', requestId);
    element.setAttribute('data-no-of-results', count);
  }
}

function toggleChildSections(items, show = false) {
  if (!items) return;
  const selectors = [
    '.controls__container',
    '.search-results__applied-filters',
    '.search-results__generated-answer',
    '.promo-spot.top',
    '.promo-spot.bottom',
    '.search-results__pagination',
  ];

  selectors.forEach((selector) => {
    const elements = items.querySelectorAll(selector);
    elements.forEach((el) => {
      if (!show) {
        el.style.display = 'none';
      } else {
        el.style.display = '';
      }
    });
  });

  const basicsWrapper = document.querySelector('.search-results__basics-wrapper');
  if (basicsWrapper) {
    const basicsChildren = basicsWrapper.querySelectorAll('.query, .suggest');
    basicsChildren.forEach((child) => {
      child.style.display = show ? '' : 'none';
    });
  }
}

async function injectMiddlePromos(block) {
  const contentController = await getContentController();
  const activeTab = contentController.tabs.find((tab) => tab.controller.state.isActive);
  if (!activeTab) return;
  const tabId = activeTab.id;

  const promos = pendingMiddlePromos.get(tabId);
  if (!promos || promos.length === 0) return;

  const tabEl = block.querySelector(`[data-tab-content="${tabId}"]`);
  if (!tabEl) return;

  const resultsContainer = tabEl.querySelector('.results');
  if (!resultsContainer) return;

  const currentResultEls = resultsContainer.querySelectorAll('[data-result]');
  if (currentResultEls.length === 0) return;

  const middleIndex = Math.floor(currentResultEls.length / 2);
  const refNode = currentResultEls[middleIndex];

  resultsContainer.querySelectorAll('.promo-spot.middle').forEach((el) => el.remove());
  const promoEl = promos[0];
  if (promoEl && !promoEl.isConnected) {
    const promoContainerEl = html`<div class="promo-spot middle">${promoEl}</div>`;
    resultsContainer.insertBefore(promoContainerEl, refNode);
  }
}

async function activatePromosForTab(block) {
  const contentController = await getContentController();
  const { activatePromos } = contentController;
  activatePromos(async (triggerContent) => {
    const activeTab = contentController.tabs.find((tab) => tab.controller.state.isActive);
    if (!activeTab) return;
    const tabId = activeTab.id;
    const tabEl = block.querySelector(`[data-tab-content="${tabId}"]`);
    if (!tabEl) return;

    const newUid = contentController.results.state.searchUid;
    if (newUid !== currentPromoSearchUid) {
      currentPromoSearchUid = newUid;
      tabEl.querySelectorAll('.promo-spot.top, .promo-spot.bottom').forEach((el) => { el.innerHTML = ''; });
      pendingMiddlePromos.set(tabId, []);
    }

    if (!triggerContent) {
      return;
    }
    const promoJSON = JSON.parse(triggerContent);
    let promoPath;
    let position;
    if (promoJSON?.url) {
      promoPath = promoJSON.url;
    }
    if (promoJSON?.position) {
      position = promoJSON.position.toLowerCase();
    }
    const resp = await fetch(`${promoPath}.plain.html`);

    if (resp.ok) {
      const promoMarkup = await resp.text();
      const promoEl = html`${promoMarkup}`;
      const blockEl = promoEl.querySelector('.search-promoted');
      blockEl.classList.add('block');
      blockEl.dataset.blockName = 'search-promoted';

      if (position === 'middle') {
        pendingMiddlePromos.set(tabId, [promoEl]);
        injectMiddlePromos(block);
      } else {
        const promoSpotEl = tabEl.querySelector(`.promo-spot.${position}`) || tabEl.querySelector('.promo-spot.top');
        if (promoSpotEl) {
          promoSpotEl.innerHTML = '';
          promoSpotEl.appendChild(promoEl);
        }
      }
      await loadBlock(blockEl);
      decorateIcons(blockEl);
    }
  });
}

async function renderResultsOrNull({ items, type, tab }) {
  try {
    const baseUrl = blockConfig?.[type];
    const url = baseUrl ? `${baseUrl}.plain.html` : null;
    if (url) {
      const resp = await fetch(url);
      if (!resp.ok) return;

      const nullResultsMarkup = await resp.text();
      if (!nullResultsMarkup) return;

      const noResultsEl = html`${nullResultsMarkup}`;
      noResultsEl.classList.add('null-results-wrapper');
      if (noResultsEl) {
        const resultsContainer = tab === 'products' ? items : items.querySelector('.results');

        // The elements should be hidden rather than removed, because if the second or third tab
        // is initially active, the products tab has no results and displays null results.
        // However, after switching to the first tab, a request is made and the elements we are
        // hiding here are needed to render the results. (The elements will be shown again thanks
        // to the update function)
        Array.from(resultsContainer.children).forEach((child) => {
          child.style.display = 'none';
        });

        resultsContainer.append(noResultsEl);
        // Hide filter section if no results found
        const filtersSection = items.closest('.search-results__tab-content')?.querySelector('.search-results__filters-wrapper');
        if (filtersSection) {
          filtersSection.classList.add('hidden');
        }
        const promises = Array.from(noResultsEl.children).map(async (child) => {
          if (child.tagName === 'DIV') {
            child.classList.add('block');
            const firstClass = child.classList.item(0);
            if (firstClass) {
              child.dataset.blockName = firstClass;
            }
            await loadBlock(child);
            decorateIcons(child);
          }
        });
        await Promise.all(promises);
      }
    }
  } catch (e) {
    // eslint-disable-next-line no-console
    console.error('Failed no results block', e);
  }
}

async function update(block, items, results) {
  let isFocusInBlock = false;

  // if the focus is within the product results, we want to maintain focus after re-rendering
  // it will be set to the first focusable element after rendering
  if (block.querySelector('.search-results__product-wrapper')?.contains(document.activeElement)) {
    isFocusInBlock = true;
  }
  await items.render(results);
  await injectMiddlePromos(block);
  window.dispatchEvent(new CustomEvent('searchResults:Updated'));
  toggleChildSections(items, true);
  // reseting any hidden children - elements could be hidden from the null results view
  [...items.children].forEach((el) => { el.style.display = ''; });
  items.querySelector('.null-results-wrapper')?.remove();

  if (isFocusInBlock) {
    const firstFocusable = items.querySelector('a:not([aria-hidden="true"]');

    if (firstFocusable) {
      firstFocusable.focus();
    }
  }
}

export default async function decorate(block) {
  blockConfig = readBlockConfig(block);
  block.dataset.blockConfig = JSON.stringify(blockConfig);
  const facetsConfigs = await fetchFacetsConfig();

  block.innerHTML = '';

  const commerceController = await getCommerceController();
  const contentController = await getContentController();

  const tabs = ['products', ...contentController.tabs.map((tab) => tab.id)];

  const tabContentEls = await Promise.all(
    tabs.map(async (id) => {
      const tabContentEl = await buildTab(
        id,
        facetsConfigs[`config-${id}`] || {},
      );
      await Promise.all(
        [...tabContentEl.querySelectorAll('.block')].map(async (child) => {
          decorateBlock(child, true);
          await loadBlock(child);
        }),
      );
      tabContentEl.querySelector('button.filter-toggle').addEventListener('click', () => tabContentEl.querySelector('.search-results__filters')?.onFilterToggle?.());
      return tabContentEl;
    }),
  );

  tabContentEls.forEach((tabContentEl) => block.append(tabContentEl));

  checkForAlertMessage();

  const section = block.closest('.section');

  section?.addEventListener('searchResultTabSelected', (e) => {
    const { tabId } = e?.detail || {};
    if (!tabId) return;
    selectTab(block, tabId);

    const activeTab = block.querySelector(`[data-tab-content="${tabId}"]`);
    if (!activeTab) return;

    const items = activeTab.querySelector('.search-results__items');
    if (!items) return;

    const hasNullResults = !!activeTab.querySelector('.null-results');
    const hasResults = !!activeTab.querySelector('.results > *:not(.null-results)');

    if (!hasResults) {
      const loaders = activeTab.querySelectorAll('.search-results__loading');
      loaders?.forEach((loader) => { loader?.loading(); });
    }

    toggleChildSections(items, hasResults && !hasNullResults);
  });

  const currentTabId = section?.getCurrentTabId?.();
  if (currentTabId) {
    selectTab(block, currentTabId);
  }

  commerceController.search.subscribe(async () => {
    const results = commerceController.search.state.products;
    const tabEl = block.querySelector('[data-tab-content="products"]');
    if (!tabEl) return;
    const items = tabEl.querySelector('.search-results__items');
    if (!items) return;

    const resultsSummaryEls = tabEl.querySelectorAll('.num-results');
    const { requestId } = commerceController.search.state;
    const { isLoading } = commerceController.search.state;

    const totalFromCommerce = commerceController.pagination.state.totalEntries
      ?? commerceController.summary.state.totalNumberOfProducts
      ?? 0;

    if (tabEl && !isLoading && requestId) {
      setAttributesToTabConentElement(tabEl, requestId, totalFromCommerce);
    }

    resultsSummaryEls.forEach((el) => {
      const label = document.querySelector('[data-tab-id="products"]')?.textContent?.trim() || 'Products';
      const count = totalFromCommerce;
      const formatted = formatNumber(count);
      el.textContent = isLoading ? '' : getPlaceholder('Showing results in', formatted, label);
    });

    if (isLoading) {
      return;
    }

    if (totalFromCommerce > 0 && Array.isArray(results) && results.length > 0) {
      update(block, items, results);
    } else if (totalFromCommerce === 0) {
      toggleChildSections(items, false);
      await renderResultsOrNull({ items, type: 'noResultsPath', tab: 'products' });
    }
  });

  commerceController.searchResultsWithPrice.subscribe(async (productsWithPrice) => {
    productsWithPrice.forEach((product) => {
      if (isPartECSaleable(product)) {
        window.dispatchEvent(new CustomEvent(`product:updatePriceInfo-${product.ec_product_id}`, { detail: product }));
      }
    });
  });

  contentController.results.subscribe(async () => {
    const activeTab = contentController.tabs.find((tab) => tab.controller.state.isActive);
    if (!activeTab) return;

    const { id } = activeTab;
    const tabEl = block.querySelector(`[data-tab-content="${id}"]`);
    const items = tabEl?.querySelector('.search-results__items');
    if (!items || !tabEl) return;

    items.dataset.blockConfig = JSON.stringify(blockConfig);
    const { searchResponseId } = contentController.results.state;
    const isLoading = !contentController.active || contentController.results.state.isLoading;
    const { total } = contentController.summary.state;
    let tabLabel = document.querySelector(`[data-tab-id="${id}"]`)?.textContent?.trim();
    const resultsSummaryEls = tabEl.querySelectorAll('.num-results');
    const searchHeader = document.querySelector('.search-header h1');

    if (searchHeader) {
      tabLabel = searchHeader?.textContent || '';
    }

    resultsSummaryEls.forEach((el) => {
      const formatted = formatNumber(total);
      el.textContent = isLoading ? '' : getPlaceholder('Showing results in', formatted, tabLabel);
    });

    const resultsNow = contentController.results.state.results;

    if (!isLoading) {
      if (total > 0 && resultsNow.length > 0) {
        update(block, items, resultsNow);
      } else if (total === 0) {
        toggleChildSections(items, false);
        await renderResultsOrNull({
          items,
          type: 'noResultsPath',
          tab: 'educationOrDocuments',
        });
      }
    }

    if (!isLoading && searchResponseId) {
      setAttributesToTabConentElement(tabEl, searchResponseId, total);
    }

    scheduleFinalize(
      id,
      async () => {
        const latestState = contentController.results.state;
        const latestIsLoading = !contentController.active || latestState.isLoading;
        if (latestIsLoading) return;

        const uid = latestState.searchResponseId || latestState.searchUid;
        if (!uid || lastProcessedUid.get(id) === uid) return;

        const finalTotal = contentController.summary.state.total || 0;

        if (finalTotal === 0) {
          toggleChildSections(items, false);
          const container = items.querySelector('.results') || items;
          if (!container.querySelector('.null-results')) {
            await renderResultsOrNull({
              items,
              type: 'noResultsPath',
              tab: 'educationOrDocuments',
            });
          }
          window.dispatchEvent(new CustomEvent('searchResults:Updated'));
        }

        lastProcessedUid.set(id, uid);
      },
      100,
    );
  });

  await activatePromosForTab(block);
}
