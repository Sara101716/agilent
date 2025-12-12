import {
  html,
  decorateBlock,
  loadBlock,
  getPlaceholder,
} from '../../../scripts/aem.js';
import { SEARCH_RESULT_LAYOUT } from '../search-results.js';
import { formatBytes } from '../../../scripts/coveo/utils.js';

function findRenderer(result, resultsContainer) {
  let objectType = result.additionalFields?.objecttype ?? result.raw?.objecttype;
  let rendering;
  switch (objectType) {
    case 'product': {
      const tabId = resultsContainer.closest('.search-results__tab-content')?.dataset.tabContent ?? 'products';
      rendering = (tabId === 'products') ? 'product' : 'training';
      break;
    }
    case 'Events':
    case 'eSeminar':
      rendering = 'event';
      objectType = 'Event';
      break;
    case 'Community - Question':
    case 'Community - Forum':
      rendering = 'community';
      break;
    default:
      rendering = result.rendering ?? 'compendium';
  }
  const searchResult = {
    ...result, objectType, rendering,
  };

  return searchResult.rendering;
}

let filterConfig;

async function loadFilterConfig(cardFiltersConfiguration) {
  if (filterConfig) {
    return filterConfig;
  }

  try {
    const response = await fetch(cardFiltersConfiguration);
    if (!response.ok) {
      throw new Error(`Failed to load filter config: ${response.status}`);
    }
    filterConfig = await response.json();
    return filterConfig;
  } catch (error) {
    // eslint-disable-next-line no-console
    console.error('Error loading filter configuration:', error);
    return {
      Classes: { data: [] },
      Filters: { data: [] },
    };
  }
}

function formatDate(milliseconds) {
  const date = new Date(milliseconds);

  const day = date.getDate();
  const month = date.toLocaleString('en-US', { month: 'short' });
  const year = date.getFullYear();

  return `${day} ${month} ${year}`;
}

function formatAuthors(authorList) {
  if (!authorList || typeof authorList !== 'string') {
    if (Array.isArray(authorList)) {
      return authorList.join(', ');
    }
    return authorList;
  }

  const trimmed = authorList.trim();
  if (trimmed === '') {
    return trimmed;
  }

  const authors = trimmed.split(',').map((a) => a.trim()).filter((a) => a !== '');

  if (authors.length === 0) {
    return trimmed;
  }

  if (authors.length === 1) {
    return authors[0];
  }

  return `${authors[0]}, et al.`;
}

function formatLocale(locale) {
  if (!locale || typeof locale !== 'string') {
    return locale;
  }

  const trimmed = locale.trim();
  if (trimmed === '') {
    return trimmed;
  }

  const parts = trimmed.split('_');
  if (parts.length !== 2) {
    return trimmed;
  }

  const [language, country] = parts;
  const formattedCountry = country
    .split(' ')
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(' ');

  return `${language} - ${formattedCountry}`;
}

function filterSearchResult(result, config) {
  const objectType = result.raw?.objecttype;

  if (!objectType) {
    return { filteredProperties: {}, filterRule: null };
  }

  let className = null;
  let fallbackClassName = null;

  if (config) {
    for (const classData of config.Classes.data) {
      const objectTypes = classData['Object Types'];

      if (objectTypes === '*') {
        if (!fallbackClassName) {
          fallbackClassName = classData['Class Name'];
        }
      } else {
        const objectTypesList = objectTypes.split(',').map((s) => s.trim());
        if (objectTypesList.includes(objectType)) {
          className = classData['Class Name'];
          break;
        }
      }
    }
  }

  if (!className) {
    className = fallbackClassName;
  }

  if (!className) {
    return { filteredProperties: {}, filterRule: null };
  }

  let filterRule = null;
  for (const filter of config.Filters.data) {
    if (filter['Class Name'] === className) {
      filterRule = filter;
      break;
    }
  }

  if (!filterRule) {
    return { filteredProperties: {}, filterRule: null };
  }

  const defaultBehavior = filterRule['*'] || 'none';
  const output = {};

  for (const [key, value] of Object.entries(result.raw)) {
    const isInternalKey = (key === 'Class Name' || key === '*');

    if (!isInternalKey) {
      let behavior = filterRule[key];

      if (behavior === undefined || behavior === '') {
        behavior = defaultBehavior;
      }

      if (behavior === 'unlabeled') {
        output[key] = {
          labeled: false,
          value,
        };
      } else if (behavior === 'labeled') {
        output[key] = {
          labeled: true,
          label: key,
          value,
        };
      }
    }
  }

  return { filteredProperties: output, filterRule };
}

