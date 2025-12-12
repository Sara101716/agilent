import {
  decorateIcons,
  getLocale,
  readBlockConfig,
} from '../../scripts/aem.js';
import { trackSearchEvent } from './search.analytics.js';
import { getFileName } from '../../scripts/analytics/adobe-data-layer.js';

let maxLineCount = 5;
const coveoPromise = new Promise((resolve) => {
  setTimeout(async () => {
    const module = await import('../../scripts/coveo/headless/commerce/index.js');
    const standaloneSearchController = await module.getStandaloneSearchController(maxLineCount);
    resolve({
      ...module,
      getStandaloneSearchController: () => standaloneSearchController,
    });
  }, 3000);
});
/**
 * Debounce function to limit the rate of function execution
 */
function delayExecution(func, delay) {
  let timeout;
  return (...args) => {
    clearTimeout(timeout);
    timeout = setTimeout(() => func(...args), delay);
  };
}

/**
 * Update the active suggestion item in the suggestion list
 */
function updateActiveItem(items, activeIndex, searchInput) {
  items.forEach((item, index) => {
    const isActive = index === activeIndex;
    item.classList.toggle('active', isActive);
    if (isActive) {
      // Avoid setting the input value for "Clear History" items
      if (!item.classList.contains('search__suggestion-clear')) {
        searchInput.value = item.textContent.trim();
      }
      item.setAttribute('aria-selected', 'true');
    } else {
      item.setAttribute('aria-selected', 'false');
    }
  });
}

/**
 * Close the suggestion box
 */
function closeSuggestionBox(
  suggestionsList,
  searchInput,
  activeIndexRef,
  resetActiveIndex = true,
) {
  const suggestionsDivWrapper = suggestionsList.parentNode;
  suggestionsList.classList.add('search__suggestions--hidden');
  suggestionsList.classList.remove('search__suggestions--visible');
  if (suggestionsDivWrapper) {
    suggestionsDivWrapper.classList.remove('search__recent-searches--active');
  }
  searchInput.setAttribute('aria-expanded', 'false'); // Indicate that suggestions are hidden
  if (resetActiveIndex && activeIndexRef && typeof activeIndexRef === 'object') {
    activeIndexRef.value = -1; // Reset active index
  }
}

let searchType = '';
let searchSuggestions = [];
let originalQuery = '';
async function submitQuery(query) {
  const searchBoxController = (await coveoPromise).getStandaloneSearchController();
  searchBoxController.searchBox.updateText(query);

  const planPromise = searchBoxController.plan(query);

  const urlParams = new URLSearchParams(window.location.search);

  const searchAttempt = urlParams.get('searchAttempt') ? 'modified' : 'initial';

  trackSearchEvent({
    searchId: '',
    query,
    suggestions: searchSuggestions.length > 0 ? searchSuggestions : '',
    originalQuery: `${originalQuery}`,
    searchAttempt,
    searchType,
    searchOrigin: `${getLocale()?.languageCountry?.replace('-', ':')}: ${getFileName()}`,
  });

  searchBoxController.searchBox.submit();
  searchBoxController.searchBox.subscribe(async () => {
    const {
      redirectTo, value,
    } = searchBoxController.searchBox.state;
    if (redirectTo) {
      const redirectUrl = new URL(redirectTo, window.location.origin);
      if (redirectUrl.pathname
        === new URL(searchBoxController.searchPage, window.location.origin).pathname
      ) {
        redirectUrl.searchParams.set('q', value);
        redirectUrl.searchParams.set('searchAttempt', searchAttempt);
      }
      const plan = await planPromise;
      switch (plan?.type) {
        case 'redirect':
          if (plan?.url) {
            window.location.href = plan.url;
          }
          break;
        case 'tab':
          redirectUrl.searchParams.set('tab', plan?.tab);
        // eslint-disable-next-line no-fallthrough
        default:
          window.location.href = redirectUrl.toString();
      }
    }
  });
}

