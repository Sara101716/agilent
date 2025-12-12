import { pushToDataLayer } from '../../scripts/aem.js';

let searchId = '';
let numberOfResults = 0;

const searchPerformedProps = {
  selectedTabId: '',
  userAction: 'no-action',
  pageNumber: 1,
};

export const setSearchPerformedProps = ({
  selectedTabId,
  userAction,
  pageNumber,
}) => {
  if (selectedTabId) {
    searchPerformedProps.selectedTabId = selectedTabId;
  }
  if (userAction) {
    searchPerformedProps.userAction = userAction;
  }
  if (pageNumber) {
    searchPerformedProps.pageNumber = pageNumber;
  }
};

export const changeSearchAttempt = () => {
  const url = new URL(window.location.href);
  const params = url.searchParams;
  params.set('searchAttempt', 'modified');
  window.history.replaceState(null, '', url.toString());
};

const getFilters = (searchParams) => {
  const { selectedTabId } = searchPerformedProps;
  const keys = { products: ['p_f-', 'p_cf-'], educationTraining: ['c_et_f-', 'c_et_cf-'], documentsSupport: ['c_ds_f-', 'c_ds_cf-'] };
  const filters = [];
  const prefixes = keys[selectedTabId];
  for (const [key, value] of searchParams.entries()) {
    for (const prefix of prefixes) {
      if (key.includes(prefix)) {
        const filterKey = key.replace(prefix, '');
        filters.push({ attribute: filterKey, value: value.split(',') });
      }
    }
  }
  // return filters as a string if empty. This is needed for ACDL state change
  return filters.length ? filters : '';
};

export const trackSearchResultsEvents = () => {
  const searchParams = new URLSearchParams(window.location.search);
  const query = searchParams.get('q');
  const searchAttempt = searchParams.get('searchAttempt');
  const {
    selectedTabId,
    userAction,
    pageNumber,
  } = searchPerformedProps;

  if (searchId === '') {
    const tabContentEl = document.querySelector(`.search-results__tab-content[data-tab-content="${selectedTabId}"]`);

    if (!tabContentEl && !query) {
      return;
    }

    searchId = tabContentEl.getAttribute('data-search-id');
    numberOfResults = parseInt(tabContentEl.getAttribute('data-no-of-results'), 10);
  }
  const searchResponseData = {
    event: 'search-performed',
    eventInfo: {
      type: 'agilent.search.performed',
    },
    xdm: {
      siteSearch: {
        searchId, // Get it from data-ag-searchRequestId
        query, // Get it from url
        topLevelFilter: selectedTabId, // Get it from DOM
        userAction, // Handling via tab, pagination and filter events
        searchAttempt, // Handling via url query params
        pageNumber, // Handling via pagination button events
        sort: [], // not part of wave 1
        filter: getFilters(searchParams), // Get it from url
        alteredFilter: [], // not part of wave 1
        filterSquence: '', // not part of wave 1
        numberOfResults, // Get it from data-ag-noOffResults
      },
    },
  };

  pushToDataLayer(searchResponseData);
};

export const initiateSearchResultsAnalytics = async () => {
  const tabs = document.querySelectorAll('.search-results__tabs-control .tab');
  const triggerAnalyticsEvent = (tabContentEl) => {
    searchId = tabContentEl.getAttribute('data-search-id');
    numberOfResults = parseInt(tabContentEl.getAttribute('data-no-of-results'), 10);
    trackSearchResultsEvents();
  };
  const handleTabClick = (tabId) => {
    const { selectedTabId } = searchPerformedProps;
    if (selectedTabId !== tabId) {
      setSearchPerformedProps({
        selectedTabId: tabId,
        userAction: 'tab-change',
        pageNumber: 1,
      });
      changeSearchAttempt();

      if (tabId === 'products') {
        triggerAnalyticsEvent(document.querySelector('.search-results__tab-content[data-tab-content="products"]'));
      }
    }
  };
  tabs.forEach((tab) => {
    if (tab.getAttribute('aria-selected') === 'true') {
      setSearchPerformedProps({ selectedTabId: tab.getAttribute('data-tab-id') });
    }
    tab.addEventListener('click', (e) => { handleTabClick(e.target.getAttribute('data-tab-id')); });
  });

  const productsTabContent = document.querySelector('.search-results__tab-content[data-tab-content="products"]');
  const productsObserver = new MutationObserver((mutations) => {
    mutations.forEach((mutation) => {
      if (mutation.type === 'attributes'
        && (mutation.attributeName === 'data-search-id')) {
        triggerAnalyticsEvent(productsTabContent);
      }
    });
  });
  productsObserver.observe(productsTabContent, { attributes: true });

  const educationTabContent = document.querySelector('.search-results__tab-content[data-tab-content="educationTraining"]');
  const educationObserver = new MutationObserver((mutations) => {
    const { selectedTabId } = searchPerformedProps;
    mutations.forEach((mutation) => {
      if (mutation.type === 'attributes'
        && (mutation.attributeName === 'data-search-id')
        && selectedTabId === 'educationTraining') {
        triggerAnalyticsEvent(educationTabContent);
      }
    });
  });
  educationObserver.observe(educationTabContent, { attributes: true });

  const documentsTabContent = document.querySelector('.search-results__tab-content[data-tab-content="documentsSupport"]');
  const documentsObserver = new MutationObserver((mutations) => {
    const { selectedTabId } = searchPerformedProps;
    mutations.forEach((mutation) => {
      if (mutation.type === 'attributes'
        && (mutation.attributeName === 'data-search-id'
        && selectedTabId === 'documentsSupport')) {
        triggerAnalyticsEvent(documentsTabContent);
      }
    });
  });
  documentsObserver.observe(documentsTabContent, { attributes: true });

  if (searchId === '') {
    trackSearchResultsEvents();
  }
};
