import {
  html,
  readBlockConfig,
  loadEnvConfig,
  getLocale,
  toCamelCase,
} from '../../scripts/aem.js';
import {
  getCommerceController,
} from '../../scripts/coveo/headless/commerce/index.js';
import {
  getContentController,
} from '../../scripts/coveo/headless/index.js';

const coveoConfigKeys = [
  'pageSize',
  'sortDefault',
];

function getCoveoTabConfig(config, tabId) {
  const configEntries = Object.entries(config);
  return {
    ...Object.fromEntries(configEntries.filter(([key]) => coveoConfigKeys.includes(key))),
    ...Object.fromEntries(configEntries
      .map(([key, value]) => {
        if (key.startsWith(tabId)) {
          const tmpKeyWithoutPrefix = key.replace(tabId, '');
          const keyWithoutPrefix = `${tmpKeyWithoutPrefix.charAt(0).toLowerCase()}${tmpKeyWithoutPrefix.slice(1)}`;
          if (coveoConfigKeys.includes(keyWithoutPrefix)) {
            return [keyWithoutPrefix, value];
          }
        }
        return [];
      })
      .filter(([key]) => key)),
  };
}

function setTabSpecificConfigs(config, tabId, controller) {
  const coveoConfig = getCoveoTabConfig(config, tabId);
  controller.setDefaultPageSize(coveoConfig.pageSize, tabId);
  controller.setDefaultSort(coveoConfig.sortDefault, tabId);
  if (config.facets) {
    controller.setStaticFacets(Object.fromEntries(config.facets.map((facet) => {
      const tokens = facet.split(',').map((t) => t.trim()).filter(Boolean);
      return [tokens[0], {
        values: tokens[1].split('|').map((v) => v.trim()).filter(Boolean),
        disabled: tokens[2] === 'disabled',
      }];
    })), tabId);
  }
}

export default async function decorate() {
  const commerceController = await getCommerceController();
  const contentController = await getContentController();
  const envConfig = await loadEnvConfig();
  document.body.classList.add('searchresults--loading');
  window.addEventListener('searchResults:Updated', () => {
    if (document.body.classList.contains('searchresults--loading')) {
      document.body.classList.remove('searchresults--loading');
    }
  }, { once: true });

  let thereCanBeOnlyOne = false;
  document.querySelectorAll('main .search-results').forEach((resultsBlock) => {
    if (thereCanBeOnlyOne) {
      resultsBlock.remove();
      return;
    }
    thereCanBeOnlyOne = true;
    const resultBlockConfig = readBlockConfig(resultsBlock);
    const config = { ...envConfig, ...resultBlockConfig };

    const currentUrl = new URL(window.location.href);
    if (!currentUrl.searchParams.get('q')?.trim() && !config.query) {
      window.location.href = `/${getLocale().rootPath}`;
      return;
    }

    if (config.query) {
      if (currentUrl.searchParams.has('q')) {
        currentUrl.searchParams.delete('q');
        window.history.replaceState(window.history.state, '', currentUrl.href);
      }
      commerceController.setStaticQuery(config.query);
      contentController.setStaticQuery(config.query);
    }
    setTabSpecificConfigs(config, 'products', commerceController);
    contentController.tabs
      .forEach((tab) => setTabSpecificConfigs(config, tab.id, contentController));
    const tabFilter = ((resultBlockConfig.tab || resultBlockConfig.tabs)?.split(',') || []).map((t) => toCamelCase(t.trim())).filter(Boolean);
    const allTabs = [{ id: 'products' }, ...contentController.tabs].filter((tab) => tabFilter.length === 0 || tabFilter.includes(tab.id));
    const tabParam = currentUrl.searchParams.get('tab');
    const activeTab = (allTabs.find((tab) => tabParam && tab.coveoId === tabParam)
      || allTabs[0]).id;
    const {
      activate,
    } = activeTab === 'products' ? commerceController : contentController;
    activate(true, activeTab);

    const existingSection = resultsBlock.parentElement;
    const afterSection = existingSection.cloneNode(true);
    for (const sibling of [...existingSection.children].reverse()) {
      sibling.remove();
      if (sibling === resultsBlock) {
        break;
      }
    }
    for (let i = 0; i <= existingSection.children.length; i += 1) {
      afterSection.children[0].remove();
    }

    const section = document.createElement('div');
    section.className = 'search-results__section';
    section.appendChild(resultsBlock);

    existingSection.parentNode.insertBefore(afterSection, existingSection.nextSibling);
    existingSection.parentNode.insertBefore(section, afterSection);

    if (!config.query) {
      resultsBlock.parentNode.insertBefore(html`<div class="search-results__basics"></div>`, resultsBlock);
    }

    const tabContent = html`<div class="search-results__tabs-control" data-initial-tab="${activeTab}"></div>`;
    tabContent.dataset.tabFilter = JSON.stringify(tabFilter);
    resultsBlock.parentNode.insertBefore(tabContent, resultsBlock);
  });
}
