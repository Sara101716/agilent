import {
  buildSearchEngine,
  buildContext,
  buildResultList,
  buildTabManager,
  buildTab,
  buildUrlManager,
  buildDidYouMean,
  buildQuerySummary,
  buildSearchBox,
  buildPager,
  buildResultsPerPage,
  buildSort,
  buildFacet,
  buildRelevanceSortCriterion,
  buildDateSortCriterion,
  buildFieldSortCriterion,
  SortOrder,
  buildGeneratedAnswer,
} from './headless.esm.js';
import { loadEnvConfig, getLocale, toCamelCase } from '../../aem.js';
import { fixParamsForCoveo, getCoveoToken, getPrefixedParams, refreshCoveoToken, updateBrowserHistory, sortQueryString, fetchFacetsConfig } from '../utils.js';

let contentEngine;
const CONTENT_PREFIX = 'c_';

async function getContentEngine() {
  try {
    if (contentEngine) {
      return contentEngine;
    }
    const config = await loadEnvConfig();
    const coveoEngineConfiguration = JSON.parse(config.coveoContentEngineConfiguration);
    const locale = getLocale();
    const coveoContext = { country: locale.country, language: locale.language, ...JSON.parse(config.coveoContext || '{}') };
    contentEngine = buildSearchEngine({
      ...coveoEngineConfiguration,
      configuration: {
        ...coveoEngineConfiguration.configuration,
        search: {
          locale: `${locale.language}-${locale.country === 'AN' ? 'CW' : locale.country}`,
          ...coveoEngineConfiguration.configuration?.search,
        },
        accessToken: await getCoveoToken(),
        renewAccessToken: refreshCoveoToken,
      },
    });

    const context = buildContext(contentEngine);
    Object.entries(coveoContext).forEach(([key, value]) => context.add(key, value));

    return contentEngine;
  } catch (error) {
    throw new Error('Coveo engine initialization failed', error);
  }
}

function selectFacetsItemsFromQueryParamsWhenLoaded(prefix, facet) {
  const unsubscribe = facet.subscribe(() => {
    const contentQueryParams = getPrefixedParams(`${CONTENT_PREFIX}${prefix}`);
    const itemsToSelect = contentQueryParams[`f-${facet.state.facetId}`]?.split(',') || [];

    if (facet.state.isLoading || !facet.state.values.length) {
      return;
    }

    unsubscribe();

    if (!itemsToSelect.length) {
      return;
    }

    itemsToSelect.forEach((value) => {
      const facetValue = facet.state.values.find((el) => el.value === value);

      if (facetValue && facetValue.state === 'idle') {
        facet.toggleSelect(facetValue);
      }
    });
  });
}

let lastSearchUid = null;

async function activatePromos(drawFunction) {
  const engine = await getContentEngine();
  engine.subscribe(() => {
    const res = engine.state.search.response;
    if (!res) return;

    if (res.searchUid === lastSearchUid) return;
    lastSearchUid = res.searchUid;

    const triggers = res.triggers || [];
    triggers.forEach((trigger) => {
      drawFunction(trigger?.content);
    });
  });
}

function buildSortCriterion(rawOption) {
  const option = rawOption.trim().toLowerCase();
  if (['relevance', 'relevancy'].includes(option)) {
    return buildRelevanceSortCriterion();
  }
  const [field, order = 'descending'] = option.split(/[+\s]+/);
  const sortOrder = SortOrder[order.trim().toUpperCase().charAt(0) + order.slice(1).toLowerCase()] || SortOrder.Descending;
  if (field === 'date') {
    return buildDateSortCriterion(sortOrder);
  }
  return buildFieldSortCriterion(field, sortOrder);
}

let staticQuery;
let staticTab;
const staticFacets = {};

function getQueryParameters(tab) {
  const contentParams = getPrefixedParams(`${CONTENT_PREFIX}${tab.queryPrefix}`);
  if (staticQuery) {
    contentParams['q'] = staticQuery;
  }
  contentParams['tab'] = tab.coveoId;
  return new URLSearchParams(contentParams);
}

