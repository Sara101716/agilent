import {
  buildCommerceEngine,
  buildSearch,
  buildStandaloneSearchBox,
  buildRelevanceSortCriterion,
  buildFieldsSortCriterion,
  SortDirection,
} from './headless.esm.js';
import { loadEnvConfig, getLocale, getPath, debounce, getCountryInfo, prepareGetAssetPath } from '../../../aem.js';
import { fetchPartsPriceFromProductList } from '../../../services/atg.api.js'
import { fixParamsForCoveo, getCoveoToken, getPrefixedParams, refreshCoveoToken, updateBrowserHistory, sortQueryString, flattenNestedFacetValues } from '../../utils.js';

const queryHistoryKey = 'coveo-headless-query-history';
function getQueryHistory(count = false) {
  const queryHistory = JSON.parse(window.localStorage.getItem(queryHistoryKey) || '[]');
  if (count) {
    return queryHistory.slice(0, count);
  }
  return queryHistory;
}

function clearQueryHistory() {
  window.localStorage.removeItem(queryHistoryKey);
}

function buildSortCriterion(option) {
  if (['relevance', 'relevancy'].includes(option)) {
    return buildRelevanceSortCriterion();
  }
  return buildFieldsSortCriterion(option.split(',').map((field) => {
    const [name, order = 'descending'] = field.split(/[+\s]+/);
    const direction = SortDirection[order.toUpperCase().charAt(0) + order.slice(1).toLowerCase()] || SortDirection.Descending;
    return { name, direction };
  }));
}

function addCoveoFacetChangeListenerToController(controller, facetsGenerator, pagination) {
  let currentFacetsData = null;
  const onFacetsChangeListeners = [];
  const facetsUnsubscribers = [];
  // Debounce the facets update event to avoid multiple events being sent when multiple facets are updated at once
  const sendFacetsUpdateEvent = debounce(() => {
    const data = {
      facets: commerceController.search.state.facets
        .filter((f) => !(staticFacets?.[f.facetId] || staticFacets?.[`cf-${f.facetId}`])?.disabled)
        .map((f) => ({
          ...f,
          values: f.values.filter((v) => !(staticFacets?.[f.facetId] || staticFacets?.[`cf-${f.facetId}`])?.values.includes(v.value)),
        })),
      tabId: 'products',
      totalResultsCount: pagination.state.totalEntries,
    }

    currentFacetsData = data;
    onFacetsChangeListeners.forEach((listener) => {
      listener(currentFacetsData);
    });
  }, 10);

  facetsGenerator.subscribe(() => {
    // Remove previous facets subscriptions
    facetsUnsubscribers.forEach((unsub) => unsub());
    facetsUnsubscribers.length = 0;


    // Subscribe to each facet changes
    facetsGenerator.facets.forEach((facet) => {
      const unsub = facet.subscribe(() => {
        if (!commerceController.search.state.isLoading) {
          sendFacetsUpdateEvent();
        }
      });
      facetsUnsubscribers.push(unsub);
    });
  });

  controller.addFacetChangeListener = (listener) => {
    onFacetsChangeListeners.push(listener);

    if (currentFacetsData) {
      listener(currentFacetsData);
    }
  };
};

let commerceEngine;
async function getCommerceEngine() {
  if (commerceEngine) {
    return commerceEngine;
  }

  const config = await loadEnvConfig();
  const coveoEngineConfiguration = JSON.parse(config.coveoCommerceEngineConfiguration);
  const locale = getLocale();

  commerceEngine = buildCommerceEngine({
    ...coveoEngineConfiguration,
    configuration: {
      ...coveoEngineConfiguration.configuration,
      accessToken: await getCoveoToken(),
      renewAccessToken: refreshCoveoToken,
      analytics: {
        trackingId: getLocale().country === 'CN' ? 'agilentchina' : 'agilentglobal',
      },
      context: {
        country: locale.country === 'AN' ? 'CW' : locale.country,
        currency: (await getCountryInfo()).currency || 'USD',
        language: locale.language,
        view: { url: window.location.href },
      },
      cart: {
        items: [
          // TODO add current cart state
          // {
          //   name: '',
          //   price: 0,
          //   productId: '',
          //   quantity: 1,
          // }
        ]
      },
      preprocessRequest: (request, clientOrigin) => {
        // duplicate country in context additional to root for Coveo pipeline filters
        const body = JSON.parse(request.body);
        body.context.country = locale.country;
        body.context.language = locale.language;
        return {
          ...request,
          body: JSON.stringify(body),
        };
      }
    },
  });

  return commerceEngine;
}

