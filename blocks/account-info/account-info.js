import {
  html,
  getPlaceholder,
  decorateIcons,
  prepareGetAssetPath,
  loadEnvConfig,
  readBlockConfig,
  addImageErrorHandler,
  getLocale,
  isLoggedIn,
} from '../../scripts/aem.js';

const duplicateSeeAllLink = (seeAllLink, wrapper) => {
  const isMobile = window.matchMedia('(max-width: 767px)');
  const clonedViewAllLink = seeAllLink.cloneNode(true);
  clonedViewAllLink.className = 'agt-button agt-button--small agt-button--secondary';
  wrapper.append(html`<div class="button-wrapper">${clonedViewAllLink}</div>`);
  const updateVisibility = (e) => {
    if (e.matches) {
      clonedViewAllLink.classList.remove('hidden');
      clonedViewAllLink.setAttribute('aria-hidden', false);
      seeAllLink.classList.add('hidden');
      seeAllLink.setAttribute('aria-hidden', true);
    } else {
      clonedViewAllLink.classList.add('hidden');
      clonedViewAllLink.setAttribute('aria-hidden', true);
      seeAllLink.classList.remove('hidden');
      seeAllLink.setAttribute('aria-hidden', false);
    }
  };
  isMobile.addEventListener('change', (e) => {
    updateVisibility(e);
  });

  updateVisibility(isMobile);
};

const decorateRecentOrder = async (accountRecentOrders, orderData, orderCount) => {
  const orders = orderData.recentOrders;
  const count = orderCount;
  const selectedOrders = orders.slice(0, count);

  const recentOrderTitleWrapper = html`<div class="recent-order__title"></div>`;
  recentOrderTitleWrapper.append(...[...accountRecentOrders.children]);
  accountRecentOrders.append(recentOrderTitleWrapper);
  const viewAllLink = accountRecentOrders.querySelector('a');
  const recentOrderContainer = html`<div class="recent-orders"></div>`;
  const config = await loadEnvConfig();
  const countryCode = getLocale().country;

  selectedOrders.forEach((order) => {
    const shippedDate = order.deliveryDate || '';
    const orderProgress = order.status || '';
    const encOrderId = btoa(order.orderId);
    let orderUrl = `${config.orderIdurl}${encOrderId}`;
    if (countryCode && countryCode.toLowerCase() === 'cn') {
      orderUrl = orderUrl.replace('.com/', '.com.cn/');
    }
    const orderTitle = getPlaceholder('ORDER# {0}', order.orderId);
    const getStatusText = (status) => {
      const normalizedStatus = status?.toLowerCase();
      const statusValue = getPlaceholder(`${normalizedStatus}`);
      return getPlaceholder('Status: {0}', statusValue);
    };

    const statusText = getStatusText(orderProgress);
    const shippedText = getPlaceholder('shipped');
    const orderElement = html`<div class="recent-order">
      <a href="${orderUrl}" class="recent-order__title">${orderTitle}</a>
      <div class="recent-order__delivery-info">${shippedDate ? `${shippedText}: ${shippedDate}` : ''}</div>
      <div class="recent-order__info">
        <div class="recent-order__delivery-status">${statusText}</div>
      </div>
    </div>`;
    recentOrderContainer.appendChild(orderElement);
  });

  if (selectedOrders.length === 0) {
    const noOrdersMessage = html`<div class="recent-order">
      <p class="no-orders-message">${getPlaceholder('No data')}</p>
    </div>`;
    recentOrderContainer.appendChild(noOrdersMessage);
  }

  accountRecentOrders.appendChild(recentOrderContainer);
  decorateIcons(recentOrderContainer);
  if (viewAllLink) {
    duplicateSeeAllLink(viewAllLink, accountRecentOrders);
  }
};

const decorateBuyItAgain = async (accountBuyItAgain, orderData, fallbackImage = null) => {
  const productResponse = orderData.productBuy;
  const buyItAgainContainer = html`<div class="buy-it-again"></div>`;

  const lastThreeProducts = productResponse.slice(0, 3);

  lastThreeProducts.forEach(async (product) => {
    const { partNumber } = product;
    const { productName } = product;
    const fullAssetPath = await prepareGetAssetPath();
    const productURL = `/store/productDetail.jsp?catalogId=${partNumber}`;
    const productImage = product.imageURL?.[0]?.externalAssetURL || '';

    const imageSrc = productImage ? fullAssetPath(productImage) : (fallbackImage?.src || '');
    const imageAlt = productImage ? `${productName}` : (fallbackImage?.alt || '');

    const productElement = html`<div class="product" tabindex="0" role="button" aria-label="${getPlaceholder('Product Aria Label', productName, getPlaceholder('Part Number'), partNumber)}">
      <a href="${productURL}" class="product__image-link" tabindex="-1">
        <img src="${imageSrc}" alt="${imageAlt}" class="product__image" />
      </a>
      <a href="${productURL}" class="product__name" tabindex="-1">${productName}</a>
      <div class="product__part-number">${partNumber}</div>
    </div>`;

    const imgElement = productElement.querySelector('.product__image');
    addImageErrorHandler(imgElement, fallbackImage);

    // Common function to handle navigation
    const navigateToProduct = () => {
      window.location.href = productURL;
    };

    // Add keyboard and click event handlers for accessibility
    productElement.addEventListener('keydown', (event) => {
      if (event.key === 'Enter' || event.key === ' ') {
        event.preventDefault();
        navigateToProduct();
      }
    });

    productElement.addEventListener('click', (event) => {
      // Only handle clicks on the container itself or non-link elements
      if (event.target === productElement || (!event.target.closest('a'))) {
        navigateToProduct();
      }
    });

    buyItAgainContainer.appendChild(productElement);
  });
  accountBuyItAgain.appendChild(buyItAgainContainer);
};