const createSuggestionListItem = ({
  text, html, index, handleSuggestionClick, ariaLabel,
}) => {
  const listItem = document.createElement('li');
  if (html) {
    listItem.innerHTML = html;
  } else {
    listItem.textContent = text;
  }
  listItem.classList.add('search__suggestion-item');
  listItem.dataset.index = index;
  listItem.setAttribute('role', 'option');
  if (ariaLabel) {
    listItem.setAttribute('aria-label', ariaLabel);
  }
  listItem.addEventListener('click', () => {
    searchType = 'auto-suggest';
    originalQuery = document.querySelector('#standalone-search-input').value;
    handleSuggestionClick();
  });
  return listItem;
};

const renderRecentSearches = (
  recentSearches,
  suggestionsList,
  searchInput,
  recentSearchesText,
  historyText,
  activeIndex,
  ariaLiveRegion,
) => {
  activeIndex.value = -1;
  const suggestionsDivWrapper = suggestionsList.parentNode;
  // Clear the suggestions list
  suggestionsList.innerHTML = '';

  // If there are no recent searches, hide the suggestions list
  if (!recentSearches || recentSearches.length === 0) {
    suggestionsList.classList.add('search__suggestions--hidden');
    suggestionsList.classList.remove('search__suggestions--visible');
    suggestionsDivWrapper.classList.remove('search__recent-searches--active');
    searchInput.setAttribute('aria-expanded', 'false');
    return;
  }

  // Add "Recent Searches" header
  const header = document.createElement('li');
  header.textContent = recentSearchesText;
  header.classList.add('search__suggestion-header');
  suggestionsList.appendChild(header);

  // Add recent searches as list items
  recentSearches.forEach((search, index) => {
    const listItem = document.createElement('li');
    listItem.textContent = search;
    listItem.classList.add('search__suggestion-item');
    listItem.dataset.index = index;
    listItem.setAttribute('role', 'option');
    listItem.addEventListener('click', () => {
      searchInput.value = search;
      searchType = 'manual';
      searchSuggestions = [...recentSearches];
      const query = searchInput.value.trim();
      submitQuery(query);
      closeSuggestionBox(suggestionsList, searchInput, { value: -1 }, false);
    });
    suggestionsList.appendChild(listItem);
  });

  // Check if "Clear History" button already exists
  const suggestionsWrapper = suggestionsList.parentNode;
  let clearLink = suggestionsWrapper.querySelector('.search__clear-link');
  if (!clearLink) {
    // Create "Clear History" button if it doesn't exist
    clearLink = document.createElement('button');
    clearLink.textContent = historyText;
    clearLink.type = 'button';
    clearLink.setAttribute('aria-label', historyText);
    clearLink.classList.add('search__clear-link');

    clearLink.addEventListener('click', async (event) => {
      event.preventDefault();
      (await coveoPromise).clearQueryHistory();
      suggestionsList.classList.add('search__suggestions--hidden');
      suggestionsList.classList.remove('search__suggestions--visible');
      suggestionsDivWrapper.classList.remove('search__recent-searches--active');

      searchInput.setAttribute('aria-expanded', 'false');
      searchInput.focus();

      ariaLiveRegion.textContent = 'Search history cleared';
    });

    suggestionsWrapper.appendChild(clearLink);
  }

  // Show the suggestions list
  suggestionsDivWrapper.classList.add('search__recent-searches--active');
  suggestionsList.classList.add('search__suggestions--visible');
  suggestionsList.classList.remove('search__suggestions--hidden');
  searchInput.setAttribute('aria-expanded', 'true');
};

/**
 * Create the search box UI.
 * @param {HTMLElement} container - The container element for the search box.
 * @param {string} placeholderText - Placeholder text for the search input.
 * @returns {Object} Elements of the search box (input, suggestions list, etc.).
 */
