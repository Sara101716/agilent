import {
  getMetadata,
  pushToDataLayer,
  isCDN,
  isLoggedIn,
  getLocale,
  loadEnvConfig,
} from '../aem.js';
import { initiateSearchResultsAnalytics } from '../../blocks/search-results/search-results.analytics.js';

const isCTAButton = (link) => {
  const ctaClasses = ['agt-button', 'agt-button--primary', 'agt-button--secondary'];
  const ctaSelectors = [
    '.agt-button', '.agt-button--primary', '.agt-button--secondary',
    '[data-agt]', '[role="button"]',
  ];

  // Check classes
  const hasCtaClass = ctaClasses.some((cls) => link.classList?.contains(cls)
        || link.closest(`.${cls}`));
  const hasCtaParent = ctaSelectors.some(
    (selector) => link.matches(selector) || link.closest(selector),
  );
  return hasCtaClass || hasCtaParent;
};

/**
 * Check if a link should be tracked based on configuration
 */
export const shouldTrackLink = (link) => {
  if (isCTAButton(link)) {
    return true;
  }
  if (link.getAttribute('href') === '#' || link.getAttribute('href')?.startsWith('#')) {
    return true;
  }
  return true;
};

/**
 * Helper function to get component name from CSS classes
 */
const getComponentNameFromClass = async (element) => {
  try {
    const blockNameContainer = element.closest('[data-block-name]');
    if (blockNameContainer) {
      const { blockName } = blockNameContainer.dataset;
      if (blockName === 'columns') {
        const config = await loadEnvConfig();
        const { customClasses } = config;
        if (customClasses) {
          return JSON.parse(customClasses).find(
            (configuredClass) => element.classList.contains(configuredClass),
          );
        }
      }
      return blockName;
    }
    const sectionContainer = element.closest('.section, section');
    if (sectionContainer) {
      const namedChild = sectionContainer.querySelector('[data-block-name]');
      if (namedChild) {
        const { blockName } = namedChild.dataset;
        return blockName;
      }
      if (sectionContainer.id) {
        return sectionContainer.id;
      }
    }
  } catch (error) {
    console.error('Error in retrieving name %', error);
  }
  return 'unknown-component';
};

/**
 * Optimized helper function to get component type  */
const getComponentType = (element) => {
  const { dataset } = element.closest('[data-block-name]') ?? {};
  const blockName = dataset?.blockName;

  if (blockName) {
    if (blockName === 'columns') {
      const parentSection = element.closest('.section');
      const alternativeBlock = Array.from(
        parentSection?.querySelectorAll('[data-block-name]') ?? [],
      ).find((el) => el.getAttribute('data-block-name') !== 'columns');
      const { blockName: altBlockName } = alternativeBlock?.dataset ?? {};
      return altBlockName ?? 'columns';
    }
    return blockName;
  }
  const sectionContainer = element.closest('.section, section');
  const blockElement = sectionContainer.querySelector('[data-block-name]');
  const { blockName: childBlockName } = blockElement?.dataset ?? {};
  if (sectionContainer) {
    const typeOptions = [
      sectionContainer.dataset?.blockName,
      childBlockName,
      sectionContainer.id,
    ];

    return typeOptions.find(Boolean) ?? 'unknown-component';
  }
  return 'unknown-component';
};

const getLinkNameOuter = (clickedLink) => {
  const prevLink = clickedLink.previousSibling;
  return prevLink.previousSibling?.textContent.trim();
};

const getLinkHref = (el) => el?.href || el?.closest?.('a')?.href || '';

export const getFileName = () => window.location.pathname.substring(window.location.pathname.lastIndexOf('/') + 1)
    || window.location.pathname.split('/').filter(Boolean).pop()
    || 'index';
/**
 * Get the name of the clicked link
 */
const getLinkName = (link) => link.getAttribute('aria-label')
    ?? (link.textContent.trim() || (link.getAttribute('title')) || getLinkNameOuter(link))
    ?? link.getAttribute('href')
    ?? 'Unknown Link';
/**
 * Extracts the coupon code from the title attribute of the provided link.
 */