function buildPublicationMetadataAndQuickView(result) {
  if (!result || !result.raw) return result;

  const cloned = { ...result, raw: { ...result.raw } };
  const { raw } = cloned;

  const metadata = [];

  const { filteredProperties, filterRule } = filterSearchResult(result, filterConfig);

  const processField = (field, config) => {
    let v = config.value;

    if (v !== undefined && v !== null) {
      if (field === 'size') {
        const num = parseInt(v, 10);
        if (!Number.isNaN(num)) {
          v = formatBytes(num);
        } else {
          v = String(v).trim();
        }
      } else if (typeof v === 'number' && Number.isInteger(v) && v > 0) {
        if (v > 946684800000 && v < 4102444800000) {
          v = formatDate(v);
        } else {
          v = String(v).trim();
        }
      } else {
        v = String(v).trim();
      }

      if (field === 'publicationauthors') {
        v = formatAuthors(v);
      }

      if (field === 'locale') {
        v = formatLocale(v);
      }

      if (v !== '') {
        const type = config.labeled ? 'k-v-pair' : 'text';
        const metaItem = { data: v, type };

        if (config.labeled) {
          metaItem.title = getPlaceholder(field);
        }

        metadata.push(metaItem);
      }
    }
  };

  const processedFields = new Set();

  if (filterRule) {
    Object.keys(filterRule).forEach((field) => {
      if (field !== 'Class Name' && field !== '*' && filteredProperties[field]) {
        processField(field, filteredProperties[field]);
        processedFields.add(field);
      }
    });
  }

  Object.entries(filteredProperties).forEach(([field, config]) => {
    if (!processedFields.has(field)) {
      processField(field, config);
    }
  });

  raw.publicationMetadata = { metadata };

  const quickViewMap = [
    ['publicationauthors', getPlaceholder('publicationauthors')],
    ['publicationjournalnames', getPlaceholder('publicationjournalnames')],
    ['publicationdate', getPlaceholder('publicationdate')],
    ['publicationresearchareas', getPlaceholder('publicationresearchareas')],
    ['publicationtechniques', getPlaceholder('publicationtechniques')],
    ['ec_product_names', getPlaceholder('ec_product_names')],
    ['publicationproducts', getPlaceholder('publicationproducts')],
    ['publicationcelllines', getPlaceholder('publicationcelllines')],
    ['publicationcelltypes', getPlaceholder('publicationcelltypes')],
    ['publicationspecies', getPlaceholder('publicationspecies')],
    ['publicationassays', getPlaceholder('publicationassays')],
    ['publicationcellseedingdensities', getPlaceholder('publicationcellseedingdensities')],
    ['publicationplatecoatings', getPlaceholder('publicationplatecoatings')],
  ];

  const detailValues = [];

  quickViewMap.forEach(([field, friendlyName]) => {
    let v = raw[field];
    if (v !== undefined && v !== null && String(v).trim() !== '') {
      if (field === 'publicationauthors') {
        v = formatAuthors(v);
      }
      if (field === 'publicationdate') {
        v = formatDate(v);
      }
      detailValues.push({ key: friendlyName, value: v });
    }
  });

  const supportingDropdownObjectTypes = ['Publications', 'Chromatograms'];

  const ecPartNumbers = result.raw.ec_part_numbers ?? result.raw.ec_related_part_number;
  if (ecPartNumbers && typeof ecPartNumbers === 'string') {
    const partsArray = ecPartNumbers.split(';').filter(Boolean);

    if (partsArray.length > 0 && supportingDropdownObjectTypes.includes(result?.raw?.objecttype)) {
      raw.supportingDocuments = { show: true, partsArray };
    }
  }

  if (detailValues.length > 0) {
    raw.quickView = { show: true, detailValues };
  }

  return cloned;
}

async function render(block, results) {
  const blockConfigNode = block.closest('[data-block-config]');
  if (blockConfigNode) {
    const { cardFiltersConfiguration } = JSON.parse(blockConfigNode.dataset.blockConfig);
    await loadFilterConfig(cardFiltersConfiguration);
  }

  const resultsContainer = block.querySelector('.results');
  const { height } = resultsContainer.getBoundingClientRect();
  resultsContainer.style.height = `${height}px`;
  resultsContainer.innerHTML = '';
  await Promise.all(results.map(async (result) => {
    const curatedResult = buildPublicationMetadataAndQuickView(result);
    const resultBlock = html`<div class="search-results__${findRenderer(curatedResult, resultsContainer)}"></div>`;
    const eager = results.indexOf(result) < 3;
    resultBlock.dataset.result = JSON.stringify({ ...curatedResult, eager });
    resultsContainer.append(resultBlock);
    decorateBlock(resultBlock);
    await loadBlock(resultBlock);
  }));
  resultsContainer.style.height = '';
}

export default async function decorate(block) {
  block.render = async (results) => render(block, results);

  block.querySelectorAll('.view-selection').forEach((viewSelection) => {
    const buttons = viewSelection.querySelectorAll('button');
    buttons.forEach((button) => {
      const ariaLabel = button.getAttribute('aria-label');
      const buttonWrapper = html`<div class="view-selection__option" title="${ariaLabel}"></div>`;
      buttonWrapper.appendChild(button);
      viewSelection.appendChild(buttonWrapper);

      button.addEventListener('click', (e) => {
        block.querySelectorAll('.view-selection button').forEach((sibling) => {
          sibling.setAttribute('aria-pressed', false);
        });
        e.target.setAttribute('aria-pressed', true);
        if (e.target.dataset.view === SEARCH_RESULT_LAYOUT.LIST) {
          block.classList.remove(SEARCH_RESULT_LAYOUT.GRID);
          block.classList.add(SEARCH_RESULT_LAYOUT.LIST);
        } else {
          block.classList.add(SEARCH_RESULT_LAYOUT.GRID);
          block.classList.remove(SEARCH_RESULT_LAYOUT.LIST);
        }
        window.localStorage.setItem(SEARCH_RESULT_LAYOUT.CONFIG, e.target.dataset.view);
      });
    });
  });
}