const createSearchBoxUI = (container, placeholderText) => {
  container.innerHTML = `
    <form id="standalone-search-form" class="search__form agt-input__wrapper" role="search">
      <div class="agt-input__container search__input-container">
            <input
              type="text"
              id="standalone-search-input"
              class="search__input agt-input agt-input--large"
              placeholder="${placeholderText}"
              autocomplete="off"
              aria-autocomplete="list"
              aria-controls="standalone-suggestions-list"
              aria-expanded="false"
              aria-label="${placeholderText}"
              role="combobox"
              aria-activedescendant=""
            />
            <span class="search__icons agt-icon agt-input__icon--right" id="icon-container"></span>
      </div>
      <div id="standalone-suggestions-list" class="search__suggestions--wrapper"><ul class="search__suggestions" role="listbox"></ul></div>
    </form>
    <div id="aria-live-region" class="visually-hidden" aria-live="polite"></div>
  `;

  const searchIcon = document.createElement('span');
  searchIcon.classList.add('icon', 'icon-search', 'search__icon', 'search__icon--search');
  searchIcon.setAttribute('tabindex', '0');
  searchIcon.setAttribute('role', 'button');
  searchIcon.setAttribute('aria-label', 'Search');

  const clearIcon = document.createElement('span');
  clearIcon.classList.add('icon', 'icon-clear', 'search__icon', 'search__icon--clear', 'search__icon--hidden');
  clearIcon.setAttribute('tabindex', '0');
  clearIcon.setAttribute('role', 'button');
  clearIcon.setAttribute('aria-label', 'Clear');

  const iconContainer = container.querySelector('#icon-container');
  iconContainer.appendChild(clearIcon);
  iconContainer.appendChild(searchIcon);
  decorateIcons(iconContainer);

  return {
    searchInput: container.querySelector('#standalone-search-input'),
    suggestionsList: container.querySelector('#standalone-suggestions-list > .search__suggestions'),
    searchForm: container.querySelector('#standalone-search-form'),
    searchIcon,
    clearIcon,
    ariaLiveRegion: container.querySelector('#aria-live-region'),
  };
};

function toggleIcons(searchInput, clearIcon) {
  if (searchInput.value.trim() !== '') {
    clearIcon.classList.remove('search__icon--hidden');
  } else {
    clearIcon.classList.add('search__icon--hidden');
  }
}

const addSearchInputListeners = (searchInput, clearIcon, searchIcon, handleInputChange) => {
  // Handle input events to toggle clear and search icons
  searchInput.addEventListener('input', () => {
    toggleIcons(searchInput, clearIcon);
    handleInputChange();
  });

  // Handle clear icon click to reset input
  clearIcon.addEventListener('click', async () => {
    searchInput.value = '';
    toggleIcons(searchInput, clearIcon);
    searchInput.focus();
    const searchBoxController = (await coveoPromise).getStandaloneSearchController();
    searchBoxController.searchBox.clear();
  });

  // Handle Enter key on the clear icon
  clearIcon.addEventListener('keydown', async (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      searchInput.value = '';
      toggleIcons(searchInput, clearIcon);
      searchInput.focus();
      const searchBoxController = (await coveoPromise).getStandaloneSearchController();
      searchBoxController.searchBox.clear();
    }
  });

  searchIcon.addEventListener('click', () => {
    const query = searchInput.value.trim();
    if (query) {
      submitQuery(query);
    }
  });

  searchIcon.addEventListener('keydown', (event) => {
    if (event.key === 'Enter') {
      const query = searchInput.value.trim();
      if (query) {
        submitQuery(query);
      }
    }
  });

  const originalPlaceholder = searchInput.placeholder;
  searchInput.addEventListener('focus', () => {
    searchInput.placeholder = ''; // Clear the placeholder text
  });

  // Handle blur to restore the placeholder if the input is empty
  searchInput.addEventListener('blur', () => {
    if (searchInput.value.trim() === '') {
      searchInput.placeholder = originalPlaceholder; // Restore the placeholder text
    }
  });
};

