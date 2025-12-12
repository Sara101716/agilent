import { loadEnvConfig, getPlaceholder, getLocale } from '../aem.js';

async function refreshCoveoToken() {
  const config = await loadEnvConfig();
  const tokenUrl = config.coveoTokenEndpoint || '/coveo/token';

  const response = await fetch(tokenUrl);
  if (!response.ok) {
    throw new Error(`Coveo token request failed: ${response.status} - ${response.statusText}`);
  }
  const data = await response.json();
  localStorage.setItem('coveoAccessToken', data.token);
  return data.token;
}

/**
 * Main function to get Coveo token (with simple caching)
 * @returns {Promise<string>} Coveo access token
 */
const getTokenPromise = (async () => {
  try {
    const cachedToken = localStorage.getItem('coveoAccessToken');
    if (cachedToken) {
      return cachedToken;
    }

    return refreshCoveoToken();
  } catch (error) {
    throw new Error('Failed to get coveo access token', error);
  }
})();
async function getCoveoToken() {
  return getTokenPromise;
}

/**
 * Get URL parameters with a specific prefix and return them as an object without the prefix
 * @param {string} prefix - The prefix to filter URL parameters
 * @returns {Object} An object containing the filtered URL parameters without the prefix
 */
function getPrefixedParams(prefix) {
  const urlParams = new URLSearchParams(window.location.search);
  const filtered = {
    q: urlParams.get('q'),
  };

  urlParams.forEach((value, key) => {
    if (key.startsWith(prefix)) {
      filtered[key.replace(prefix, '')] = value;
    }
  });


  return filtered;
}

/**
 * Fix URLSearchParams encoding issues for spaces and commas - coveo has some problems with '+' and '%2C'
 *
 * @param {*} fragment
 * @returns
 */
function fixParamsForCoveo(fragment) {
  return fragment.replaceAll('+', '%20').replaceAll('%2C', ',');
}

const stateTriggers = ['q=', 'f-', 'page=', 'firstResult=', 'sortCriteria=', 'tab=']

function updateBrowserHistory(urlManager, settings) {
  const globalParamsList = ['q', 'tab'];
  const {
    prefix = '',
    sortCriteria,
    staticQuery,
    staticTab,
    staticFacets,
    initialization = false,
    removeTab,
  } = settings || {};
  const newUrl = new URL(window.location);
  const changes = [];

  if (removeTab && newUrl.searchParams.has('tab')) {
    newUrl.searchParams.delete('tab');
    changes.push('tab');
  }

  const currentState = new URLSearchParams(urlManager.state.fragment);

  if (staticQuery) {
    currentState.delete('q');
  }
  if (staticTab) {
    currentState.delete('tab');
  }
  Object.entries(staticFacets || {}).forEach(([facetId, facet]) => {
    const key = `${facetId.startsWith('cf-') ? '' : 'f-'}${facetId}`;
    if (currentState.has(key)) {
      const filteredValues = currentState.get(key)
        .split(',')
        .filter((v) => !facet.values.includes(v));
      if (filteredValues.length > 0) {
        currentState.set(key, filteredValues.join(','));
      } else {
        currentState.delete(key);
      }
    }
  });

  // enforce sortCriteria if not present
  // TODO this setting is not send by the commerce engine right now
  if (!currentState.has('sortCriteria') && sortCriteria) {
    currentState.set('sortCriteria', sortCriteria);
  }
  currentState.forEach((value, rawKey) => {
    const key = globalParamsList.includes(rawKey) || !prefix ? rawKey : `${prefix}${rawKey}`;
    if (newUrl.searchParams.get(key) !== value) {
      changes.push(rawKey);
      newUrl.searchParams.set(key, value);
    }
  });
  // removeOldPrams
  [...newUrl.searchParams.keys()].forEach((param) => {
    const rawParam = param.replace(prefix, '');
    if (param.startsWith(prefix) && !currentState.has(rawParam)) {
      changes.push(rawParam);
      newUrl.searchParams.delete(param);
    }
  });

  if (changes.length > 0) {
    newUrl.search = '?' + fixParamsForCoveo(newUrl.searchParams.toString());
    if (!initialization && changes.some(key => stateTriggers.some(t => `${key}=`.startsWith(t)))) {
      window.history.pushState(null, '', newUrl);
    } else {
      window.history.replaceState(window.history.state, '', newUrl);
    }
  }
}

