import {
  html, getPlaceholder, decorateIcons,
  preserveFocus,
} from '../../../scripts/aem.js';
import { getCommerceController } from '../../../scripts/coveo/headless/commerce/index.js';
import {
  getContentController,
} from '../../../scripts/coveo/headless/index.js';
import { flattenNestedFacetValues, getFiltersPlaceholder } from '../../../scripts/coveo/utils.js';

const getController = async (tabId) => {
  if (tabId === 'products') {
    return getCommerceController();
  }

  return getContentController();
};

const setNextFocusTarget = (facetId, name, block) => {
  const focusedElement = document.activeElement;
  const currentSelectedPill = block.querySelector(`[data-name="${facetId}"][data-value="${name}"]`);
  const currentSelectedPillBtn = currentSelectedPill?.querySelector('.close-btn');

  if (!currentSelectedPill || focusedElement !== currentSelectedPillBtn) {
    return;
  }

  const pillsList = currentSelectedPill.closest('.applied-filters__list');
  if (!pillsList) {
    return;
  }

  const visibleBtns = Array.from(pillsList.querySelectorAll('.tag:not(.hidden) .close-btn'));
  const idx = visibleBtns.indexOf(currentSelectedPillBtn);
  let focusTargetSelector = null;
  let focusTargetIdx = null;

  if (visibleBtns.length > 1 && idx < visibleBtns.length - 1) {
    focusTargetIdx = idx + 1;
  } else if (idx > 0) {
    focusTargetIdx = idx - 1;
  }

  if (focusTargetIdx !== null) {
    const dName = visibleBtns[focusTargetIdx].parentElement.getAttribute('data-name');
    const dValue = visibleBtns[focusTargetIdx].parentElement.getAttribute('data-value');

    focusTargetSelector = `[data-name="${dName}"][data-value="${dValue}"] .close-btn`;

    const focusTarget = block.querySelector(focusTargetSelector);

    focusTarget?.focus();
  }
};

const buildPill = (filter, onClose) => {
  const { facetId } = filter.facet;
  const { value } = filter.value;
  const pill = html`
   <div class="tag--light-gray tag tag--light tag--rounded" data-name="${facetId}" data-value="${value}">
      <span class="applied-filters__name">${filter.displayName}: </span>
      <span class="applied-filters__value">${filter.displayValue}</span>
      <button class="close-btn alert-close" role="button" tabindex="0" aria-label="${filter.displayName}: ${filter.displayValue} ${getPlaceholder('Clear filter')}">
        <span class="icon icon-close"></span>
      </button>
    </div>
  `;
  const closeButton = pill.querySelector('.close-btn');

  decorateIcons(pill);
  closeButton.addEventListener('click', () => {
    onClose(filter.facet, filter.value);
  });

  return pill;
};

const buildClearAll = (clearAll) => {
  const clearButton = html`
    <button class="agt-link applied-filters__clear-all" aria-label="${getPlaceholder('Clear All')} filter">${getPlaceholder('Clear All')}</button>
  `;
  clearButton.addEventListener('click', () => {
    clearAll();
  });
  return clearButton;
};

const showAllFilters = (block, data, onClose, clearAll) => {
  block.innerHTML = '';
  const allFilters = html`
    <div class="applied-filters__list applied-filters__list--modal">
      ${data.map((filter) => buildPill(filter, onClose, block))}
      ${buildClearAll(clearAll)}
      <button class="agt-link applied-filters__show-less" aria-label="${getPlaceholder('Show Less')} filter">${getPlaceholder('Show Less')}</button>
    </div>
  `;
  block.append(allFilters);
  // Add event for Show Less
  const showLessBtn = block.querySelector('.applied-filters__show-less');
  if (showLessBtn) {
    showLessBtn.addEventListener('click', () => {
      // eslint-disable-next-line no-use-before-define
      buildActiveFilters(block, { data, onClose, clearAll });
    });
  }
};