const addKeyboardNavigation = (searchInput, suggestionsList, searchForm, activeIndex) => {
  searchInput.addEventListener('keydown', (e) => {
    const items = Array.from(suggestionsList.querySelectorAll('.search__suggestion-item, .search__suggestion-clear'));

    if (e.key === 'ArrowDown') {
      e.preventDefault(); // Prevent default scrolling behavior
      if (activeIndex.value < items.length - 1) {
        originalQuery ||= searchInput.value;
        activeIndex.value = (activeIndex.value + 1) % items.length;
        updateActiveItem(items, activeIndex.value, searchInput);
      }
    } else if (e.key === 'ArrowUp') {
      e.preventDefault(); // Prevent default scrolling behavior
      if (activeIndex.value > 0) {
        originalQuery ||= searchInput.value;
        activeIndex.value = (activeIndex.value - 1 + items.length) % items.length;
        updateActiveItem(items, activeIndex.value, searchInput);
      }
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (activeIndex.value >= 0) {
        const selectedItem = items[activeIndex.value];
        if (selectedItem.classList.contains('search__suggestion-clear')) {
          selectedItem.querySelector('a').click();
        } else {
          searchType = 'auto-suggest';
          searchInput.value = selectedItem.textContent.trim();
          const query = searchInput.value.trim();
          originalQuery ||= query;
          submitQuery(query);
        }
      } else {
        // Handle manual search
        const query = searchInput.value.trim();
        if (query) {
          originalQuery ||= query;
          searchType = 'manual';
          submitQuery(query);
        }
      }
      closeSuggestionBox(suggestionsList, searchInput, activeIndex, false);
    } else if (e.key === 'Escape') {
      closeSuggestionBox(suggestionsList, searchInput, activeIndex, false);
      searchInput.focus();
    }

    // Call toggleIcons to ensure the icons are updated
    const clearIcon = searchForm.querySelector('.search__icon--clear');
    toggleIcons(searchInput, clearIcon);
  });

  document.addEventListener('focusin', (e) => {
    if (!searchForm.contains(e.target) && !suggestionsList.contains(e.target)) {
      closeSuggestionBox(suggestionsList, searchInput, activeIndex, false);
    }
  });

  suggestionsList.addEventListener('focusout', (e) => {
    if (!suggestionsList.contains(e.relatedTarget)) {
      activeIndex.value = -1;
    }
  });
};

const subscibeSearchBox = async (suggestionsList, searchInput, activeIndex) => {
  try {
    const searchBoxController = (await coveoPromise).getStandaloneSearchController();

    // Render query suggestions
    searchBoxController.searchBox.subscribe(() => {
      const { state } = searchBoxController.searchBox;
      suggestionsList.innerHTML = '';
      const suggestionsDivWrapper = suggestionsList.parentNode;

      const clearButton = suggestionsDivWrapper.querySelector('.search__clear-link');
      if (clearButton) {
        clearButton.remove();
        suggestionsDivWrapper.classList.remove('search__recent-searches--active');
      }

      if (state.suggestions.length) {
        const limitedSuggestions = state.suggestions.slice(0, maxLineCount);
        searchSuggestions = limitedSuggestions.map((s) => s.rawValue);
        limitedSuggestions.forEach((suggestion, index) => {
          const listItem = createSuggestionListItem({
            html: suggestion.highlightedValue,
            index,
            handleSuggestionClick: () => {
              searchInput.value = suggestion.rawValue;
              searchBoxController.searchBox.selectSuggestion(suggestion.rawValue);
              searchBoxController.searchBox.updateText(suggestion.rawValue);
              submitQuery(searchInput.value.trim());
              closeSuggestionBox(suggestionsList, searchInput, activeIndex, false);
            },
            ariaLabel: suggestion.rawValue,
          });
          suggestionsList.appendChild(listItem);
        });

        suggestionsList.classList.add('search__suggestions--visible');
        suggestionsList.classList.remove('search__suggestions--hidden'); // Show the suggestions list
        searchInput.setAttribute('aria-expanded', 'true'); // Indicate that suggestions are visible
      } else {
        closeSuggestionBox(suggestionsList, searchInput, activeIndex, false);
      }
    });
  } catch (error) {
    // eslint-disable-next-line no-console
    console.warn('Error subscribing search box:', error);
  }
};

