import {
  decorateIcons,
  getPlaceholder,
  html,
  generateId,
  rememberPlace,
  decorateTooltips,
  preserveFocus,
  loadIcon,
} from '../../../scripts/aem.js';
import { getCommerceController } from '../../../scripts/coveo/headless/commerce/index.js';
import { getContentController } from '../../../scripts/coveo/headless/index.js';
import { getFiltersPlaceholder } from '../../../scripts/coveo/utils.js';

let analyticsPromise = null;
const getAnalytics = () => {
  if (!analyticsPromise) {
    analyticsPromise = import('./filter.analytics.js').catch((e) => {
      console.error('Analytics module failed to load:', e);

      return { trackFilterEvents: () => {} };
    });
  }
  return analyticsPromise;
};

const getDefaultFilterSettings = {
  isDisabled: 'false',
  isExpanded: 'false',
  hasHelpText: 'false',
  hasSearch: 'false',
  showAllValues: false,
};

const desktopMediaQuery = window.matchMedia('(min-width: 1024px)');
const hasSelected = (obj) => {
  if (obj.isSelected === true) return true;
  if (Array.isArray(obj.children)) {
    return obj.children.some((child) => hasSelected(child));
  }
  return false;
};

const isDesktop = () => desktopMediaQuery.matches;

const getController = async (tabId) => {
  if (tabId === 'products') {
    return getCommerceController();
  }

  return getContentController();
};

const openAsModal = (el, tabName, engineType, onClose) => {
  const restoreElement = rememberPlace(el);

  const dialog = html`
    <dialog class="filters__dialog" data-tab-name="${tabName || ''}" data-engine-type="${engineType || ''}">
      ${el}
    </dialog>
  `;

  document.body.append(dialog);

  dialog.addEventListener('close', () => {
    restoreElement();
    dialog.remove();
    onClose?.();
  });

  dialog.addEventListener('click', (event) => {
    if (event.target === dialog) {
      dialog.close();
    }
  });

  dialog.showModal();
};

const buildAccordion = (label, content, isExpanded, dataName = '') => html`
  <details class="filters__accordion" ${isExpanded ? 'open' : ''} data-name="${dataName}">
    <summary class="filters__accordion-summary">
      <h3 class="filters__accordion-title">${label}</h3>
      <div class="filters__accordion-icon-wrapper">
        <span class="icon icon-minus filters__accordion-icon--opened" aria-hidden="true"></span>
        <span class="icon icon-plus filters__accordion-icon--closed" aria-hidden="true"></span>
      </div>
    </summary>
    <div class="filters__accordion-content">
      ${content}
    </div>
  </details>
`;

const createSearchInput = (searchPlaceholder, onSearch) => {
  const searchInputId = generateId('search-input');
  const searchInput = html`
    <div class="agt-input__wrapper">
      <div class="agt-input__container">
        <label class="agt-input__label" for="${searchInputId}">${searchPlaceholder}</label>
        <input type="text" class="agt-input  agt-input--large" placeholder="${searchPlaceholder}" id="${searchInputId}">
        <span class="icon icon-search agt-input__icon--right search-input__search-icon"></span>
        <button class="agt-icon agt-input__icon--right search-input__clear-btn hidden" type="button" aria-label="${getPlaceholder('Clear search input')}">
          <span class="icon icon-close"></span>
        </button>
      </div>
    </div>
  `;

  const searchIcon = searchInput.querySelector('.search-input__search-icon');
  const clearBtn = searchInput.querySelector('.search-input__clear-btn');

  const input = searchInput.querySelector('input');

  input.addEventListener('input', (e) => {
    const searchText = e.target.value;
    const hasText = searchText.trim().length > 0;

    searchIcon.classList.toggle('hidden', hasText);
    clearBtn.classList.toggle('hidden', !hasText);

    onSearch?.(searchText);
  });

  clearBtn.addEventListener('click', () => {
    input.value = '';
    input.focus();
    searchIcon.classList.remove('hidden');
    clearBtn.classList.add('hidden');

    onSearch?.('');
  });

  return searchInput;
};