let contentController;
async function getContentController() {
  if (contentController) {
    return contentController;
  }
  const engine = await getContentEngine();
  const didYouMean = buildDidYouMean(engine);
  const summary = buildQuerySummary(engine);
  const pagination = buildPager(engine);
  const resultsPerPage = buildResultsPerPage(engine);

  const config = await loadEnvConfig();

  const results = buildResultList(engine, {
    options: {
      fieldsToInclude: [
        'permanentid',
        'date',
        'source',
        'filetype',
        'excerpt',
        'author',
        'title',
        'clickableuri',
        'language',
        'objecttype',
        'filetype',
        'filename',
        'publicationdate',
        'publicationspecies',
        'coursenumber',
        'courselength',
        'coursetype',
        'multimediaplayingtime',
        'location',
        'eventlocation',
        'eventdate',
        'forum_body',
        'forum_reply_author',
        'forum_reply_body',
        'forum_reply_type',
        'forum_reply_date',
        'forum_reply_upvotes',
        'forum_upvotes',
        'publicationauthors',
        'publicationnumber',
        'publicationjournalnames',
        'publicationresearchareas',
        'publicationtechniques',
        'publicationproducts',
        'publicationcelllines',
        'publicationcelltypes',
        'publicationspecies',
        'publicationassays',
        'publicationcellseedingdensities',
        'publicationplatecoatings',
        'publicationmodes',
        'publicationreagents',
        'journal',
        'enddate',
        'startdate',
        'eventaddress',
        'ec_products',
        'ec_services',
        'ec_thumbnails',
        'ec_product_names',
        'ec_product_id',
        'ec_part_numbers',
        'ec_related_part_number',
        'ec_product_urls',
        'foldingcollection',
        'foldingcollectionid',
        'foldingparent',
        'foldingchild',
        'description',
        'size',
        'createddate',
        'ec_esaleable',
        'locale',
      ],
    },
  });

  // create dummy tab to force the real tabs to be inactive before activation
  buildTab(engine, { options: { id: 'dummy', expression: '' } });
  const tabs = JSON.parse(config.coveoContentTabs || '[]').map((tab) => ({
    id: toCamelCase(tab),
    queryPrefix: `${tab.toLowerCase().split(/[^a-z]+/).map((word) => word.charAt(0)).join('')}_`,
    coveoId: tab,
    controller: buildTab(engine, { options: { id: tab, expression: '' } }),
  }));
  const tabManager = buildTabManager(engine);

  const defaults = {};

  buildSearchBox(engine); // needed to register query reducer

  const sort = buildSort(engine);
  const defaultSort = sort.state.sortCriteria;

  const urlManager = buildUrlManager(engine, { initialState: { fragment: '' } });

  const internalUpdateBrowserHistory = (initialization) => {
    const tab = tabs.find((t) => t.controller.state.isActive);
    if (tab) {
      updateBrowserHistory(urlManager, {
        initialization,
        prefix: `${CONTENT_PREFIX}${tab.queryPrefix}`,
        staticQuery,
        staticTab,
        staticFacets: staticFacets[tab.id],
        sortCriteria: defaults[tab.id]?.defaultSort ? sort.state.sortCriteria : false,
      });
    }
  };

  urlManager.subscribe(internalUpdateBrowserHistory);

  const customFacetsLists = {};
  let currentFacetsData = {
    educationTraining: null,
    documentsSupport: null,
  };
  const onFacetsChangeListeners = [];
  const updateCustomFacets = (tabId, customFacetsData) => {
    customFacetsData.forEach((facetData) => {
      const customFacet = buildFacet(engine, {
        options: {
          field: facetData.coveoField,
          numberOfValues: 1000,
        }
      });

      if (tabId === 'educationTraining' && tabManager.state.activeTab !== 'Education & Training') {
        customFacet.disable();
      } else if (tabId === 'documentsSupport' && tabManager.state.activeTab !== 'Documents & Support') {
        customFacet.disable();
      }

      if (!customFacetsLists[tabId]) {
        customFacetsLists[tabId] = [];
      }

      customFacetsLists[tabId].push(customFacet);

      selectFacetsItemsFromQueryParamsWhenLoaded(tabs.find((t) => t.controller.state.isActive)?.queryPrefix || '', customFacet);

      customFacet.subscribe(() => {
        const facets = customFacetsLists[tabId].map((el) => {
          const staticConfig = staticFacets[tabId]?.[el.state.facetId];
          if (staticConfig?.disabled) {
            return false;
          }
          return {
            facetId: el.state.facetId,
            type: 'regular',
            displayName: el.state.label,
            values: el.state.values.filter((v) => !staticConfig?.values.includes(v.value)).map((v) => ({
              value: v.value,
              numberOfResults: v.numberOfResults,
              state: v.state,
            })),
          };
        }).filter(Boolean);

        currentFacetsData[tabId] = {
          facets,
          tabId,
          totalResultsCount: summary.state.total,
        }

        onFacetsChangeListeners.forEach((listener) => {
          listener(currentFacetsData[tabId]);
        });
      });
    });
  };
  const facetsConfigs = await fetchFacetsConfig();
  tabs.forEach((tab) => {
    const fConfig = facetsConfigs[`config-${tab.id}`];
    if (!fConfig) {
      return;
    }
    updateCustomFacets(tab.id, Object.values(fConfig));
  });

  const toggleFacetValue = (facetId, value) => {
    Object.values(customFacetsLists).forEach((facetsList) => {
      const selectedFacet = facetsList.find(el => el.state.facetId === facetId);

      if (selectedFacet) {
        const facetValue = selectedFacet.state.values.find((el) => el.value === value);

        selectedFacet.toggleSelect(facetValue);
        internalUpdateBrowserHistory();
      }
    });
  };

  const clearAllFacets = () => {
    Object.values(customFacetsLists).forEach((facetsList) => {
      facetsList.forEach((facet) => {
        facet.deselectAll();
      });
    });

    internalUpdateBrowserHistory();
  };

  tabManager.subscribe(() => {
    if (tabManager.state.activeTab === 'Education & Training') {
      customFacetsLists['documentsSupport']?.forEach((facet) => facet.disable());
      customFacetsLists['educationTraining']?.forEach((facet) => {
        facet.enable();
        selectFacetsItemsFromQueryParamsWhenLoaded(tabs.find((t) => t.controller.state.isActive)?.queryPrefix || '', facet);
      });
    } else if (tabManager.state.activeTab === 'Documents & Support') {
      customFacetsLists['educationTraining']?.forEach((facet) => facet.disable());
      customFacetsLists['documentsSupport']?.forEach((facet) => {
        facet.enable();
        selectFacetsItemsFromQueryParamsWhenLoaded(tabs.find((t) => t.controller.state.isActive)?.queryPrefix || '', facet);
      });
    }
  });

  let generatedAnswer;

  async function initGeneratedAnswer() {
    generatedAnswer = buildGeneratedAnswer(engine, {
      fieldsToIncludeInCitations: ['clickableuri', 'title'],
      initialState: {
        expanded: true,
        isEnabled: true,
        isVisible: true,
        responseFormat: { contentFormat: ['text/plain'] },
      },
    });
  }

  function activateGeneratedAnswer(onComplete) {
    let buffer = '';
    let lastLen = 0;
    let inFlight = false;
    let notified = false;

    const unsubscribe = generatedAnswer.subscribe(() => {
      const s = generatedAnswer.state;

      if (s.isLoading && !s.answer && !inFlight) {
        buffer = '';
        lastLen = 0;
        inFlight = true;
        notified = false;
      }

      if (s.answer && s.answer.length > lastLen) {
        buffer += s.answer.slice(lastLen);
        lastLen = s.answer.length;
      }

      if (!notified && (s.isAnswerGenerated || s.cannotAnswer || s.error)) {
        notified = true;
        inFlight = false;

        onComplete(generatedAnswer, s.cannotAnswer ? '' : buffer, {
          citations: s.citations ?? [],
          cannotAnswer: !!s.cannotAnswer,
          error: s.error ?? null,
        });
      }
    });

    return unsubscribe;
  }

  contentController = {
    setStaticQuery: (query) => {
      staticQuery = query;
    },
    setStaticTab: (tabId) => {
      staticTab = tabs.find((tab) => tab.id === tabId);
    },
    setStaticFacets: (facets, tabId) => {
      staticFacets[tabId] = facets;
    },
    active: results.state.firstSearchExecuted,
    activate: (initialization, tabId) => {
      const tab = tabs.find((tab) => tab.id === tabId);
      if (!tab.controller.state.isActive || !summary.state.firstSearchExecuted) {
        const queryParameters = getQueryParameters(tab);
        if (defaults[tab.id]?.pageSize && !queryParameters.has('numberOfResults')) {
          queryParameters.set('numberOfResults', defaults[tab.id].pageSize);
        }
        if (!queryParameters.has('sortCriteria')) {
          if (defaults[tab.id]?.defaultSort) {
            queryParameters.set('sortCriteria', defaults[tab.id].defaultSort);
          } else {
            queryParameters.set('sortCriteria', defaultSort);
          }
        }
        Object.entries(staticFacets[tabId] || {}).forEach(([facetId, facetConfig]) => {
          const key = `f-${facetId}`;
          queryParameters.set(key, [...new Set([...(queryParameters.get(key)?.split(',') || []), ...facetConfig.values])].join(','));
        });
        urlManager.synchronize(fixParamsForCoveo(queryParameters.toString()));
      }
      internalUpdateBrowserHistory(initialization);
    },
    updateState: () => {
      const tab = tabs.find((tab) => tab.controller.state.isActive);
      if (tab && results.state.firstSearchExecuted) {
        const fragment = fixParamsForCoveo(getQueryParameters(tab).toString());
        if (sortQueryString(urlManager.state.fragment) !== sortQueryString(fragment)) {
          urlManager.synchronize(fragment);
        }
      }
    },
    setDefaultPageSize: (pageSize, tabId) => {
      if (!pageSize) {
        return;
      }
      defaults[tabId] = defaults[tabId] || {};
      defaults[tabId].pageSize = parseInt(pageSize);
    },
    setDefaultSort: (defaultSort, tabId) => {
      if (!defaultSort) {
        return;
      }
      defaults[tabId] = defaults[tabId] || {};
      defaults[tabId].defaultSort = defaultSort.toLowerCase();
    },
    summary,
    results,
    tabManager,
    tabs,
    urlManager,
    didYouMean,
    pagination,
    resultsPerPage,
    sort,
    getAvailableSorts: (config) => (config['options'] || 'relevancy,date+descending').split(',').map((option) => buildSortCriterion(option)),
    appliedSort: buildSortCriterion(sort.state.sortCriteria),
    toggleFacetValue,
    clearAllFacets,
    activatePromos,
    initGeneratedAnswer,
    activateGeneratedAnswer,
    generatedAnswer,
    addFacetChangeListener: (listener) => {
      onFacetsChangeListeners.push(listener);

      const tabId = tabManager.state.activeTab === 'Education & Training' ? 'educationTraining' : tabManager.state.activeTab === 'Documents & Support' ? 'documentsSupport' : null;

      if (currentFacetsData[tabId]) {
        listener(currentFacetsData[tabId]);
      }
    }
  };

  window.addEventListener('popstate', () => contentController.updateState());

  tabs.forEach((tab) => {
    const tabKey = `${tab.id.charAt(0).toUpperCase()}${tab.id.slice(1)}`;
    const defaultSort = config[`search${tabKey}DefaultSort`] || config['searchDefaultSort'];
    contentController.setDefaultSort(defaultSort, tab.id);
    const defaultPageSize = config[`search${tabKey}PageSize`] || config['searchPageSize'];
    contentController.setDefaultPageSize(defaultPageSize, tab.id);
  });

  sort.subscribe(() => {
    contentController.appliedSort = buildSortCriterion(sort.state.sortCriteria);
  });

  results.subscribe(() => {
    contentController.active = results.state.firstSearchExecuted;
  });

  return contentController;
}

export {
  getContentController,
};