const getCouponCode = (link) => link?.getAttribute('title')?.match(/(\d+)/)?.[1] || '';

/**
 * Determine the type of link
 */
export const getLinkType = (link) => {
  const href = link.getAttribute('href') || '';
  if (href.startsWith('mailto:')) return 'email';
  if (href.startsWith('tel:')) return 'phone';
  if (href.match(/\.(pdf|doc|docx|xls|xlsx|ppt|pptx|zip|rar)$/i)) return 'download';
  if (isCDN(link.hostname)) return 'other';
  if (link.hostname && link.hostname !== window.location.hostname) return 'exit';

  return 'other';
};

/**
 * Get the region/section where the link was clicked
 */
export const getLinkRegion = (link) => {
  const blockElement = link.closest('[data-block-name]');
  if (blockElement) {
    const { blockName } = blockElement.dataset;
    if (blockName.includes('header')) return 'Primary Navigation Clicks';
    if (blockName.includes('footer')) return 'Footer Navigation Clicks';
  }
  const headerElement = link.closest('[class*="header"]:not([class*="section__header"])');
  if (headerElement) {
    return 'Primary Navigation Clicks';
  }
  const footerElement = link.closest('[class*="footer"]');
  if (footerElement) {
    return 'Footer Navigation Clicks';
  }

  if (document.body.classList.contains('searchresults')) {
    return 'Search page Clicks';
  }

  return 'Home page Clicks';
};

/**
 * Helper function to generate block ID if not available
 */
const generateComponentId = (component) => {
  const componentType = getComponentType(component);
  if (componentType && componentType !== 'unknown-component') {
    if (componentType === 'header' || componentType === 'footer') {
      return componentType;
    }
    const getIndex = component.closest('.section');
    const sameComp = Array.from(document.querySelectorAll('.section'));
    const position = sameComp.indexOf(getIndex);
    return `${componentType}-${position}`;
  }
  return componentType;
};

/**
 * Get component data from the link's parent component
 */
export const getComponentData = async (link) => {
  if (!link) {
    return {};
  }
  const componentData = {};
  const component = link.closest('[data-block-name], .block, .section');
  if (component) {
    if (['search-results__product', 'search-results__compendium'].includes(component.dataset.blockName)) {
      componentData.type = 'search-results';
      if (component.dataset.blockName === 'search-results__product') {
        componentData.name = component.dataset.blockName;
      } else {
        componentData.name = `search-results__${component.closest('[data-tab-content]')?.dataset.tabContent.toLowerCase() || 'compendium'}`;
      }
      componentData.uniqueID = `${componentData.name}-${[...component.parentNode.children].indexOf(component) + 1}`;
    } else {
      // Component Unique ID
      const uniqueID = generateComponentId(component);
      if (uniqueID) componentData.uniqueID = uniqueID;
      // Component Name
      const componentName = await getComponentNameFromClass(component);
      if (componentName) componentData.name = componentName;
      // Component Type
      const componentType = getComponentType(component, 'name');
      if (componentType) componentData.type = componentType;
    }
  }
  return componentData;
};
/**
 * Extract product/result data from the closest parent with data-result attribute
 */
export const getResultData = (link) => {
  try {
    const {
      uniqueId = '',
      ec_product_id: productId = '',
      ec_name: productName = '',
      ec_category: category = [],
      priceInventory = {},
      position: tilePosition = null,
      raw = {},
      uri = '',
      additionalFields = {},
    } = JSON.parse(link.closest('[data-result]')?.getAttribute('data-result') ?? '{}');

    return {
      uniqueId,
      productId,
      productName,
      priceInventory,
      tilePosition: String(tilePosition ?? ''),
      raw,
      uri,
      additionalFields,
      category,
    };
  } catch {
    return Object.fromEntries(
      ['uniqueId', 'productId', 'productName', 'priceInventory', 'tilePosition', 'uri', 'raw', 'additionalFields', 'category']
        .map((key) => [key, '']),
    );
  }
};

/**
 * Get header of product card, feature card and news panel block
 */