function registerScrollIntoView() {
  setTimeout(() => {
    const resultsContainer = document
      .querySelector('.search-results__tab-content:not(.hidden) .results');
    if (resultsContainer) {
      const rect = resultsContainer.getBoundingClientRect();
      const isInViewport = rect.top >= 40;
      if (!isInViewport) {
        resultsContainer.scrollIntoView({ behavior: 'instant', block: 'start' });
      }
    }
  }, 50);
}

const createInputOptions = (type, name, options, settings, title) => {
  const MAX_VISIBLE_OPTIONS = 7;
  const inputTypes = {
    radio: 'radio',
    checkboxes: 'checkbox',
    list: 'checkbox',
  };
  const inputType = inputTypes[type] || 'checkbox';
  const hasSeeAll = options.length > MAX_VISIBLE_OPTIONS;
  let searchQuery = '';

  const renderOption = (option, optionId, renderChildrenFunc, extraClasses) => {
    const showBackArrow = type === 'list' && options.some((opt) => hasSelected(opt));
    const labelClass = type === 'list' ? 'filters__list-label' : '';

    const chevronSpan = showBackArrow ? '<span class="icon icon-chevron-left filters__back-icon"></span>' : '';

    const optionEl = html`
        <div class="filters__${type}-option filters__option ${extraClasses}">
          <div class="filters__option-input-wrapper">
            <input type="${inputType}" id="${optionId}" name="${name}" value="${option.key}" ${option.isSelected ? 'checked' : ''}/>
            <label for="${optionId}" class="${labelClass}">
              ${chevronSpan}
              <span class="filters__option-text">${getFiltersPlaceholder(option.title)}</span>
              <span class="filters__quantity" aria-label="${getPlaceholder('Items available', [title, option.quantity])}">(${option.quantity})</span>
            </label>
          </div>
          ${renderChildrenFunc(option.children)}
        </div>
    `;

    const inputEl = optionEl.querySelector('input');

    if (showBackArrow) {
      const backIcon = optionEl.querySelector('.filters__back-icon');
      loadIcon('chevron-left')?.then((svg) => {
        if (backIcon && svg) {
          backIcon.innerHTML = svg;
          backIcon.querySelector('svg')?.setAttribute('aria-hidden', 'true');
        }
      });
    }

    inputEl.addEventListener('change', async () => {
      inputEl.parentElement.classList.add('loading');
      option.onClick({
        name: inputEl.getAttribute('name'),
        value: inputEl.value,
      });
      registerScrollIntoView();

      const { trackFilterEvents } = await getAnalytics();
      trackFilterEvents();
    });

    return optionEl;
  };

  const renderOptionsChildren = (children) => {
    if (!children?.length) {
      return '';
    }

    const renderItem = (child) => {
      const id = generateId(`${type}-${name}`);
      const extraClasses = `filters__option--visible filters__${type}-option-child`;
      return renderOption(child, id, renderOptionsChildren, extraClasses);
    };

    return html`
      <div class="filters__option-children">
        ${children.map(renderItem)}
      </div>
    `;
  };

  const optionsList = options.map((option, index) => {
    const id = generateId(`${type}-${name}`);
    const extraClasses = [
      settings.showAllValues || index < MAX_VISIBLE_OPTIONS ? 'filters__option--visible' : '',
    ].join(' ');

    return renderOption(option, id, renderOptionsChildren, extraClasses);
  });

  const noResults = html`
    <div class="filters__no-results" style="display: none;">
      ${getPlaceholder('No match found')}
    </div>
  `;

  let search = '';

  const resetOptionsVisibility = (maxVisibleItems) => {
    for (const [index, optionEl] of optionsList.entries()) {
      const shouldBeVisible = settings.showAllValues || index < maxVisibleItems;
      optionEl.classList.toggle('filters__option--visible', shouldBeVisible);
    }
    noResults.style.display = 'none';
  };

  const filterOptionsBySearch = (maxVisibleItems) => {
    for (const optionEl of optionsList) {
      optionEl.classList.remove('filters__option--visible');
    }

    const availableOptions = optionsList.filter((optionEl) => {
      const optionText = optionEl.querySelector('.filters__option-text').textContent.toLowerCase();
      const containsTextQuery = optionText.includes(searchQuery);
      const isChecked = optionEl.querySelector('input').checked;
      return containsTextQuery || isChecked;
    });

    for (const optionEl of availableOptions.slice(0, maxVisibleItems)) {
      optionEl.classList.add('filters__option--visible');
    }

    return availableOptions;
  };

  const updateSeeAllButton = (availableOptions) => {
    if (!hasSeeAll) return;

    const seeAllBtn = optionsList[0].closest('.filters__input-options').querySelector('.filters__see-all-btn');
    const shouldHideButton = availableOptions.length <= MAX_VISIBLE_OPTIONS;

    seeAllBtn.style.display = shouldHideButton ? 'none' : '';
    optionsList[0].closest('.filters__input-options').classList.toggle('filters--show-all', !shouldHideButton);
  };

  const updateNoResultsVisibility = () => {
    const hasVisibleOptions = optionsList.some((option) => option.classList.contains('filters__option--visible'));
    noResults.style.display = hasVisibleOptions ? 'none' : '';
  };

  const onSearch = (searchTerm) => {
    const showAll = optionsList[0].closest('.filters--show-all');
    const maxVisibleItems = showAll ? optionsList.length : MAX_VISIBLE_OPTIONS;
    searchQuery = searchTerm.trim().toLowerCase();

    if (searchQuery === '') {
      resetOptionsVisibility(maxVisibleItems);
    } else {
      const availableOptions = filterOptionsBySearch(maxVisibleItems);
      updateSeeAllButton(availableOptions);
      updateNoResultsVisibility();
    }
  };

  const renderSeeAll = () => {
    if (!hasSeeAll) {
      return '';
    }

    const label = settings.showAllValues ? getPlaceholder('See less') : getPlaceholder('See all');

    return html`
      <button class="filters__see-all-btn agt-link agt-link--dark" type="button">
        ${label}
      </button>
    `;
  };

  if (settings.hasSearch === 'true') {
    const placeholder = getPlaceholder('Search for', [title]) ?? `${getPlaceholder('search')} ${title}`;
    search = createSearchInput(placeholder, onSearch);
  }

  const el = html`
    <div class="filters__input-options filters__input-options--${type}">
      ${search}
      ${noResults}
      <fieldset>
        <legend class="filters__options-legend sr-only">
          ${title}
        </legend>
        ${optionsList}
      </fieldset>
      ${renderSeeAll()}
    </div>
  `;
  const seeAllBtn = el.querySelector('.filters__see-all-btn');

  if (seeAllBtn) {
    seeAllBtn.addEventListener('click', () => {
      el.classList.toggle('filters--show-all');

      const showingAll = el.classList.contains('filters--show-all');
      seeAllBtn.textContent = getPlaceholder(showingAll ? 'See less' : 'See all');
      settings.showAllValues = showingAll;
      onSearch(searchQuery);
    });
  }

  return el;
};