function getDateFormatEpochMs(ms) {
  if (ms === null || ms === undefined || ms === '' || isNaN(Number(ms))) {
    return '';
  }

  const d = new Date(Number(ms));
  const browserTimeZone = Intl.DateTimeFormat().resolvedOptions().timeZone;

  const timeParts = new Intl.DateTimeFormat(navigator.language, {
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
    timeZone: browserTimeZone,
  }).formatToParts(d);

  const get = (type, parts) => parts.find((p) => p.type === type)?.value || '';
  const hour = get('hour', timeParts);
  const minute = get('minute', timeParts);
  const dayPeriod = (get('dayPeriod', timeParts) || '').toUpperCase();

  const dateParts = new Intl.DateTimeFormat(navigator.language, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    timeZone: browserTimeZone,
  }).formatToParts(d);

  const month = get('month', dateParts);
  const day = get('day', dateParts);
  const year = get('year', dateParts);

  return `${hour}:${minute} ${dayPeriod}, ${month} ${day} ${year}`;
}

function formatBytes(bytes) {
  if (typeof bytes !== 'number' || Number.isNaN(bytes)) return bytes;
  const KB = 1024;
  const MB = KB * 1024;

  if (bytes < MB) {
    return `${(bytes / KB).toFixed(2)} ${getPlaceholder('KB')}`;
  }
  return `${(bytes / MB).toFixed(2)} ${getPlaceholder('MB')}`;
}

function stripHtml(html) {
  let tmp = document.createElement('div');
  tmp.innerHTML = html;
  return tmp.textContent || tmp.innerText || '';
}

function sortQueryString(query) {
  // Remove leading '?' if present
  const cleanedQuery = query.startsWith('?') ? query.slice(1) : query;

  // Split the query string into key-value pairs
  const params = cleanedQuery.split('&');

  // Sort the parameters alphabetically by key
  const sortedParams = params.sort((a, b) => {
    const keyA = a.split('=')[0];
    const keyB = b.split('=')[0];
    return keyA.localeCompare(keyB);
  });

  // Join the sorted parameters back into a string
  return sortedParams.join('&');
}

const flattenNestedFacetValues = (values) => {
  return values.reduce((acc, value) => {
    acc.push(value);
    if (value.children && value.children.length > 0) {
      acc = acc.concat(flattenNestedFacetValues(value.children));
    }
    return acc;
  }, []);
};

const fetchFacetsPlaceholdersPromise = {};
async function fetchFacetsPlaceholders(path) {
  if (!fetchFacetsPlaceholdersPromise[path]) {
    fetchFacetsPlaceholdersPromise[path] = fetch(`/${path}/search-facets.json`).then((response) => response.json());
  }
  return fetchFacetsPlaceholdersPromise[path];
}

const facetsPlaceholders = {};
let fetchFacetsConfigPromise;
async function fetchFacetsConfig() {
  if (!fetchFacetsConfigPromise) {
    fetchFacetsConfigPromise = new Promise(async (resolve) => {
      const finalConfig = {};
      const searchFacetsPromises = getLocale().fallbackPaths.map(async (path) => {
        try {
          return fetchFacetsPlaceholders(path);
        } catch (e) {
          // eslint-disable-next-line no-console
          console.info('Error fetching facets config:', e);
        }

        return [];
      });

      if (searchFacetsPromises.length > 0) {
        const facetsConfigs = await Promise.allSettled(searchFacetsPromises);
        facetsConfigs.reverse().forEach((config) => {
          if (config.status !== 'fulfilled' || !config.value?.[':names']) {
            return;
          }

          config.value[':names'].forEach((sheetName) => {
            if (sheetName === 'placeholders-values') {
              config.value['placeholders-values'].data.forEach((row) => {
                facetsPlaceholders[row.Key?.toLowerCase().replaceAll('_', ' ')] = row.Text;
              });

              return;
            }

            // overwrite the sheet data by new sheet data
            finalConfig[sheetName] = {};
            config.value[sheetName].data.forEach((row, index) => {
              finalConfig[sheetName][row.name || row.key] = row;
              finalConfig[sheetName][row.name || row.key].order = index;

              if (config.value[row.name]) {
                finalConfig[sheetName][row.name].values = config.value[row.name].data;
              }
            });
          });
        });
      }

      resolve(finalConfig);
    });
  }
  return fetchFacetsConfigPromise;
}

function getFiltersPlaceholder(name) {
  const value = facetsPlaceholders[name?.toLowerCase().replaceAll('_', ' ')];

  return value || name;
}

export {
  getCoveoToken,
  refreshCoveoToken,
  fixParamsForCoveo,
  getPrefixedParams,
  updateBrowserHistory,
  getDateFormatEpochMs,
  stripHtml,
  sortQueryString,
  fetchFacetsConfig,
  formatBytes,
  flattenNestedFacetValues,
  getFiltersPlaceholder
}