const getContentTitle = (link) => {
  const card = link.closest('.product-card, .feature-card');
  if (card) {
    return card.querySelector('h3')?.textContent || '';
  }

  const newsItem = link.closest('.greatscience__panel');
  if (newsItem) {
    return newsItem.querySelector('.greatscience__title').textContent;
  }

  return '';
};

export const getPrice = (link) => {
  let price = 0;
  try {
    const product = link.closest('.products-card');

    if (product) {
      const value = product.querySelector('.products-card__price-value')?.textContent;
      const decimal = product.querySelector('.products-card__price-decimal')?.textContent;
      if (value) {
        price = `${value}${decimal}`;
      }
    }

    if (price) {
      // Remove currency symbols, letters, and spaces
      price = price.replace(/[^\d.,-]/g, '').trim();

      // Detect separators
      const hasComma = price.includes(',');
      const hasDot = price.includes('.');

      if (hasComma && hasDot) {
        if (price.lastIndexOf(',') > price.lastIndexOf('.')) {
          price = price.replace(/\./g, '').replace(',', '.');
        } else {
          price = price.replace(/,/g, '');
        }
      } else if (hasComma) {
        price = price.replace(',', '.');
      }
      return parseFloat(price);
    }
    return price;
  } catch (err) {
    return price;
  }
};

/**
 * Main function to track link clicks and push to Data Layer
 */
export const ctaLinkClicked = async (link) => {
  try {
    const {
      productId,
      productName,
      tilePosition,
      additionalFields,
    } = getResultData(link);

    let ads = { id: '', name: '', location: '' };
    const searchPromoted = link.closest('.search-promoted');

    if (searchPromoted) {
      const titleElement = searchPromoted.querySelector('h3');

      if (titleElement) {
        ads = {
          id: titleElement.getAttribute('id') || '',
          name: titleElement.textContent,
          location: new URLSearchParams(window.location.search).get('tab') || '',
        };
      }
    }

    const componentData = await getComponentData(link);

    const linkData = {
      event: 'cta-clicked',
      eventInfo: {
        type: 'agilent.webInteraction.ctaClicks',
      },
      xdm: {
        web: {
          webInteraction: {
            name: getLinkName(link),
            type: 'other',
            region: getLinkRegion(link),
            coupon: {
              code: getCouponCode(link),
            },
            content: { ads },
            URL: link.href || '',
          },
        },
        component: {
          ...componentData,
          product: {
            ...((additionalFields?.objecttype === 'product') && {
              id: productId,
              name: productName,
              price: getPrice(link),
              tilePosition,
            }),
          },
        },
      },
    };

    if (!link.dataset.productId) {
      delete linkData.xdm.component.product;
    }
    pushToDataLayer(linkData);
  } catch (error) {
    console.error('Error tracking CTA button click:', error);
  }
};

const getElementIndex = (list, item) => {
  const index = [...list.children].indexOf(item);
  return index + 1;
};

const getTilePosition = (link) => {
  // get tile position from search results page
  if (document.body.classList.contains('searchresults')) {
    const blockName = link.closest('[data-block-name]');
    return getElementIndex(link.closest('[data-block-name]').parentElement, blockName);
  }

  // get tile position from recently viewed component
  const recentlyViewedList = link.closest('ul.recently-viewed-product-wrapper');
  if (recentlyViewedList) {
    return getElementIndex(recentlyViewedList, link.closest('li'));
  }

  // get tile position from promo cards component
  const promoCard = link.closest('.promo-card');
  if (promoCard) {
    return getElementIndex(promoCard.parentElement, promoCard);
  }

  // get tile position from news
  const newsItem = link.closest('.greatscience__panel');
  if (newsItem) {
    return getElementIndex(newsItem.parentElement, newsItem);
  }

  // get tile position from column control component
  const column = link.closest('.columns-img-col');
  if (column) {
    const block = column.closest('[data-block-name="columns"]');
    const coloumns = block.querySelectorAll('.columns-img-col');
    return [...coloumns].indexOf(column) + 1;
  }

  // get tile position from sevice card list
  const serviceCardWrapper = link.closest('.service__cards-wrapper');
  if (serviceCardWrapper) {
    return getElementIndex(link.closest('ul'), link.parentElement);
  }

  return '';
};