const createRadioButtons = (name, options, settings, title) => createInputOptions('radio', name, options, settings, title);

const createCheckboxes = (name, options, settings, title) => createInputOptions('checkbox', name, options, settings, title);

const createListSelector = (name, options, settings, title) => createInputOptions('list', name, options, settings, title);

const renderFilter = (fData, fConfig, lastOpenedAccordionName) => {
  const {
    type, name, filters, title,
  } = fData;
  const helpText = getPlaceholder(`${name.replace('_', ' ')} help text`);
  const configuration = fConfig[name] ?? getDefaultFilterSettings;
  const titleFromPlaceholder = getFiltersPlaceholder(title);
  let filterContent;
  const accordionTitle = html`
    <span>
      ${titleFromPlaceholder}
      ${configuration.hasHelpText === 'true' ? `<span class="icon icon-question filters__help-text-icon" data-tooltip-text="${helpText}"></span>` : ''}
    </span>
  `;

  const isCheckboxTypeFilterWithOnlyOneOption = fData.type === 'checkboxes' && fData.filters.length === 1;

  if (configuration.isDisabled === 'true' || fData.filters.length === 0 || isCheckboxTypeFilterWithOnlyOneOption) {
    return '';
  }

  switch (type) {
    case 'radio':
      filterContent = createRadioButtons(name, filters, configuration, titleFromPlaceholder);
      break;
    case 'checkboxes':
      filterContent = createCheckboxes(name, filters, configuration, titleFromPlaceholder);
      break;
    case 'list':
      filterContent = createListSelector(name, filters, configuration, titleFromPlaceholder);
      break;
    default:
      filterContent = html`<p>Unsupported filter type: ${type}</p>`;
  }

  const isExpanded = configuration.isExpanded === 'true'
    || filters.some((filter) => hasSelected(filter))
    || lastOpenedAccordionName === title;

  return buildAccordion(accordionTitle, filterContent, isExpanded, name);
};

