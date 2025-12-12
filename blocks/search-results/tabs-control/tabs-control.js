import { html, getPlaceholder, toCamelCase } from '../../../scripts/aem.js';
import {
  getContentController,
} from '../../../scripts/coveo/headless/index.js';
import {
  getCommerceController,
} from '../../../scripts/coveo/headless/commerce/index.js';

let tabClicked = false;

function selectTab(
  commerceController,
  contentController,
  container,
  id,
  executeSearch,
  pushState = true,
) {
  if (container.getCurrentTabId?.() === id) {
    return;
  }

  if (!executeSearch) {
    const {
      activate,
    } = id === 'products' ? commerceController : contentController;
    activate(!pushState, id);
  }

  [...container.children].forEach((el) => {
    if (el.dataset.tabId === id) {
      el.setAttribute('aria-selected', true);
      el.setAttribute('tabindex', 0);
    } else {
      el.setAttribute('aria-selected', false);
      el.setAttribute('tabindex', -1);
    }
  });

  container.dispatchEvent(new CustomEvent('searchResultTabSelected', { bubbles: true, detail: { tabId: id } }));
}

/**
 * Enables keyboard navigation between the Tabs
 * @param {*} tabGroupEl The Element that contains the Tabs
 */
function tabsManual(commerceController, contentController, tabGroupEl) {
  const tablistNode = tabGroupEl;

  const tabs = Array.from(tablistNode.querySelectorAll('[role=tab]'));
  const tabpanels = [];

  let firstTab = null;
  let lastTab = null;

  function moveFocusToTab(currentTab) {
    currentTab.focus();
  }

  function moveFocusToPreviousTab(currentTab) {
    if (currentTab === firstTab) {
      moveFocusToTab(lastTab);
    } else {
      const index = tabs.indexOf(currentTab);
      moveFocusToTab(tabs[index - 1]);
    }
  }

  function moveFocusToNextTab(currentTab) {
    if (currentTab === lastTab) {
      moveFocusToTab(firstTab);
    } else {
      const index = tabs.indexOf(currentTab);
      moveFocusToTab(tabs[index + 1]);
    }
  }

  function onKeydown(event) {
    const tgt = event.currentTarget;
    let flag = false;

    switch (event.key) {
      case 'ArrowLeft':
        moveFocusToPreviousTab(tgt);
        flag = true;
        break;

      case 'ArrowRight':
        moveFocusToNextTab(tgt);
        flag = true;
        break;

      case 'Home':
        moveFocusToTab(firstTab);
        flag = true;
        break;

      case 'End':
        moveFocusToTab(lastTab);
        flag = true;
        break;

      default:
        break;
    }

    if (flag) {
      event.stopPropagation();
      event.preventDefault();
    }
  }

  function onClick(event) {
    tabClicked = true;
    selectTab(commerceController, contentController, tabGroupEl, event.target.dataset.tabId, false);
  }

  for (let i = 0; i < tabs.length; i += 1) {
    const tab = tabs[i];
    const tabpanel = document.getElementById(tab.getAttribute('aria-controls'));

    tab.tabIndex = -1;
    tab.setAttribute('aria-selected', 'false');
    tabpanels.push(tabpanel);

    tab.addEventListener('keydown', onKeydown);
    tab.addEventListener('click', onClick);

    if (!firstTab) {
      firstTab = tab;
    }
    lastTab = tab;
  }
}

function buildTab(data) {
  const {
    id, name,
  } = data;
  return html`
    <button id="${id}-tab" class="tab" role="tab" aria-selected="false" data-tab-id="${id}" tabindex="0">
      ${getPlaceholder(name)}
    </button>
  `;
}

export default async function decorate(block) {
  block.innerHTML = '';
  let tabFilter = [];
  const initialTabId = block.dataset.initialTab;

  try {
    tabFilter = JSON.parse(block.dataset.tabFilter);
  } catch (e) {
    console.warn('tabs-control: unable to parse tab filter, proceeding without filter');
  }

  block.setAttribute('role', 'tablist');

  const commerceController = await getCommerceController();
  const contentController = await getContentController();
  const tabs = [
    {
      id: 'products',
      name: 'Products',
      controller: commerceController,
    },
    ...contentController.tabs.map((tab) => ({
      id: tab.id,
      name: tab.coveoId,
      controller: contentController,
    })),
  ].filter((tab) => tabFilter.length === 0 || tabFilter.includes(tab.id));

  const section = block.closest('.section');

  if (tabs.length === 1) {
    block.remove();
    tabs[0].controller.setStaticTab(tabs[0].id);
    selectTab(commerceController, contentController, block, tabs[0].id, true);
    section.getCurrentTabId = () => tabs[0].id;
    return;
  }

  const initialUrl = new URL(window.location);
  if (!window.history.state) {
    const stateId = contentController.tabs.find((tab) => tab.coveoId === initialTabId)?.id
      || initialTabId;
    window.history.replaceState({ tabId: stateId }, '', initialUrl);
  }
  const tabEls = tabs.map((tab) => buildTab(tab));
  tabEls.forEach((tabEl) => block.append(tabEl));

  section.getCurrentTabId = () => block.querySelector('.tab[aria-selected="true"]')?.dataset.tabId;
  tabsManual(commerceController, contentController, block);
  selectTab(commerceController, contentController, block, initialTabId, true);
  const noResultTabs = [];
  const noResultTryNextTab = (currentTabId) => {
    noResultTabs.push(currentTabId);
    const nextTryTabId = tabs.find((t) => !noResultTabs.includes(t.id))?.id;
    selectTab(commerceController, contentController, block, nextTryTabId, false, false);
  };
  commerceController.summary.subscribe(() => {
    if (tabClicked) return;
    const { firstRequestExecuted, hasProducts } = commerceController.summary.state || {};
    if (firstRequestExecuted && !hasProducts) {
      noResultTryNextTab('products');
    }
  });
  contentController.summary.subscribe(() => {
    if (tabClicked) return;
    const { firstSearchExecuted, hasResults } = contentController.summary.state || {};
    if (firstSearchExecuted && !hasResults) {
      noResultTryNextTab(section.getCurrentTabId());
    }
  });
  window.addEventListener('popstate', () => {
    const newTabId = toCamelCase(new URLSearchParams(window.location.search).get('tab') || 'products');
    if (section.getCurrentTabId() !== newTabId) {
      selectTab(commerceController, contentController, block, newTabId, false);
    }
  });
}