const isUserEcomStatusWeb = () => {
  const userObj = localStorage.getItem('userObj');
  try {
    const parsedUserObj = JSON.parse(userObj);
    if (parsedUserObj && (parsedUserObj.eCommerceStatus || '').toLowerCase() === 'web') {
      return true;
    }
  } catch (error) {
    console.warn('Error parsing userObj from localStorage:', error);
  }
  return false;
};

const handleEcomWebUserLinks = async (accountQuickLinks) => {
  const config = await loadEnvConfig();
  if (isUserEcomStatusWeb() && config) {
    if (config.ecomStatusWebUserOrdersRelativeUrl) {
      const webOrdersLink = accountQuickLinks.querySelector('a[href*="/hub/orders"]');
      if (webOrdersLink) {
        webOrdersLink.href = config.ecomStatusWebUserOrdersRelativeUrl;
      }
    }
    if (config.ecomStatusWebUserQuotesRelativeUrl) {
      const webQuotesLink = accountQuickLinks.querySelector('a[href*="/hub/quotes"]');
      if (webQuotesLink) {
        webQuotesLink.href = config.ecomStatusWebUserQuotesRelativeUrl;
      }
    }
  }
};

const decorateAccountQuickLinks = async (accountQuickLinks, wrapper) => {
  handleEcomWebUserLinks(accountQuickLinks);
  accountQuickLinks.className = 'account-info__quicklinks';
  const links = accountQuickLinks.querySelector('ul');
  accountQuickLinks.children[0].replaceWith(links);

  const viewAllLink = wrapper.querySelector('.section__link a');
  duplicateSeeAllLink(viewAllLink, accountQuickLinks);
};

const decorateOrderDetails = async (
  accountOrderDetails,
  orderData,
  orderCount,
  extractedImage = null,
) => {
  if (!orderData?.recentOrders?.length) {
    accountOrderDetails.style.display = 'none';
    return;
  }

  accountOrderDetails.className = 'account-info__order-details';
  const [accountRecentOrders, accountBuyItAgain] = [...accountOrderDetails.children];
  accountRecentOrders.className = 'account-info__recent-orders';
  accountBuyItAgain.className = 'account-info__buy-it-again';
  await decorateRecentOrder(accountRecentOrders, orderData, orderCount);
  await decorateBuyItAgain(accountBuyItAgain, orderData, extractedImage?.fallbackImage);
};

const extractAndHideImage = (block) => {
  const config = readBlockConfig(block);
  const { agilentSparkIcon } = config;
  const { orderCount } = config;

  let fallbackImage = null;

  if (block.children.length >= 4) {
    const imageElement = block.children[2].querySelector('img');
    if (imageElement) {
      fallbackImage = {
        src: imageElement.src,
        alt: imageElement.alt,
      };
    }

    block.children[3].remove();
    block.children[2].remove();
  }

  return { agilentSparkIcon, orderCount, fallbackImage };
};

const updateWelcomeText = (wrapper) => {
  let firstName;
  try {
    const userInfo = JSON.parse(window.localStorage.getItem('userObj'));
    if (userInfo && userInfo.firstName) {
      firstName = userInfo.firstName;
    } else {
      throw new Error('First name not found');
    }
  } catch (e) {
    console.warn('Error parsing userInfo from localStorage:', e);
    firstName = window.localStorage.getItem('userName');
  }

  const welcomeText = wrapper.querySelector('.section__title');
  welcomeText.innerHTML = welcomeText.innerHTML.replace('##firstName##', firstName);

  if (firstName) {
    const firstLetter = firstName.charAt(0).toUpperCase();
    const initialsLogo = html`<span class="user-initials">${firstLetter}</span>`;
    welcomeText.insertBefore(initialsLogo, welcomeText.firstChild);
  }
};

async function checkPermissions() {
  if (!isLoggedIn()) {
    return false;
  }

  const { isEcomEnabled } = await import('../../scripts/services/atg.api.js');
  const isCountryValid = await isEcomEnabled();
  if (!isCountryValid) {
    return false;
  }

  const userObjJSON = localStorage.getItem('userObj');
  try {
    const userObj = JSON.parse(userObjJSON);
    const sapUser = userObj?.eCommerceStatus;
    const myARole = userObj?.provisionApps?.includes('MYA');
    return sapUser && myARole;
  } catch (error) {
    // eslint-disable-next-line no-console
    console.error('Error parsing userObjJSON:', error);
    return false;
  }
}

export default async function decorate(block) {
  const wrapper = block.closest('.account-info-container');
  const hasPermission = await checkPermissions();
  if (!hasPermission) {
    wrapper.remove();
    return;
  }

  const extractedImage = extractAndHideImage(block);

  updateWelcomeText(wrapper);

  if (block.children.length >= 2) {
    const [accountQuickLinks, accountOrderDetails] = [...block.children];
    await decorateAccountQuickLinks(accountQuickLinks, wrapper);
    const { fetchRecentOrders } = await import('../../scripts/services/myA.api.js');
    const orderData = await fetchRecentOrders();
    await decorateOrderDetails(
      accountOrderDetails,
      orderData,
      extractedImage?.orderCount,
      extractedImage,
    );
  } else {
    // eslint-disable-next-line no-console
    console.warn('Invalid authoring for Account Info block');
  }
}