const renderNumberOfResults = () => {
  const el = html`
    <span class="filters__results-number">
    </span>
  `;

  const updateResultsNumber = (num) => {
    el.classList.toggle('hidden', num === 0);

    if (num) {
      el.textContent = `(${num})`;
    } else {
      el.textContent = '';
    }
  };

  return { el, updateResultsNumber };
};

const createSeeResultsButton = () => {
  const el = html`<button class="filters__see-results-btn agt-button" type="button">${getPlaceholder('see results', [0])}</button>`;

  const updateSeeResultsButton = (num) => {
    el.textContent = getPlaceholder('see results', [num]);
  };

  return { el, updateSeeResultsButton };
};

const creatTooltips = async (rootEl) => {
  for (const el of rootEl.querySelectorAll('[data-tooltip-text]')) {
    const focusTargetEl = el.closest('summary');
    const focusTargetId = focusTargetEl.id || generateId('filter-');

    focusTargetEl.id = focusTargetId;
    el.dataset.tooltipFocusTarget = focusTargetId;
  }

  await decorateTooltips(rootEl);
  for (const el of rootEl.querySelectorAll('.filters__accordion-summary')) {
    const tooltipId = el.querySelector('.agt-tooltip')?.getAttribute('id');

    if (tooltipId) {
      el.setAttribute('aria-describedby', tooltipId);
    }
  }
};

const getTabContent = (el) => el?.closest?.('.search-results__tab-content');

const getSortBlock = (scope) => {
  const tabContent = getTabContent(scope);
  return tabContent?.querySelector('.search-results__sort') || document.querySelector('.search-results__sort');
};
const applyPendingSort = (sortBlock) => {
  const pendingIdxRaw = sortBlock?.dataset.pendingSortIndex;
  if (!sortBlock || pendingIdxRaw === undefined) return;

  const idx = Number.parseInt(pendingIdxRaw, 10);
  if (Number.isNaN(idx)) {
    delete sortBlock.dataset.pendingSortIndex;
    return;
  }

  const cselectOptions = sortBlock.querySelectorAll('.cselect__option');
  const selectEl = sortBlock.querySelector('select.sort-by');

  if (cselectOptions?.[idx]) {
    cselectOptions[idx].click();
  } else if (selectEl) {
    selectEl.selectedIndex = idx;
    selectEl.dispatchEvent(new Event('change', { bubbles: true }));
  }

  delete sortBlock.dataset.pendingSortIndex;
};