const searchResultsWithPrice = (function () {
  let value = null;
  const subscribers = [];
  return {
    subscribe(callback) {
      subscribers.push(callback);
      if (value !== null) {
        callback(value);
      }
    },

    publish(newValue) {
      value = newValue;
      subscribers.forEach(callback => callback(value));
    },

    getValue() {
      return value;
    }
  };
})();

let commerceController;
let staticQuery;
let staticTab;
let staticFacets;
async function getCommerceController() {
  if (commerceController) {
    return commerceController;
  }
  const engine = await getCommerceEngine();
  const getAssetPath = await prepareGetAssetPath();

  const search = buildSearch(engine);
  const PRODUCTS_PREFIX = 'p_';
  const commerceParams = getPrefixedParams(PRODUCTS_PREFIX);
  const currentQuery = new URLSearchParams(commerceParams);
  const fragment = fixParamsForCoveo(currentQuery.toString());

  const urlManager = search.urlManager({ initialState: { fragment } });

  const internalUpdateBrowserHistory = (initialization) => updateBrowserHistory(urlManager, {
    initialization,
    prefix: PRODUCTS_PREFIX,
    staticQuery,
    staticTab,
    staticFacets,
    removeTab: true,
  });

  urlManager.subscribe(internalUpdateBrowserHistory);

  const query = search.parameterManager().state.parameters.q;
  if (query) {
    window.localStorage.setItem('coveo-headless-query-history',
      JSON.stringify([...new Set([query, ...getQueryHistory()])].slice(0, 20)));
  }

  const summary = search.summary();
  const sort = search.sort();
  const facetsGenerator = search.facetGenerator();
  const pagination = search.pagination();

  search.subscribe(async () => {
    if (!search.state.isLoading) {
      try {
        // Preload images for the first 4 products for LCP
        search.state.products.slice(0, 4).forEach((product) => {
            const src = [...product.ec_images.map((i) => i.src), ...product.ec_thumbnails][0];
            if (src) {
              const img = new Image();
              img.src = getAssetPath(src);
            }
        });

        const productsWithPrice = await fetchPartsPriceFromProductList(search.state.products);
        searchResultsWithPrice.publish(productsWithPrice);
        return;
      } catch (e) {
        console.error('Error fetching product prices', e);
      }
    }
    searchResultsWithPrice.publish(search.state.products);
  });

  const temporaryState = {};
  commerceController = {
    setStaticQuery: (query) => {
      staticQuery = true;
      const currentState = new URLSearchParams(urlManager.state.fragment);
      currentState.set('q', query);
      search.urlManager({ initialState: { fragment: fixParamsForCoveo(currentState.toString()) } });
    },
    setStaticTab: () => {
      staticTab = true;
    },
    setStaticFacets: (facets) => {
      staticFacets = facets;
      const currentState = new URLSearchParams(urlManager.state.fragment);
      Object.entries(facets).forEach(([facetId, facetConfig]) => {
        const key = `${facetId.startsWith('cf-') ? '' : 'f-'}${facetId}`;
        currentState.set(key, [...new Set([...(currentState.get(key)?.split(',') || []), ...facetConfig.values])].join(','));
      });
      search.urlManager({ initialState: { fragment: fixParamsForCoveo(currentState.toString()) } });
    },
    active: summary.state.firstRequestExecuted,
    activate: (initialization) => {
      if (!summary.state.firstRequestExecuted) {
        search.executeFirstSearch();
      }
      internalUpdateBrowserHistory(initialization);
    },
    updateState: () => {
      const commerceParams = getPrefixedParams(PRODUCTS_PREFIX);
      const currentQuery = new URLSearchParams(commerceParams);
      const fragment = fixParamsForCoveo(currentQuery.toString());
      if (sortQueryString(urlManager.state.fragment) === sortQueryString(fragment)) {
        return;
      }
      if (summary.state.firstRequestExecuted) {
        urlManager.synchronize(fragment);
      } else {
        search.urlManager({ initialState: { fragment } });
      }
    },
    setDefaultPageSize: (defaultPageSize) => {
      if (!defaultPageSize) {
        return;
      }
      const currentState = new URLSearchParams(urlManager.state.fragment);
      if (currentState.has('perPage') && !temporaryState.perPage) {
        return;
      }
      temporaryState.perPage = !commerceController.active;
      currentState.set('perPage', defaultPageSize);
      search.urlManager({ initialState: { fragment: fixParamsForCoveo(currentState.toString()) } });
    },
    setDefaultSort: (defaultSort) => {
      if (!defaultSort) {
        return;
      }
      const currentState = new URLSearchParams(urlManager.state.fragment);
      if (currentState.has('sortCriteria') && !temporaryState.sortCriteria) {
        return;
      }
      temporaryState.sortCriteria = !commerceController.active;
      search.sort({ initialState: { criterion: buildSortCriterion(defaultSort) } });
    },
    correctQueryHistory: (q) => {
      const currentHistory = getQueryHistory();
      if (currentHistory.length > 0) {
        currentHistory[0] = q;
        window.localStorage.setItem(queryHistoryKey, JSON.stringify([... new Set(currentHistory)]));
      }
    },
    urlManager,
    search,
    searchResultsWithPrice,
    toggleFacetValue: (facetId, value) => {
      const { facets } = facetsGenerator;
      const selectedFacet = facets.find(el => el.state.facetId === facetId);
      const facetValue = flattenNestedFacetValues(selectedFacet.state.values).find((el) => el.value === value);

      selectedFacet.toggleSelect(facetValue);
      internalUpdateBrowserHistory();
    },
    clearAllFacets: () => {
      facetsGenerator.deselectAll();
      internalUpdateBrowserHistory();
    },

    summary,
    didYouMean: search.didYouMean(),
    sort,
    getAvailableSorts: () => sort.state.availableSorts,
    appliedSort: sort.state.appliedSort,
    pagination,
  };

  const config = await loadEnvConfig();
  const defaultSort = config['searchProductDefaultSort'] || config['searchDefaultSort'];
  commerceController.setDefaultSort(defaultSort);
  const defaultPageSize = config['searchProductPageSize'] || config['searchPageSize'];
  commerceController.setDefaultPageSize(defaultPageSize);

  sort.subscribe(() => commerceController.appliedSort = sort.state.appliedSort);
  summary.subscribe(() => commerceController.active = summary.state.firstRequestExecuted);
  window.addEventListener('popstate', () => commerceController.updateState());
  addCoveoFacetChangeListenerToController(commerceController, facetsGenerator, pagination);

  return commerceController;
}