const buildActiveFilters = (block, { data, onClose, clearAll }) => {
  block.innerHTML = '';
  const container = document.createElement('div');
  container.className = 'applied-filters__list';

  // Render all pills
  const pills = data.map((filter) => buildPill(filter, onClose, block));
  pills.forEach((pill) => container.appendChild(pill));

  // Add Clear All button (always at the end, but only if there are filters)
  let clearAllBtn = null;
  if (data.length > 0) {
    clearAllBtn = buildClearAll(clearAll);
    container.appendChild(clearAllBtn);
  }

  // Only apply +N logic for desktop (width > 1025px)
  const isDesktop = window.matchMedia('(min-width: 1025px)');

  block.appendChild(container);

  pills.forEach((pill) => pill.classList.remove('hidden'));
  if (clearAllBtn) clearAllBtn.classList.remove('hidden');

  if (isDesktop.matches) {
    // Dynamically get gap between pills from flexbox or margin
    let gap = 0;
    let margin = 0;
    if (pills.length > 1) {
      const pillStyle = getComputedStyle(pills[0]);
      gap = parseInt(getComputedStyle(container).gap || '0', 10);
      margin = parseInt(pillStyle.marginRight || '0', 10);
    }
    let totalWidth = (clearAllBtn ? clearAllBtn.offsetWidth : 0);
    const maxWidth = container.offsetWidth || block.offsetWidth;
    let lastVisibleIndex = pills.length - 1;
    for (let i = 0; i < pills.length; i += 1) {
      totalWidth += pills[i].offsetWidth + gap + margin;
      if (totalWidth > maxWidth) {
        lastVisibleIndex = i - 1;
        break;
      }
    }
    const overflowCount = pills.length - (lastVisibleIndex + 1);
    if (overflowCount > 0) {
      for (let i = lastVisibleIndex + 1; i < pills.length; i += 1) {
        pills[i].classList.add('hidden');
      }
      // Add +N overflow tag before clearAllBtn
      const overflowTag = html`
        <span
          class="applied-filters__overflow"
          aria-label="${overflowCount} filter${overflowCount > 1 ? 's' : ''}"
          tabindex="0" role="button"
        >
          +${overflowCount}
        </span>
      `;

      overflowTag.addEventListener('click', () => {
        showAllFilters(block, data, onClose, clearAll);
        const allBtns = block.querySelectorAll('.close-btn');
        if (allBtns.length > lastVisibleIndex + 1) {
          allBtns[lastVisibleIndex + 1].focus();
        }
      });

      overflowTag.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          showAllFilters(block, data, onClose, clearAll);
          const allBtns = block.querySelectorAll('.close-btn');
          if (allBtns.length > lastVisibleIndex + 1) {
            allBtns[lastVisibleIndex + 1].focus();
          }
        }
      });

      if (clearAllBtn) {
        container.insertBefore(overflowTag, clearAllBtn);
      } else {
        container.appendChild(overflowTag);
      }
    }
  }

  // Remove any previous resize handler before adding a new one
  if (block.resizeHandler) {
    window.removeEventListener('resize', block.resizeHandler);
  }
  let resizeTimeout;
  block.resizeHandler = () => {
    clearTimeout(resizeTimeout);
    resizeTimeout = setTimeout(() => {
      buildActiveFilters(block, { data, onClose, clearAll });
    }, 150);
  };
  isDesktop.addEventListener('resize', block.resizeHandler);
};

const getActiveFilters = (facets) => facets.reduce((accFacet, facet) => {
  const flatterFacets = flattenNestedFacetValues(facet.values);
  const activeFacetOption = [];

  if (flatterFacets.length > 0) {
    activeFacetOption.push(...flatterFacets.filter((i) => i.state !== 'idle').map((i) => ({
      facet,
      value: i,
      displayValue: getFiltersPlaceholder(i.value),
      displayName: getFiltersPlaceholder(facet.displayName || facet.facetId),
    })));
  }

  accFacet.push(...activeFacetOption);
  return accFacet;
}, []);

export default async function decorate(block) {
  const currentTabId = block.dataset.tabName;
  const controller = await getController(currentTabId);

  controller.addFacetChangeListener((data) => {
    const { facets, tabId } = data;
    if (tabId !== currentTabId) {
      return;
    }
    const activeFilters = getActiveFilters(facets);
    const onClose = (facet, item) => {
      const { facetId } = facet;
      const name = item.value;

      setNextFocusTarget(facetId, name, block);

      const isMobileorTablet = window.matchMedia('(max-width: 1024px)').matches;
      if (isMobileorTablet) {
        block.dataset.shouldScroll = 'true';
      }
      controller.toggleFacetValue(facetId, name);
    };

    const clearAll = () => {
      controller.clearAllFacets();
      // settig focus on first product link after clearing a filter
      block.closest('.search-results__items').querySelector('.search-results__product-wrapper a:not([aria-hidden="true"])').focus();
    };

    const restoreFocusPosition = preserveFocus(block);

    buildActiveFilters(block, { data: activeFilters, onClose, clearAll });

    // Handle scroll after rebuild is complete
    if (block.dataset.shouldScroll === 'true') {
      block.dataset.shouldScroll = 'false';
      const isMobileorTablet = window.matchMedia('(max-width: 1024px)').matches;
      if (isMobileorTablet) {
        // Use requestAnimationFrame to ensure DOM is fully rendered
        requestAnimationFrame(() => {
          const filtersList = block.querySelector('.applied-filters__list');
          if (filtersList) {
            filtersList.scrollTo({
              left: 0,
              behavior: 'smooth',
            });
          }
        });
      }
    }

    if (restoreFocusPosition) {
      restoreFocusPosition();
    }
  });
}