const mountSortRadioOptions = (sortBlock, container, filtersTabId) => {
  if (filtersTabId === 'products') return;
  const selectEl = sortBlock?.querySelector('select.sort-by');
  if (!selectEl || !container) return;

  // Clear any previous radio render
  container.querySelector('.filters__sort-radio-options')?.remove();

  const radioContainer = html`<div class="filters__sort-radio-options filters__sort-options"></div>`;
  const options = [...selectEl.options];
  const pendingIdxRaw = sortBlock.dataset.pendingSortIndex;
  const pendingIdx = Number.isNaN(Number.parseInt(pendingIdxRaw, 10))
    ? null
    : Number.parseInt(pendingIdxRaw, 10);
  const selectedIndex = Number.isInteger(pendingIdx)
    ? Math.max(0, Math.min(options.length - 1, pendingIdx))
    : Math.max(0, selectEl.selectedIndex);

  const syncSelection = (idx, { clearPending = true } = {}) => {
    const items = radioContainer.querySelectorAll('.filters__sort-option');
    items.forEach((item, itemIdx) => {
      if (itemIdx === idx) {
        item.dataset.sortSelected = 'true';
      } else {
        delete item.dataset.sortSelected;
      }
    });
    if (clearPending) {
      delete sortBlock.dataset.pendingSortIndex;
    }
  };

  options.forEach((opt, idx) => {
    const labelText = opt.textContent.trim();
    const radioOption = html`
      <div class="filters__sort-option" data-sort-index="${idx}" ${idx === selectedIndex ? 'data-sort-selected="true"' : ''}>
        <span class="filters__sort-option-text">${labelText}</span>
      </div>
    `;

    radioOption.addEventListener('click', () => {
      sortBlock.dataset.pendingSortIndex = String(idx);
      syncSelection(idx, { clearPending: false });
    });

    radioContainer.append(radioOption);
  });

  // Keep radios in sync if the select changes elsewhere
  selectEl.addEventListener('change', () => {
    syncSelection(Math.max(0, selectEl.selectedIndex));
  });

  container.append(radioContainer);
};

const getSortBlockInFilters = (placeholderId) => document.querySelector(`#${placeholderId} .search-results__sort`);

const restoreSortBlockPosition = (scope, sortBlockOverride) => {
  const sortBlock = sortBlockOverride || getSortBlock(scope);
  const tabContent = getTabContent(scope);
  const controlsContainer = tabContent?.querySelector('.controls__container') || document.querySelector('.controls__container');

  if (sortBlock && controlsContainer) {
    sortBlock.classList.remove('filters__sort--hidden');
    sortBlock.removeAttribute('aria-hidden');
    sortBlock.classList.remove('sort-in-filters');
    const filterToggle = controlsContainer.querySelector('.filter-toggle');
    if (filterToggle?.nextElementSibling) {
      filterToggle.parentNode.insertBefore(sortBlock, filterToggle.nextElementSibling);
    } else {
      controlsContainer.appendChild(sortBlock);
    }
  }
};