let standaloneSearchController;
async function getStandaloneSearchController(numberOfSuggestions) {
  if (standaloneSearchController) {
    return standaloneSearchController;
  }

  const searchPage = await getPath('/search');

  const searchBox = buildStandaloneSearchBox(await getCommerceEngine(), {
    options: {
      clearFilters: true,
      enableQuerySyntax: true,
      highlightOptions: {
        notMatchDelimiters: {
          open: '<strong>',
          close: '</strong>',
        },
        correctionDelimiters: {
          open: '<i>',
          close: '</i>',
        },
      },
      id: 'custom-search-box',
      numberOfSuggestions,
      overwrite: true,
      redirectionUrl: searchPage
    }
  });

  const config = await loadEnvConfig();
  const coveoContentEngineConfiguration = JSON.parse(config.coveoContentEngineConfiguration);

  const plan = async (query) => {
    const response = await fetch(`https://platform.cloud.coveo.com/rest/search/v2/plan?organizationId=${coveoContentEngineConfiguration.configuration.organizationId}`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${await getCoveoToken()}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        q: query,
        searchHub: coveoContentEngineConfiguration.configuration.search.searchHub,
      }),
    });

    if (!response.ok) {
      return false;
    }

    const data = await response.json();
    if (!(data.preprocessingOutput.triggers?.length > 0)) {
      return false;
    }

    const trigger = data.preprocessingOutput.triggers[0];

    try {

      if (trigger.type === 'redirect' && typeof trigger.content === 'string') {
        return {
          type: trigger.type,
          url: trigger.content,
        }
      }

      if (trigger.type === 'execute' && trigger.content?.name === 'searchRedirectToTab' && trigger.content?.params?.length > 0) {
        return {
          type: 'tab',
          tab: trigger.content.params[0],
        }
      }

    } catch (e) {
      console.error(`Could not process plan trigger: [${e.message}]`, e);
    }

    return false;
  };

  standaloneSearchController = {
    plan,
    searchBox,
    searchPage,
  };

  return standaloneSearchController;
}

export {
  getQueryHistory,
  clearQueryHistory,
  getStandaloneSearchController,
  getCommerceController,
};