/**
 * Main function to track link clicks and push to Data Layer
 */
export const trackLinkClicked = async (link) => {
  try {
    const componentData = await getComponentData(link);
    const interactionType = (link.parentElement.className.includes('qr-link') || link.getAttribute('href').includes('weixin.qq.com')) ? 'WeChatLaunch' : '';
    const {
      productId,
      productName,
      additionalFields,
      raw,
      uri,
    } = getResultData(link);

    const productData = {
      product: {
        id: '',
        name: '',
        price: 0,
        tilePosition: '',
      },
    };
    let { tilePosition } = getResultData(link);

    if (!tilePosition && link && link.getAttribute('href')) {
      tilePosition = getTilePosition(link).toString();
    }

    let additionalData = {
      type: '',
      publicationNumber: '',
      publicationDate: '',
      format: '',
      tilePosition,
    };

    if (Object.keys(additionalFields).length) {
      productData.product = {
        id: productId,
        name: productName,
        price: getPrice(link),
        tilePosition,
      };
    } else if (raw && typeof raw === 'object' && Object.keys(raw).length) {
      additionalData = {
        type: raw.objecttype || '',
        publicationNumber: raw.ec_part_numbers || '',
        publicationDate: raw.publicationdate || '',
        format: raw.filetype || '',
        tilePosition,
      };
    }

    const linkData = {
      event: 'link-clicked',
      eventInfo: {
        type: 'web.webinteraction.linkClicks',
      },
      xdm: {
        web: {
          webInteraction: {
            name: getLinkName(link),
            type: getLinkType(link),
            region: getLinkRegion(link),
            URL: getLinkHref(link),
            interactionType,
            content: {
              contentTitle: getContentTitle(link),
              ads: { id: link.dataset?.adId ?? '', name: link.dataset?.adName ?? '' },
              id: uri,
              ...additionalData,
            },
          },
        },
        component: {
          uniqueID: componentData.uniqueID || '',
          name: componentData.name || '',
          type: componentData.type || '',
          ...productData,
        },
      },
    };
    pushToDataLayer(linkData);
  } catch (error) {
    // eslint-disable-next-line no-console
    console.error('Error tracking link click:', error);
  }
};

export const ctaRequestQuoteClicked = async (link) => {
  try {
    const componentData = await getComponentData(link);
    const {
      productId,
      productName,
    } = getResultData(link);
    const ctaClickData = {
      event: 'request-quote',
      eventInfo: {
        type: 'agilent.webInteraction.requestQuote',
      },
      xdm: {
        web: {
          webInteraction: {
            name: getLinkName(link),
            type: 'other',
            region: getLinkRegion(link),
          },
        },
        component: {
          uniqueID: componentData.uniqueID || '',
          name: componentData.name || '',
          type: componentData.type || '',
          requestQuoteLocation: 'Search Results',
          product: {
            id: productId,
            name: productName,
          },
        },
      },
    };
    pushToDataLayer(ctaClickData);
  } catch (error) {
    // eslint-disable-next-line no-console
    console.error('Error tracking request quote click:', error);
  }
};

/**
 * Request demo event
 */
export const ctaRequestDemoClicked = async (link) => {
  try {
    const componentData = await getComponentData(link);
    const {
      productId,
      productName,
    } = getResultData(link);
    const ctaClickData = {
      event: 'request-demo',
      eventInfo: {
        type: 'agilent.webInteraction.requestDemo',
      },
      xdm: {
        web: {
          webInteraction: {
            name: getLinkName(link),
            type: 'other',
            region: getLinkRegion(link),
          },
        },
        component: {
          uniqueID: componentData.uniqueID || '',
          name: componentData.name || '',
          type: componentData.type || '',
          location: 'Search Results',
          product: {
            id: productId,
            name: productName,
          },
        },
      },
    };
    pushToDataLayer(ctaClickData);
  } catch (error) {
    // eslint-disable-next-line no-console
    console.error('Error tracking request demo click:', error);
  }
};