const populateSortRadioButtons = (block) => {
  const sortBlock = getSortBlock(block);
  if (!sortBlock) return;

  const selectElement = sortBlock.querySelector('select.sort-by');
  if (!selectElement || selectElement.options.length === 0) return;

  const dialogSortOptions = document.querySelector('.filters__dialog .filters__sort-options');
  const blockSortOptions = block?.querySelector('.filters__sort-options');
  const sortOptionsContainer = dialogSortOptions ?? blockSortOptions;

  if (!sortOptionsContainer) return;

  sortOptionsContainer.innerHTML = '';

  const selectedIndex = Math.max(0, selectElement.selectedIndex);

  for (const [index, option] of [...selectElement.options].entries()) {
    const isSelected = index === selectedIndex;
    const labelText = option.textContent.trim();

    const radioOption = html`
      <div class="filters__sort-option" data-sort-index="${index}" ${isSelected ? 'data-sort-selected="true"' : ''}>
        <span class="filters__sort-option-text">${labelText}</span>
      </div>
    `;

    radioOption.addEventListener('click', () => {
      const allOptions = sortOptionsContainer.querySelectorAll('.filters__sort-option');
      for (const opt of allOptions) {
        delete opt.dataset.sortSelected;
      }
      radioOption.dataset.sortSelected = 'true';

      selectElement.selectedIndex = index;

      const changeEvent = new Event('change', { bubbles: true });
      selectElement.dispatchEvent(changeEvent);

      const cselectOptions = sortBlock.querySelectorAll('.cselect__option');
      if (cselectOptions[index]) {
        cselectOptions[index].click();
      }

      const dialog = document.querySelector('dialog.filters__dialog');
      if (dialog) {
        dialog.close();
      }
    });

    sortOptionsContainer.appendChild(radioOption);
  }

  const observer = new MutationObserver(() => {
    const currentSelectedIndex = selectElement.selectedIndex;
    const allOptions = sortOptionsContainer.querySelectorAll('.filters__sort-option');
    for (const [idx, opt] of [...allOptions].entries()) {
      if (idx === currentSelectedIndex) {
        opt.dataset.sortSelected = 'true';
      } else {
        delete opt.dataset.sortSelected;
      }
    }
  });

  observer.observe(selectElement, { attributes: true, attributeFilter: ['selectedIndex'] });

  selectElement.addEventListener('change', () => {
    const currentSelectedIndex = selectElement.selectedIndex;
    const allOptions = sortOptionsContainer.querySelectorAll('.filters__sort-option');
    for (const [idx, opt] of [...allOptions].entries()) {
      if (idx === currentSelectedIndex) {
        opt.dataset.sortSelected = 'true';
      } else {
        delete opt.dataset.sortSelected;
      }
    }
  });
};

