import {
  decorateIcons,
  html,
  readBlockConfig,
  addImageErrorHandler,
  getLocale,
} from '../../scripts/aem.js';
import { createCarousel } from './recently-viewed-carousel.js';

function getFromLocalStorage(key, defaultValue = null) {
  try {
    const item = localStorage.getItem(key);
    return item !== null ? item : defaultValue;
  } catch (error) {
    return defaultValue;
  }
}

/**
 * Filter items to only include those newer than 90 days
 * @param {Array} items - Array of product items with timestamps
 * @returns {Array} - Filtered array of recent items
 */
function filterRecentItems(items) {
  const dateCutoff = Date.now() - (90 * 24 * 60 * 60 * 1000); // 90 days in milliseconds

  return items.filter((item) => {
    if (!item.timestamp) {
      return true;
    }

    const itemTimestamp = parseInt(item.timestamp, 10);
    return itemTimestamp > dateCutoff;
  });
}

function cardEnhancement() {
  const cardsArray = Array.prototype.slice.call(document.querySelectorAll('[data-component="card"]'));
  if (cardsArray.length > 0) {
    // Loop through cards adding a click event and identifying the main link
    cardsArray.forEach((card) => {
      const mainLink = card.querySelector('.card__link');

      card.addEventListener('click', (ev) => {
        if (ev.redispatched || ev.target === mainLink) {
          return;
        }
        const noTextSelected = !window.getSelection().toString();
        if (noTextSelected) {
          const ev2 = new MouseEvent('click', ev);
          ev2.redispatched = true;
          mainLink.dispatchEvent(ev2);
        }
      });
    });
  }
}

export default function decorate(block) {
  const recentlyViewed = getFromLocalStorage('recentlyViewed');
  if (!recentlyViewed) {
    const section = block.closest('.section');
    if (section) {
      section.remove();
    }
    return;
  }

  // Parse the JSON data
  let parsedData;
  try {
    parsedData = JSON.parse(recentlyViewed);
  } catch (error) {
    block.remove();
    return;
  }

  // Extract items for the current region with fallback logic
  const region = getLocale().country;
  let allItems = parsedData[region] || [];
  if (allItems.length === 0) {
    allItems = parsedData.US || [];
    if (allItems.length === 0) {
      const availableRegions = Object.keys(parsedData);
      allItems = availableRegions.reduce(
        (acc, regionKey) => acc.concat(parsedData[regionKey] || []),
        [],
      );
    }
  }

  // Filter out items older than 90 days
  const items = filterRecentItems(allItems);
  const config = readBlockConfig(block);
  const { agilentSparkIcon } = config;

  if (items.length === 0) {
    block.remove();
    return;
  }

  const h2 = document.createElement('h2');
  h2.className = 'recently-viewed-heading';

  if (block.children.length > 0) {
    h2.append(block.children[0].firstElementChild);
  }

  const carouselControlsWrapper = document.createElement('div');
  carouselControlsWrapper.className = 'carousel-controls-wrapper';

  const carouselWrapper = document.createElement('div');
  carouselWrapper.className = 'carousel-wrapper';

  const ul = document.createElement('ul');
  ul.className = 'recently-viewed-product-wrapper';
  ul.setAttribute('aria-label', 'recently viewed products');

  carouselControlsWrapper.append(carouselWrapper);
  carouselWrapper.append(ul);

  items.forEach((item) => {
    const {
      productId,
      productDescription,
      productName,
      productUrl,
      thumbnailAlt,
      thumbnailUrl,
    } = item.product;

    const productData = JSON.stringify({ ec_name: productName, ec_product_id: productId, additionalFields: [{ objecttype: 'product' }] });

    const imageSrc = thumbnailUrl || agilentSparkIcon || '';
    const imageAlt = thumbnailAlt || productName || '';
    const li = html`
      <li data-result='${productData}' data-component="card">
        <div class="agt-card">
          <div class="agt-card--image-wrapper">
            <img
              class="agt-card--image"
              src="${imageSrc}" 
              alt="${imageAlt}" />
          </div>
          <h3 class="agt-card--headline">
            <a class="card__link" href="${productUrl}" aria-label="${productName}">
              ${productName}
            </a>
          </h3>
          <p class="agt-card--description">
            ${productDescription}
          </p>
        </div>
      </li>
    `;

    const imgElement = li.querySelector('.agt-card--image');
    addImageErrorHandler(imgElement, agilentSparkIcon);
    ul.append(li);
  });

  const isTablet = window.matchMedia('(min-width: 768px) and (max-width: 1025px)').matches;
  const isDesktop = window.matchMedia('(min-width: 1025px)').matches;
  const itemsPerPageTablet = isTablet ? 3 : 2;
  const itemsPerPage = isDesktop ? 4 : itemsPerPageTablet;

  if (items.length > itemsPerPage) {
    const carousel = createCarousel(carouselWrapper, ul, itemsPerPage);
    carousel.init();
    carouselControlsWrapper.append(carouselWrapper);
  }

  block.textContent = '';
  block.append(h2);
  block.append(carouselControlsWrapper);

  decorateIcons(block);
  cardEnhancement();
}