export const trackPageViewEvent = () => {
  try {
    const sectionData = ((path) => (path.split('/').filter(Boolean).at(1) || 'home'))(window.location.pathname);
    const loginStatus = isLoggedIn();
    const user = localStorage.getItem('userObj');
    let breadcrumbs = JSON.parse(getMetadata('breadcrumb') || '[]').map((item) => item.name).join('>');

    if (document.body.classList.contains('searchresults')) {
      const query = new URLSearchParams(window.location.search).get('q');
      breadcrumbs = (query && breadcrumbs.concat('>', (query.charAt(0).toUpperCase() + query.slice(1)))) || '';
    }

    const event = {
      event: 'page_view',
      eventInfo: {
        type: 'web.webpagedetails.pageViews',
      },
      xdm: {
        web: {
          webPageDetails: {
            name: `${getLocale().country}: ${getFileName()}`,
            title: document.title,
            URL: window.location.href,
            language: getLocale().languageCountry || '',
            breadcrumbs,
            siteSection: sectionData,
            siteSubSectionL1: '',
          },
        },
        user: {
          loginStatus,
          userID: loginStatus && user ? JSON.parse(user).userId : '',
          sapECCID: '',
          userType: loginStatus ? localStorage.getItem('customerType') : '',
        },
      },
    };
    pushToDataLayer(event);
  } catch (error) {
    // eslint-disable-next-line no-console
    console.error('Error tracking page view event: ', error);
  }
};

/**
 * Link Click Tracking for global implementation
 */
const initializeLinkClickTracking = () => {
  const eventInteraction = (e) => {
    const clickedTarget = e.target.closest('a[data-ag-button], button.agt-button.agt-button--primary');
    if (clickedTarget && clickedTarget.matches('a[data-ag-button]')) {
      const buttonType = clickedTarget.getAttribute('data-ag-button');
      if (buttonType === 'requestQuote') {
        ctaRequestQuoteClicked(clickedTarget);
      } else if (buttonType === 'requestDemo') {
        ctaRequestDemoClicked(clickedTarget);
        return;
      }
    } else if (clickedTarget && clickedTarget.matches('button.agt-button.agt-button--primary')) {
      if (clickedTarget.getAttribute('type') === 'submit') {
        ctaLinkClicked(clickedTarget, e);
      }
    }
    const clickedElement = e.target.closest('a');
    if (clickedElement && shouldTrackLink(clickedElement)) {
      if (isCTAButton(clickedElement)) {
        ctaLinkClicked(clickedElement, e);
      } else {
        trackLinkClicked(clickedElement, e);
      }
      return;
    }

    if (e.target.classList?.contains('header__nav-section-button')) {
      ctaLinkClicked(e.target);
    }
  };
  const events = ['click', 'auxclick'];
  events.forEach((eventType) => {
    document.addEventListener(eventType, eventInteraction, true);
  });
};

/**
 * Initialize all global tracking events
 */
export const initializeGlobalTracking = () => {
  trackPageViewEvent();
  initializeLinkClickTracking();
  // Add other upcoming tracking initializations here in future

  // Initiate search analytics if it is search results page
  if (document.body.classList.contains('searchresults')) {
    initiateSearchResultsAnalytics();
    const tabs = document.querySelectorAll('.search-results__tabs-control .tab');
    let selectedTabId = document.querySelector('.search-results__tabs-control [aria-selected="true"]').getAttribute('data-tab-id');
    const handleTabClick = (tabId) => {
      if (selectedTabId !== tabId) {
        trackPageViewEvent();
        selectedTabId = tabId;
      }
    };
    tabs.forEach((tab) => {
      tab.addEventListener('click', (e) => { handleTabClick(e.target.getAttribute('data-tab-id')); });
    });
  }
};

/**
 * Initializes  Client Data Layer tracking with a small delay
 * to ensure all content is loaded and Client Data Layer is ready
*/
export const initializeDataLayer = () => new Promise((resolve) => {
  try {
    initializeGlobalTracking();
    resolve(true);
  } catch (error) {
    // eslint-disable-next-line no-console
    console.warn('Data Layer initialization failed:', error);
    resolve(false);
  }
});