export default async function decorate(block) {
  const filtersConfig = { ...JSON.parse(block.dataset.filtersConfig), showAllValues: false };
  const { updateResultsNumber } = renderNumberOfResults();
  const { el: seeResultsBtnEl, updateSeeResultsButton } = createSeeResultsButton();
  const clearFiltersEl = html`<button type="button" class="filters__clear-filters agt-link hidden">${getPlaceholder('Clear all')}</button>`;
  const titleLabel = isDesktop() ? getPlaceholder('Filter By') : getPlaceholder('Sort & Filter');
  const filtersTabId = block.dataset.tabName;
  const filtersInputsId = generateId('filters-inputs-');
  const sortPlaceholderId = generateId('sort-placeholder-');

  const coveoFilterItemToUiFilters = (item, facet, controller) => ({
    title: item.value,
    quantity: item.numberOfResults,
    key: item.value,
    isSelected: item.state === 'selected',
    onClick: () => {
      controller.toggleFacetValue(facet.facetId, item.value);
    },
    children: item.children
      ? item.children.map((child) => coveoFilterItemToUiFilters(child, facet, controller))
      : null,
  });

  block.innerHTML = '';
  block.append(html`
    <form class="filters__content">
      <div class="filters__heading">
        <h2>${titleLabel}</h2>${clearFiltersEl}
        <button aria-label="${getPlaceholder('Close filters')}" class="filters__close agt-button" type="button">
          <span class="icon icon-close-square"></span>
        </button>
      </div>
      <div class="filters__inputs" id="${filtersInputsId}">
      </div>
      <div class="filters__see-results-btn-wrapper">
        ${seeResultsBtnEl}
      </div>
    </form>
  `);

  block.closest('.search-results__filters-wrapper').classList.add('hidden');

  const controller = await getController(filtersTabId);
  const engineType = getTabContent(block)?.dataset.engineType || '';
  block.dataset.engineType = engineType;

  controller.addFacetChangeListener((data) => {
    const { facets, tabId, totalResultsCount } = data;

    const filtersContentElInBlock = block.querySelector(`.filters__inputs[id="${filtersInputsId}"]`);
    const filtersContentElInDialog = document.querySelector(`.filters__dialog .filters__inputs[id="${filtersInputsId}"]`);
    const filtersContentEl = filtersContentElInBlock || filtersContentElInDialog;
    const sortBlock = getSortBlock(block);
    const sortWasInFilters = sortBlock?.classList.contains('sort-in-filters');

    if (tabId !== filtersTabId || !filtersContentEl) {
      return;
    }

    block.closest('.search-results__filters-wrapper').classList.remove('hidden');

    const mappedFacets = facets.map((facet) => ({
      id: facet.facetId,
      name: facet.facetId,
      type: facet.type === 'hierarchical' ? 'list' : 'checkboxes',
      title: facet.displayName || facet.facetId,
      tabId,
      filters: facet.values.map((item) => coveoFilterItemToUiFilters(item, facet, controller)),
    }));

    const restoreFocus = preserveFocus(block);
    const lastOpenedAccordionName = document.activeElement.closest('.filters__accordion')?.dataset.name;
    const mappedFilters = mappedFacets.map(
      (fData) => renderFilter(fData, filtersConfig, lastOpenedAccordionName),
    ).filter(Boolean);

    filtersContentEl.innerHTML = '';

    // Add a placeholder accordion to host the real sort block (moved on mobile)
    const sortDropdownId = generateId('mock-sort');
    const sortAccordionTitle = getPlaceholder('Sort By') || 'Sort By';

    const sortAccordion = buildAccordion(
      html`<span>${sortAccordionTitle}</span>`,
      html`<div class="filters__sort-accordion-content" id="${sortDropdownId}"></div>`,
      true,
      'sort',
    );
    sortAccordion.classList.add('filters__sort-accordion');
    sortAccordion.id = sortPlaceholderId;
    filtersContentEl.append(sortAccordion);
    filtersContentEl.append(...mappedFilters);

    const wrapper = block.closest('.search-results__filters-wrapper');
    wrapper.classList.toggle('filters--no-facets', mappedFilters.length === 0);

    // If the sort was already inside the filters when re-rendering, put it back
    if (sortBlock && sortWasInFilters) {
      const sortPlaceholder = filtersContentEl.querySelector(`#${sortPlaceholderId} .filters__sort-accordion-content`);
      if (sortPlaceholder) {
        sortPlaceholder.innerHTML = '';
        sortPlaceholder.appendChild(sortBlock);
        sortBlock.classList.add('sort-in-filters');
        sortBlock.classList.add('filters__sort--hidden');
        sortBlock.setAttribute('aria-hidden', 'true');
        if (filtersTabId === 'products') {
          requestAnimationFrame(() => populateSortRadioButtons(block));
        } else {
          mountSortRadioOptions(sortBlock, sortPlaceholder, filtersTabId);
        }
      }
    }

    decorateIcons(filtersContentEl);
    updateResultsNumber(totalResultsCount);
    updateSeeResultsButton(totalResultsCount);
    creatTooltips(filtersContentEl);

    const isAnyFilterChecked = [...filtersContentEl.querySelectorAll('input[type=checkbox], input[type=radio]')].some((input) => input.checked);

    clearFiltersEl.classList.toggle('hidden', !isAnyFilterChecked);
    restoreFocus();
  });

  const closeBtn = block.querySelector('.filters__close');

  const bindFiltersMediaQuery = (blk) => {
    if (blk.filtersMQBound) return;
    const handleMQChange = ({ matches }) => {
      if (!blk.classList.contains('filters--visible')) return;
      const dialog = document.querySelector('dialog.filters__dialog');
      const sortBlock = getSortBlockInFilters(sortPlaceholderId) || getSortBlock(blk);
      const tabContent = getTabContent(blk);
      const controlsContainer = tabContent?.querySelector('.controls__container') || document.querySelector('.controls__container');

      if (matches) {
        dialog?.close();
        if (sortBlock && controlsContainer && sortBlock.classList.contains('sort-in-filters')) {
          sortBlock.classList.remove('sort-in-filters');
          sortBlock.classList.remove('filters__sort--hidden');
          sortBlock.removeAttribute('aria-hidden');
          const sortPlaceholder = controlsContainer.querySelector('.search-results__sort-original-position');
          if (sortPlaceholder) {
            sortPlaceholder.replaceWith(sortBlock);
          } else {
            controlsContainer.appendChild(sortBlock);
          }
        }
      } else if (!dialog) {
        openAsModal(
          blk.querySelector('.filters__content'),
          filtersTabId,
          blk.dataset.engineType,
          () => {
            blk.classList.remove('filters--visible');
            restoreSortBlockPosition(blk);
          },
        );
      }
    };
    if (desktopMediaQuery.addEventListener) {
      desktopMediaQuery.addEventListener('change', handleMQChange);
    } else if (desktopMediaQuery.addListener) {
      desktopMediaQuery.addListener(handleMQChange);
    }
    blk.filtersMQBound = true;
  };

  bindFiltersMediaQuery(block);

  block.onFilterToggle = () => {
    block.classList.add('filters--visible');
    closeBtn?.focus();

    const contentEl = block.querySelector('.filters__content');
    const dialog = document.querySelector('dialog.filters__dialog');
    const sortBlock = getSortBlockInFilters(sortPlaceholderId) || getSortBlock(block);

    if (isDesktop()) {
      if (dialog) dialog.close();
    } else {
      if (!dialog) {
        openAsModal(
          contentEl,
          filtersTabId,
          block.dataset.engineType,
          () => {
            block.classList.remove('filters--visible');
            restoreSortBlockPosition(block);
          },
        );
      }

      const sortPlaceholder = document.querySelector(`#${sortPlaceholderId} .filters__sort-accordion-content`);

      if (sortBlock && sortPlaceholder) {
        // Products tab keeps radio buttons
        if (filtersTabId === 'products') {
          if (!sortPlaceholder.contains(sortBlock)) {
            sortPlaceholder.insertBefore(sortBlock, sortPlaceholder.firstChild);
            sortBlock.classList.add('sort-in-filters');
            requestAnimationFrame(() => populateSortRadioButtons(block));
          } else {
            populateSortRadioButtons(block);
          }
        } else {
          // Move the real sort block so its existing behavior is preserved
          const currentParent = sortBlock.parentElement;
          if (currentParent !== sortPlaceholder) {
            sortPlaceholder.innerHTML = '';
            sortPlaceholder.appendChild(sortBlock);
            sortBlock.classList.add('sort-in-filters');
          }
          mountSortRadioOptions(sortBlock, sortPlaceholder, filtersTabId);
          sortBlock.classList.add('filters__sort--hidden');
          sortBlock.setAttribute('aria-hidden', 'true');
        }
      }

      const sortAccordion = document.querySelector('.filters__dialog .filters__sort-accordion');
      if (filtersTabId === 'products') {
        sortAccordion?.addEventListener('toggle', () => {
          if (sortAccordion.open) {
            requestAnimationFrame(() => populateSortRadioButtons(block));
          }
        });
      }
    }

    bindFiltersMediaQuery(block);
  };

  closeBtn?.addEventListener('click', () => {
    block.classList.remove('filters--visible');
    const sortBlockInFilters = getSortBlockInFilters(sortPlaceholderId);
    restoreSortBlockPosition(block, sortBlockInFilters);

    document.querySelector('dialog.filters__dialog')?.close();
  });

  const seeResultsBtn = block.querySelector('.filters__see-results-btn');
  seeResultsBtn?.addEventListener('click', () => {
    const sortBlockInFilters = getSortBlockInFilters(sortPlaceholderId);
    applyPendingSort(sortBlockInFilters || getSortBlock(block));
    block.classList.remove('filters--visible');
    restoreSortBlockPosition(block, sortBlockInFilters);

    document.querySelector('dialog.filters__dialog')?.close();
  });

  const form = block.querySelector('form');
  form.addEventListener('submit', (e) => {
    e.preventDefault();
  });

  clearFiltersEl.addEventListener('click', async () => {
    clearFiltersEl.classList.add('hidden');
    controller.clearAllFacets();
    registerScrollIntoView();

    const { trackFilterEvents } = await getAnalytics();
    trackFilterEvents();
  });

  decorateIcons(block);
}