export function initializeSearchBox(container, config) {
  const {
    placeholder,
    recentSearchesText,
    clearHistoryText,
    maxRecentHistoryCount,
  } = config;

  const activeIndex = { value: -1 };

  // Render the search box UI
  const {
    searchInput,
    suggestionsList,
    searchForm,
    searchIcon,
    clearIcon,
    ariaLiveRegion,
  } = createSearchBoxUI(container, placeholder);
  try {
    // Handle keyboard navigation for suggestions
    addKeyboardNavigation(searchInput, suggestionsList, searchForm, activeIndex);

    const handleInputChange = delayExecution(async () => {
      const query = searchInput.value.trim();
      const coveoResponse = await coveoPromise;
      if (query) {
        const searchBoxController = coveoResponse.getStandaloneSearchController();
        searchBoxController.searchBox.updateText(query);
        searchBoxController.searchBox.showSuggestions();
      } else {
        const recentSearches = coveoResponse.getQueryHistory(maxRecentHistoryCount);
        renderRecentSearches(
          recentSearches,
          suggestionsList,
          searchInput,
          recentSearchesText,
          clearHistoryText,
          activeIndex,
          ariaLiveRegion,
        );
      }
    }, 300);
    addSearchInputListeners(searchInput, clearIcon, searchIcon, handleInputChange);

    subscibeSearchBox(suggestionsList, searchInput, activeIndex);

    // Open suggestion box when the search box gains focus
    searchInput.addEventListener('focus', async () => {
      const query = searchInput.value.trim();
      const coveoResponse = await coveoPromise;
      if (!query) {
        const recentSearches = coveoResponse.getQueryHistory(maxRecentHistoryCount);
        renderRecentSearches(
          recentSearches,
          suggestionsList,
          searchInput,
          recentSearchesText,
          clearHistoryText,
          activeIndex,
          ariaLiveRegion,
        );
      } else {
        const searchBoxController = coveoResponse.getStandaloneSearchController();
        searchBoxController.searchBox.showSuggestions();
        suggestionsList.classList.add('search__suggestions--visible');
        suggestionsList.classList.remove('search__suggestions--hidden');
        searchInput.setAttribute('aria-expanded', 'true');
      }
    });

    // Close suggestions when clicking outside the search box
    document.addEventListener('click', (e) => {
      const searchFormCnt = container.querySelector('.search__form');
      if (!searchFormCnt.contains(e.target)) {
        closeSuggestionBox(suggestionsList, searchInput, activeIndex, false);
      }
    });

    // Handle form submission (Enter key)
    searchForm.addEventListener('submit', (event) => {
      event.preventDefault();

      const query = searchInput.value.trim();
      submitQuery(query);
      closeSuggestionBox(suggestionsList, searchInput, activeIndex, false);
    });
  } catch (error) {
    // eslint-disable-next-line no-console
    console.warn('Error initializing standalone search box:', error);
  }
}

export default async function decorate(block) {
  const config = readBlockConfig(block);
  maxLineCount = config.maxLineCount || maxLineCount;
  block.innerHTML = '';

  const searchUIWrapper = document.createElement('div');
  searchUIWrapper.className = 'search-ui-wrapper';

  block.append(searchUIWrapper);
  initializeSearchBox(searchUIWrapper, config);
}
