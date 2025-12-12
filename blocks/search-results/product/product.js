import {
  decorateIcons,
  html,
  getPlaceholder,
  decorateLabel,
  loadBlock,
  decorateBlock,
  prepareGetAssetPath,
  addImageErrorHandler,
  getLocale,
  getCountryInfo,
} from '../../../scripts/aem.js';

import {
  fetchEcomEnabled,
  isEcomEnabled,
  isPartECSaleable,
  getRequestQuoteBlock,
} from '../../../scripts/services/atg.api.js';

import {
  trackCoveoEvent,
} from '../../../scripts/coveo/coveo-analytics.js';

const gridCreateImages = async (images, CardAttributes, cardTitle = '', fallbackImage = null) => {
  const {
    isFullyObsolete,
    clickableUrl,
  } = CardAttributes;
  let currentIndex = 0;
  const hasMultipleImages = images.length > 1;
  const fullAssetPath = await prepareGetAssetPath();
  const imageOfText = getPlaceholder('Image of', cardTitle);

  const createImageElement = (img, idx) => {
    const imgSrc = typeof img === 'string' ? img : img.src;
    const imgAlt = typeof img === 'string' ? imageOfText : (img.alt || imageOfText);
    if (isFullyObsolete) {
      return `
          <img loading="${CardAttributes.eager ? 'eager' : 'lazy'}" fetchpriority="${CardAttributes.eager ? 'high' : 'auto'}" class="products-card__main-image${idx === currentIndex ? ' products-card__main-image--active' : ''}" aria-hidden="${idx === currentIndex ? 'false' : 'true'}" src="${fullAssetPath(imgSrc)}" data-index="${idx}" alt="${imgAlt}" />
        `;
    }
    return `
        <a href="${clickableUrl}" data-product-click aria-hidden="true" tabindex="-1">
          <img loading="${CardAttributes.eager ? 'eager' : 'lazy'}" fetchpriority="${CardAttributes.eager ? 'high' : 'auto'}" class="products-card__main-image${idx === currentIndex ? ' products-card__main-image--active' : ''}" aria-hidden="${idx === currentIndex ? 'false' : 'true'}" src="${fullAssetPath(imgSrc)}" data-index="${idx}" alt="${imgAlt}" />
        </a>
      `;
  };
  const mediaWrapper = document.createElement('div');

  // Create HTML with scroll-based carousel
  const allImages = images.map((img, idx) => createImageElement(img, idx)).join('');

  mediaWrapper.innerHTML = `
    <div class="products-card__media-wrapper">
      <div class="products-card__media-image-wrapper">
        ${hasMultipleImages ? `<button class="products-card__nav-button products-card__nav-button--left" aria-label="${getPlaceholder('Previous image')}"><span class="icon icon-chevron-left"></span></button>` : ''}
        <div class="products-card__images-wrapper">
          ${allImages}
        </div>
        ${hasMultipleImages ? `<button class="products-card__nav-button products-card__nav-button--right" aria-label="${getPlaceholder('Next image')}"><span class="icon icon-chevron-right"></span></button>` : ''}
      </div>
    </div>
  `;

  const scrollToImage = (index) => {
    const imagesWrapper = mediaWrapper.querySelector('.products-card__images-wrapper');
    const imageWidth = imagesWrapper.clientWidth;
    const scrollPosition = index * imageWidth;

    imagesWrapper.scrollTo({
      left: scrollPosition,
      behavior: 'smooth',
    });

    // Update active classes
    const imageElements = imagesWrapper.querySelectorAll('.products-card__main-image');
    imageElements.forEach((img, idx) => {
      img.classList.toggle('products-card__main-image--active', idx === index);
      img.setAttribute('aria-hidden', idx === index ? 'false' : 'true');
    });

    currentIndex = index;
  };

  const moveLeft = () => {
    const newIndex = currentIndex > 0 ? currentIndex - 1 : images.length - 1;
    scrollToImage(newIndex);
  };

  const moveRight = () => {
    const newIndex = currentIndex < images.length - 1 ? currentIndex + 1 : 0;
    scrollToImage(newIndex);
  };

  const handleScroll = () => {
    const imagesWrapper = mediaWrapper.querySelector('.products-card__images-wrapper');
    const imageWidth = imagesWrapper.clientWidth;
    const { scrollLeft } = imagesWrapper;
    const newIndex = Math.round(scrollLeft / imageWidth);

    if (newIndex !== currentIndex && newIndex >= 0 && newIndex < images.length) {
      const imageElements = imagesWrapper.querySelectorAll('.products-card__main-image');
      imageElements.forEach((img, idx) => {
        img.classList.toggle('products-card__main-image--active', idx === newIndex);
        img.setAttribute('aria-hidden', idx === newIndex ? 'false' : 'true');
      });

      currentIndex = newIndex;
    }
  };

  if (hasMultipleImages) {
    const leftButton = mediaWrapper.querySelector('.products-card__nav-button--left');
    const rightButton = mediaWrapper.querySelector('.products-card__nav-button--right');
    const imagesWrapper = mediaWrapper.querySelector('.products-card__images-wrapper');

    if (leftButton) leftButton.addEventListener('click', moveLeft);
    if (rightButton) rightButton.addEventListener('click', moveRight);

    if (imagesWrapper) {
      imagesWrapper.addEventListener('scroll', handleScroll);
      imagesWrapper.scrollLeft = 0;
      imagesWrapper.scrollTo({ left: 0, behavior: 'auto' });

      setTimeout(() => {
        imagesWrapper.scrollLeft = 0;
        currentIndex = 0;
      }, 50);
    }
  }
  const imgElements = mediaWrapper.querySelectorAll('.products-card__main-image');
  imgElements.forEach((imgEle) => {
    addImageErrorHandler(imgEle, fallbackImage);
  });

  return mediaWrapper;
};

const listCreateImages = async (images, CardAttributes, cardTitle = '', fallbackImage = null) => {
  const {
    isFullyObsolete,
    clickableUrl,
  } = CardAttributes;
  let currentIndex = 0;
  const hasMultipleImages = images.length > 1;
  const fullAssetPath = await prepareGetAssetPath();
  const imageOfText = getPlaceholder('Image of', cardTitle);
  const openProductPageText = getPlaceholder('Open product page of', cardTitle);

  const renderMainImages = async () => images
    .map((img, idx) => {
      const imgSrc = typeof img === 'string' ? img : img.src;
      const imgAlt = typeof img === 'string' ? imageOfText : (img.alt || imageOfText);
      if (isFullyObsolete) {
        return `
          <img loading="${CardAttributes.eager ? 'eager' : 'lazy'}" fetchpriority="${CardAttributes.eager ? 'high' : 'auto'}" class="products-card__main-image${idx === currentIndex ? ' products-card__main-image--active' : ''}" aria-hidden="${idx === currentIndex ? 'false' : 'true'}" src="${fullAssetPath(imgSrc)}" data-index="${idx}" alt="${imgAlt}" />
        `;
      }
      return `
        <a href="${clickableUrl}" aria-hidden="true" tabindex="-1">
          <img loading="${CardAttributes.eager ? 'eager' : 'lazy'}" fetchpriority="${CardAttributes.eager ? 'high' : 'auto'}" class="products-card__main-image${idx === currentIndex ? ' products-card__main-image--active' : ''}" aria-hidden="${idx === currentIndex ? 'false' : 'true'}" src="${fullAssetPath(imgSrc)}" data-index="${idx}" alt="${imgAlt}" />
        </a>
      `;
    })
    .join('');

  const createPreviewImages = async () => {
    let maxDots = 4;
    let isMobile = false;

    if (window.matchMedia('(max-width: 767px)').matches) {
      maxDots = 5;
      isMobile = true;
    } else if (window.matchMedia('(max-width: 1200px)').matches) {
      maxDots = 3;
    }

    let start = 0;
    let end = maxDots;

    if (images.length > maxDots && currentIndex >= maxDots - 1) {
      start = currentIndex - Math.floor(maxDots - 1);
      end = start + maxDots;

      if (end > images.length) {
        end = images.length;
        start = end - maxDots;
      }
    }

    const visibleImages = images.slice(start, end);
    // Generate the HTML for the visible thumbnails Images
    let previewHTML = (await Promise.all(visibleImages
      .map((img, index) => {
        const globalIndex = start + index;
        if (isMobile) {
          return `<span class="products-card__preview-dot${globalIndex === currentIndex ? ' products-card__preview-dot--active' : ''}" data-index="${globalIndex}" aria-hidden="${globalIndex === currentIndex ? 'false' : 'true'}" tabindex="0" role="button" aria-label="${getPlaceholder('Thumbnail image', [globalIndex + 1])} ${cardTitle} ${globalIndex === currentIndex ? `${getPlaceholder('Selected')}` : ''}"
              aria-selected="${globalIndex === currentIndex ? 'true' : 'false'}"></span>`;
        }
        return `
            <img
              loading="${CardAttributes.eager ? 'eager' : 'lazy'}" 
              fetchpriority="${CardAttributes.eager ? 'high' : 'auto'}"
              class="products-card__preview-image${globalIndex === currentIndex ? ' products-card__preview-image--active' : ''}"
              src="${fullAssetPath(img)}"
              data-index="${globalIndex}"
              tabindex="0"
              role="button"
              alt="${getPlaceholder('Thumbnail image', [globalIndex + 1])} ${cardTitle} ${globalIndex === currentIndex ? `${getPlaceholder('Selected')}` : ''}"
              aria-selected="${globalIndex === currentIndex ? 'true' : 'false'}"
            />
          `;
      })))
      .join('');

    if (end < images.length) {
      const remainingCount = images.length - end;
      previewHTML += `
          <a class="products-card__more-images" aria-label="${openProductPageText}" data-remaining="${remainingCount}" href="${clickableUrl}" >
            +${remainingCount}
          </a>
        `;
    }

    return previewHTML;
  };

  const mediaWrapper = document.createElement('div');
  const shouldShowNavigation = hasMultipleImages;
  const singleImageClass = !shouldShowNavigation ? ' products-card__media-wrapper--single-image' : '';
  const thumbnailCount = images.length;
  const multiThumbnailClass = thumbnailCount > 3 ? ' products-card__preview-wrapper--flexible-gap' : '';

  mediaWrapper.innerHTML = `
    <div class="products-card__media-wrapper${singleImageClass}">
      <div class="products-card__main-image-wrapper">
        ${shouldShowNavigation ? '<button class="products-card__nav-button products-card__nav-button--left" aria-hidden="true"><span class="icon icon-chevron-left"></span></button>' : ''}
        <div class="products-card__main-image-scroll-container">
          ${await renderMainImages()}
        </div>
        ${shouldShowNavigation ? '<button class="products-card__nav-button products-card__nav-button--right" aria-hidden="true"><span class="icon icon-chevron-right"></span></button>' : ''}
      </div>
      ${hasMultipleImages ? `<div class="products-card__preview-wrapper${multiThumbnailClass}">${await createPreviewImages()}</div>` : ''}
    </div>
  `;

  const setActiveImageClasses = (mainImages, previewImages, previewDots, activeIndex) => {
    mainImages.forEach((img, i) => {
      img.setAttribute('aria-hidden', i === activeIndex ? 'false' : 'true');
      img.classList.toggle('products-card__main-image--active', i === activeIndex);
    });

    previewImages.forEach((img) => {
      const isActive = parseInt(img.dataset.index, 10) === activeIndex;
      const globalIndex = parseInt(img.dataset.index, 10);
      img.classList.toggle('products-card__preview-image--active', isActive);
      img.setAttribute('aria-selected', isActive ? 'true' : 'false');

      const baseLabel = `${getPlaceholder('Thumbnail image', [globalIndex + 1])} ${cardTitle}`;
      const selectedText = isActive ? ` ${getPlaceholder('Selected')}` : '';
      img.setAttribute('aria-label', baseLabel + selectedText);
    });

    previewDots.forEach((dot) => {
      const isActive = parseInt(dot.dataset.index, 10) === activeIndex;
      const globalIndex = parseInt(dot.dataset.index, 10);
      dot.classList.toggle('products-card__preview-dot--active', isActive);
      dot.setAttribute('aria-selected', isActive ? 'true' : 'false');

      const baseLabel = `${getPlaceholder('Thumbnail image', [globalIndex + 1])} ${cardTitle}`;
      const selectedText = isActive ? ` ${getPlaceholder('Selected')}` : '';
      dot.setAttribute('aria-label', baseLabel + selectedText);
    });
  };

  function updateMainImage(wrapper, index, shouldScroll = true) {
    const mainImages = wrapper.querySelectorAll('.products-card__main-image');
    const previewImages = wrapper.querySelectorAll('.products-card__preview-image');
    const previewDots = wrapper.querySelectorAll('.products-card__preview-dot');

    if (shouldScroll) {
      mainImages[index].scrollIntoView({
        behavior: 'smooth',
        inline: 'center',
        block: 'nearest',
      });
    }

    setActiveImageClasses(mainImages, previewImages, previewDots, index, cardTitle);
  }

  async function updatePreviewImages(wrapper) {
    const previewWrapper = wrapper.querySelector('.products-card__preview-wrapper');
    previewWrapper.innerHTML = await createPreviewImages();

    const previewDots = previewWrapper.querySelectorAll('.products-card__preview-dot');

    previewDots.forEach((dot) => {
      dot.addEventListener('click', async () => {
        const idx = parseInt(dot.getAttribute('data-index'), 10);
        updateMainImage(wrapper, idx);
        currentIndex = idx;
        await updatePreviewImages(wrapper);
      });
    });

    const previewImages = previewWrapper.querySelectorAll('.products-card__preview-image');
    previewImages.forEach((img) => {
      addImageErrorHandler(img, fallbackImage);
      img.addEventListener('click', async () => {
        const idx = parseInt(img.getAttribute('data-index'), 10);
        updateMainImage(wrapper, idx);
        currentIndex = idx;
        await updatePreviewImages(wrapper);
      });
    });
  }

  function trackActiveImageOnScroll(wrapper) {
    const scrollContainer = wrapper.querySelector('.products-card__main-image-wrapper');
    const mainImages = wrapper.querySelectorAll('.products-card__main-image');
    let lastIndex = currentIndex;
    let lastThumbWindow = null;

    function getThumbWindow(idx) {
      let maxDots = 4;
      if (window.matchMedia('(max-width: 767px)').matches) maxDots = 5;
      else if (window.matchMedia('(max-width: 1024px)').matches) maxDots = 3;

      let start = 0;
      let end = maxDots;

      if (images.length > maxDots && idx >= maxDots - 1) {
        start = idx - Math.floor(maxDots - 1);
        end = start + maxDots;

        if (end > images.length) {
          end = images.length;
          start = end - maxDots;
        }
      }

      return `${start}-${end}`;
    }

    // Add scroll event listener to the scroll container
    scrollContainer.addEventListener('scroll', () => {
      let closestIndex = -1;
      let closestDistance = Infinity;

      const containerRect = scrollContainer.getBoundingClientRect();
      const containerCenter = containerRect.left + containerRect.width / 2;

      mainImages.forEach((img, index) => {
        const imgRect = img.getBoundingClientRect();
        const imgCenter = imgRect.left + imgRect.width / 2;
        const distance = Math.abs(containerCenter - imgCenter);

        if (distance < closestDistance) {
          closestDistance = distance;
          closestIndex = index;
        }
      });

      const thumbWindow = getThumbWindow(closestIndex);

      if (closestIndex !== -1 && (closestIndex !== lastIndex || thumbWindow !== lastThumbWindow)) {
        currentIndex = closestIndex;
        lastIndex = closestIndex;

        if (thumbWindow !== lastThumbWindow) {
          lastThumbWindow = thumbWindow;
          updatePreviewImages(wrapper);
        }

        const previewImages = wrapper.querySelectorAll('.products-card__preview-image');
        const previewDots = wrapper.querySelectorAll('.products-card__preview-dot');
        setActiveImageClasses(mainImages, previewImages, previewDots, currentIndex, cardTitle);
      }
    });
  }

  const moveLeft = (wrapper) => {
    currentIndex = (currentIndex - 1 + images.length) % images.length;
    updateMainImage(wrapper, currentIndex);
  };

  const moveRight = (wrapper) => {
    currentIndex = (currentIndex + 1) % images.length;
    updateMainImage(wrapper, currentIndex);
  };

  if (shouldShowNavigation) {
    mediaWrapper.querySelector('.products-card__nav-button--left').addEventListener('click', () => {
      moveLeft(mediaWrapper);
      updatePreviewImages(mediaWrapper);
    });
    mediaWrapper.querySelector('.products-card__nav-button--right').addEventListener('click', () => {
      moveRight(mediaWrapper);
      updatePreviewImages(mediaWrapper);
    });
    updatePreviewImages(mediaWrapper);
    trackActiveImageOnScroll(mediaWrapper);

    window.addEventListener('resize', () => {
      updatePreviewImages(mediaWrapper);
    });
  }

  // Add error handlers to all main images
  const mainImgElements = mediaWrapper.querySelectorAll('.products-card__main-image');
  mainImgElements.forEach((imgEle) => {
    addImageErrorHandler(imgEle, fallbackImage);
  });

  // Add error handlers to preview images
  const previewImgElements = mediaWrapper.querySelectorAll('.products-card__preview-image');
  previewImgElements.forEach((imgEle) => {
    addImageErrorHandler(imgEle, fallbackImage);
  });

  return mediaWrapper;
};

const checkPriceStringIsValid = (price) => {
  if (!price) return false;
  if (price.includes('<a')) return false;

  const match = price.match(/([\d.,\s]+)/);
  if (!match) return false;

  const normalized = match[1].replace(/\s/g, '');
  const isValidFormat = /^\s*\d{1,3}(?:[\s.,]?\d{3})*(?:[\s.,]\d{1,2})?\s*$/.test(normalized);

  return isValidFormat && Number(normalized.replace(/[^0-9]/g, '')) > 0;
};

const isPriceValid = (priceInventory) => {
  const {
    listPrice,
    yourPrice,
    obsoleteProduct,
    stockAvailability,
    stockAvailabilityDate,
  } = priceInventory || {};

  if (obsoleteProduct !== false) {
    return false;
  }

  const hasValidStockInfo = stockAvailability != null || stockAvailabilityDate != null;

  return hasValidStockInfo
    && (checkPriceStringIsValid(yourPrice)
    || checkPriceStringIsValid(listPrice));
};

const CtaType = {
  REQUEST_QUOTE: 'requestQuote',
  REQUEST_QUOTE_ATG: 'requestQuoteAtg',
  BUY_PRODUCT: 'buyProduct',
  SEE_REPLACEMENT: 'seeReplacement',
  NONE: 'none',
  ADD_TO_CART: 'addToCart',
  LOADING: 'loading',
  CONTACT_US: 'contactUs',
};

const determineButtonForProduct = (additionalFields, requestQuoteUrl) => {
  const {
    ec_esaleable: ecEsaleable,
    clickableuri: clickableUrl,
  } = additionalFields;

  const isSaleableNone = ecEsaleable && ecEsaleable === 'None';
  const isSaleableYes = ecEsaleable && ecEsaleable === 'Yes';
  const isSaleableNo = ecEsaleable && ecEsaleable === 'No';

  if (isSaleableNone) {
    return 'noButton';
  }

  if (isSaleableYes && clickableUrl) {
    return CtaType.BUY_PRODUCT;
  }

  if (isSaleableNo && !requestQuoteUrl) {
    return CtaType.REQUEST_QUOTE_ATG;
  }

  if (requestQuoteUrl) {
    return CtaType.REQUEST_QUOTE;
  }

  return CtaType.BUY_PRODUCT;
};

const determineButtonForParts = async (additionalFields, priceInventory) => {
  if (priceInventory && priceInventory.isLoading) {
    return [CtaType.LOADING];
  }

  const {
    ec_obsolete: ecObsolete,
    ec_esaleable: ecEsaleable,
    ec_part_replacement_number: replacementNumber,
  } = additionalFields;

  const isObsolete = ecObsolete === 'Y0';
  const obsoleteProduct = priceInventory?.obsoleteProduct === true;
  const isFullyObsolete = isObsolete || obsoleteProduct;
  const isSaleableYes = ecEsaleable === 'Yes';
  const isSaleableNo = ecEsaleable === 'No';
  const hasReplacement = !!replacementNumber;
  const enableQuoteOption = priceInventory?.enableQuoteOption;

  const priceIsValid = isPriceValid(priceInventory);

  if (isFullyObsolete) {
    return hasReplacement ? [CtaType.SEE_REPLACEMENT] : [CtaType.CONTACT_US];
  }

  const ecomEnabled = await fetchEcomEnabled();
  if (ecomEnabled === 'false' || isSaleableNo) {
    return [CtaType.REQUEST_QUOTE_ATG];
  }

  if (enableQuoteOption) {
    if (isSaleableYes && priceIsValid) {
      return [CtaType.ADD_TO_CART, CtaType.REQUEST_QUOTE_ATG];
    }
    return [CtaType.REQUEST_QUOTE_ATG];
  }

  if (!isSaleableYes) {
    return [CtaType.REQUEST_QUOTE_ATG];
  }

  if (isSaleableYes && priceIsValid) {
    return [CtaType.ADD_TO_CART];
  }

  return [CtaType.REQUEST_QUOTE_ATG];
};
const getRequestQuoteUrlForProduct = (cardData, userCountryCode) => {
  if (!cardData || typeof cardData !== 'object') {
    return null;
  }

  let { requestQuoteUrl } = cardData;
  const additionalFields = cardData.additionalFields || {};
  const ecName = cardData.ec_name || '';

  if (!requestQuoteUrl) {
    const urlsField = additionalFields.ec_request_quote_country_modal_url
      || additionalFields.ec_request_quote_country_url;

    if (urlsField && ecName) {
      const countryUrls = urlsField.split(';').filter(Boolean);
      const allCountryUrl = countryUrls.find((url) => url.startsWith('ALL'));

      const buildUrl = (base) => {
        const pname = encodeURIComponent(ecName.toLowerCase().replace(/ /g, '-'));
        const ptitle = encodeURIComponent(ecName.replace(/ /g, '+'));
        return `${base}?ptitle=${ptitle}&pname=${pname}`;
      };

      if (allCountryUrl) {
        const baseUrl = allCountryUrl.split('|')[1];
        if (baseUrl) requestQuoteUrl = buildUrl(baseUrl);
      } else {
        const countryUrl = countryUrls.find((url) => url.startsWith(userCountryCode));
        if (countryUrl) {
          const baseUrl = countryUrl.split('|')[1];
          if (baseUrl) requestQuoteUrl = buildUrl(baseUrl);
        }
      }
    }
  }

  return requestQuoteUrl || null;
};

const createCta = async (cardData) => {
  const buttons = [];
  const userCountryCode = getLocale().country;

  if (!cardData || typeof cardData !== 'object') {
    return buttons;
  }

  const {
    additionalFields = {},
    ec_product_id: ecProductId = '',
    ec_name: ecName = '',
  } = cardData;
  const { datatype = '', ec_demo_url: ecDemoUrl = null } = additionalFields;
  const replacementPart = additionalFields.ec_part_replacement_number ?? null;
  const clickableUrl = additionalFields.clickableuri ?? null;
  const requestQuoteUrl = getRequestQuoteUrlForProduct(cardData, userCountryCode);

  if (datatype === 'product' || datatype === 'product_set' || datatype === 'service') {
    const buttonType = determineButtonForProduct(additionalFields, requestQuoteUrl);

    if (ecDemoUrl) {
      buttons.push(html`<a class="agt-link" href="${ecDemoUrl}" data-ag-button="requestDemo">${getPlaceholder('Request demo')} <span class="icon icon-right-arrow"></span></a>`);
    }
    switch (buttonType) {
      case 'requestQuote': {
        if (requestQuoteUrl) {
          const requestQuoteBlock = await getRequestQuoteBlock({
            ecName,
            ecProductId,
          });
          buttons.push(requestQuoteBlock);
        }
        break;
      } case 'noButton': {
        // No CTA for isSaleable=none
        break;
      } case 'requestQuoteAtg': {
        const requestQuoteBlock = await getRequestQuoteBlock({
          ecName,
          ecProductId,
        });
        buttons.push(requestQuoteBlock);
        break;
      }
      case 'buyProduct': {
        if (clickableUrl) {
          buttons.push(html`<a class="agt-button agt-button--secondary" href="${clickableUrl}" data-ag-button="buyProduct">${getPlaceholder('Buy product')}</a>`);
        }
        break;
      }
      default:
        // No CTA for 'none'
        break;
    }
  } else if (datatype === 'Parts') {
    const buttonTypes = await determineButtonForParts(
      cardData.additionalFields,
      cardData.priceInventory,
    );
    await Promise.all(buttonTypes.map(async (buttonType) => {
      switch (buttonType) {
        case 'addToCart': {
          const addToCartBlock = html`<div 
          class="add-to-cart" 
          data-block-name="add-to-cart" 
          buttonType="secondary" 
          partnumber="${ecProductId}" 
          title="${ecName}" 
          data-block-status="initialized">
        </div>`;
          const wrapper = document.createElement('div');
          wrapper.classList.add('cta-wrapper');
          wrapper.appendChild(addToCartBlock);
          try {
            decorateBlock(addToCartBlock);
            await loadBlock(addToCartBlock);
          } catch (error) {
            // eslint-disable-next-line no-console
            console.error('Error while decorating or loading the add-to-cart block:', error);
          }
          buttons.push(wrapper);
          break;
        }
        case 'requestQuote': {
          if (requestQuoteUrl) {
            const requestQuoteBlock = await getRequestQuoteBlock({
              ecName,
              ecProductId,
            });
            buttons.push(requestQuoteBlock);
          }
          break;
        }
        case 'requestQuoteAtg': {
          const requestQuoteBlock = await getRequestQuoteBlock({
            ecName,
            ecProductId,
          });
          buttons.push(requestQuoteBlock);
          break;
        }
        case 'seeReplacement': {
          if (replacementPart) {
            buttons.push(html`
        <a class="agt-button agt-button--secondary"
          href="/store/productDetail.jsp?catalogId=${replacementPart}"
          data-ag-button="seeReplacement">
          ${getPlaceholder('See replacement')}
        </a>
          `);
          }
          break;
        }
        case 'loading': {
          buttons.push(html`<button disabled class="agt-button agt-button--secondary"><span class="spinner spinner--small"></span></button>`);
          break;
        }
        case 'contactUs': {
          buttons.push(html`
        <a class="agt-button agt-button--secondary"
          href=${`${window.location.origin}/${getLocale().language}/contact-us/page`}
          data-ag-button="contactUs">
          ${getPlaceholder('Contact us')}
        </a>
          `);
          break;
        }
        default:
          break;
      }
    }));
  }

  return buttons;
};

const renderProperties = ({ values }) => {
  if (!values || values.length === 0) {
    return null;
  }

  const tableRows = values.reduce((acc, value) => {
    acc.push(html`<span>${value.label}</span>`);
    acc.push(html`<span>${value.value}</span>`);

    return acc;
  }, []);

  return html`
    <div class="products-card__properties">
      ${tableRows}
    </div>`;
};

function getDecimalSeparator(locale) {
  const formatted = new Intl.NumberFormat(locale).format(1.1);
  return formatted.replace(/\d/g, '')[0];
}

const renderPrice = (price, shippingDate) => {
  let priceToDisplay = price;
  // handle US, CA currency symbol
  if (['US', 'CA'].includes(getLocale().country)) {
    priceToDisplay = price.replace(/USD|CAD/i, '').trim();
    priceToDisplay = `$${priceToDisplay}`;
  }

  const decimalSeparator = getDecimalSeparator(getLocale().languageCountry);
  const [integerPart, decimalPart] = priceToDisplay.split(decimalSeparator);

  return html`
    <div class="products-card__price">
      <div class="products-card__price-display">
        <span class="products-card__price-value">${integerPart.trim()}</span>
        <span class="products-card__price-decimal">${decimalPart ? `${decimalSeparator}${decimalPart}` : ''}</span>
        <span class="products-card__price-unit">${getPlaceholder('per unit')}</span>
      </div>
      <p class="products-card__shipping-info">${shippingDate}</p>
    </div>
  `;
};
const renderLabels = async (regulatoryLabels) => {
  if (!regulatoryLabels) {
    return null;
  }
  const userCountryCode = getLocale().country;
  const {
    ec_part_regulatory_status_ca: regulatoryCa,
    ec_part_regulatory_status_eu: regulatoryEu,
    ec_part_regulatory_status_jp: regulatoryJp,
    ec_part_regulatory_status_us: regulatoryUs,
    ec_product_regulatory_status: productRegulatoryStatus,
  } = regulatoryLabels;
  const buildLabel = (value) => {
    const val = value.toLowerCase();
    let extraClass = '';

    if (val === 'eco') {
      extraClass = 'icon-label-eco--light';
    }

    return html`<span class="icon icon-label-${val} ${extraClass}">${value}</span>`;
  };

  let regulatoryStatusValue = null;
  if (userCountryCode) {
    const countryCode = userCountryCode.toLowerCase();
    const countryMapping = {
      ca: regulatoryCa,
      us: regulatoryUs,
      jp: regulatoryJp,
      eu: regulatoryEu,
    };
    if (['ca', 'us', 'jp'].includes(countryCode)) {
      regulatoryStatusValue = countryMapping[countryCode];
    } else if (countryCode === 'au') {
      regulatoryStatusValue = regulatoryEu;
    } else {
      const countryInfo = await getCountryInfo();
      if (countryInfo.isEU) {
        regulatoryStatusValue = regulatoryEu;
      }
    }
  }

  let labelsToProcess = [];
  if (regulatoryLabels?.length) {
    labelsToProcess = regulatoryLabels;
  } else if (regulatoryStatusValue) {
    labelsToProcess = [regulatoryStatusValue];
  } else if (productRegulatoryStatus) {
    labelsToProcess = [productRegulatoryStatus];
  }

  const labelsList = labelsToProcess?.length && labelsToProcess.map((label) => buildLabel(label));

  return labelsList && labelsList.length
    ? html`<div class="products-card__labels">${labelsList}</div>`
    : null;
};
const checkRegulatoryStatus = (additionalFields) => {
  const {
    ec_product_regulatory_status: productRegulatoryStatus,
    ec_part_regulatory_status_eu: partRegulatoryEu,
  } = additionalFields;

  const userCountryCode = getLocale().country;

  if (userCountryCode === 'AU') {
    const isProductIVD = productRegulatoryStatus === 'IVD' || productRegulatoryStatus === 'CE-IVD';
    const isPartEuIVD = partRegulatoryEu === 'IVD' || partRegulatoryEu === 'CE-IVD';
    return isProductIVD || isPartEuIVD;
  }
  return false;
};
// enable/disable carousel
const shouldEnableProductCarousel = (isListView) => {
  const isMobile = window.matchMedia('(max-width: 767px)').matches;
  return isMobile ? true : isListView;
};
const productCardAttributes = (cardData, price) => {
  const isObsolete = cardData?.additionalFields?.ec_obsolete === 'Y0';
  const obsoleteProduct = price?.obsoleteProduct === true;
  const isFullyObsolete = isObsolete || obsoleteProduct;
  const hasReplacement = !!cardData?.additionalFields?.ec_part_replacement_number;
  const replacementPart = cardData?.additionalFields?.ec_part_replacement_number;
  const isInStock = price?.stockAvailability !== null || price?.stockAvailabilityDate !== null;
  const listPrice = price?.listPrice;
  const yourPrice = price?.yourPrice;
  const isYourPriceValid = yourPrice && !yourPrice.replaceAll(/[a-zA-Z\s]/g, '').startsWith('0');
  const priceToRender = isYourPriceValid ? yourPrice : listPrice;
  const regulatoryLabel = cardData?.additionalFields?.ec_is_regulatory !== 'No';
  const clickableUrl = cardData?.additionalFields?.clickableuri;
  const shippingDate = price?.stockAvailabilityDate;
  const isPRDT = cardData?.additionalFields?.datatype === 'product';
  const isPRDSET = cardData?.additionalFields?.datatype === 'product_set';
  const isService = cardData?.additionalFields?.datatype === 'service';

  return {
    isObsolete,
    obsoleteProduct,
    isFullyObsolete,
    hasReplacement,
    replacementPart,
    isInStock,
    listPrice,
    yourPrice,
    isYourPriceValid,
    priceToRender,
    regulatoryLabel,
    clickableUrl,
    shippingDate,
    isPRDT,
    isPRDSET,
    isService,
    eager: cardData.eager,
  };
};

const getProductDescription = (cardData, cardAttributes) => {
  const {
    isObsolete,
    hasReplacement,
    isFullyObsolete,
    isInStock,
    replacementPart,
    isPRDT,
    isPRDSET,
    isService,
  } = cardAttributes;

  if (hasReplacement) {
    if (isInStock) {
      return html`<div class="products-card__replacement replacement__id">
        <p>${getPlaceholder('Replacement available and in stock')}</p>
        <p>${getPlaceholder('Replacement part available:')} <a href="/store/productDetail.jsp?catalogId=${replacementPart}">${replacementPart}</a></p>
      </div>`;
    }
    return html`<div class="products-card__replacement">
      <p>${getPlaceholder('Replacement part available:')} <a href="/store/productDetail.jsp?catalogId=${replacementPart}">${replacementPart}</a></p>
    </div>`;
  }

  const shouldShowDescription = (cardData.ec_description
    || cardData?.additionalFields?.ec_webpage_description)
    && !(isObsolete && !hasReplacement)
    && !(isFullyObsolete && hasReplacement);

  if (shouldShowDescription) {
    if (isPRDT || isPRDSET || isService) {
      return html`<p class="products-card__description">${cardData?.additionalFields?.ec_webpage_description}</p>`;
    }
    return html`<p class="products-card__description">${cardData.ec_description}</p>`;
  }

  if (isFullyObsolete && !hasReplacement) {
    return html`<p class="products-card__replacement">
      ${getPlaceholder('No replacement found')}
    </p>`;
  }

  return null;
};

const getPriceAndCta = async (data, CardAttributes) => {
  const {
    isInStock,
    priceToRender,
    shippingDate,
  } = CardAttributes;

  const ctaButtons = await createCta(data);
  if (ctaButtons && ctaButtons.length > 1) {
    ctaButtons.forEach((btn, index) => {
      const anchor = btn.querySelector('a');
      if (anchor) {
        if (index === 0) {
          anchor.classList.add('agt-button--primary');
          anchor.classList.remove('agt-button--secondary');
        } else {
          anchor.classList.add('agt-button--secondary');
          anchor.classList.remove('agt-button--primary');
        }
      }
    });
  }

  if (isInStock && priceToRender) {
    return html`
    <div class="products-card__cta-wrapper">
      ${checkPriceStringIsValid(priceToRender) ? renderPrice(priceToRender, shippingDate) : ''}
      ${ctaButtons && ctaButtons.length ? ctaButtons : ''} 
    </div>
  `;
  }
  return html`
      <div class="products-card__cta-wrapper">
        ${ctaButtons && ctaButtons.length ? ctaButtons : ''} 
      </div>
    `;
};

const attachProductClickTracking = async (rootEl, cardData) => {
  const links = rootEl.querySelectorAll('[data-product-click]');
  if (links.length === 0) return;

  links.forEach((link) => {
    link.addEventListener('click', () => {
      const priceValueEl = rootEl.querySelector('.products-card__price-value');
      const priceDecimalEl = rootEl.querySelector('.products-card__price-decimal');

      let price = null;

      if (priceValueEl) {
        const valueText = priceValueEl.textContent.trim();
        const decimalText = priceDecimalEl?.textContent.trim() || '.00';
        const cleaned = (valueText + decimalText).replace(/[^0-9.]/g, '');
        price = parseFloat(cleaned);
      }

      if (price == null || Number.isNaN(price)) {
        price = 0;
      }

      trackCoveoEvent('ec.productClick', {
        currency: (getCountryInfo()).currency || 'USD',
        position: cardData.position,
        responseId: cardData.responseId,
        product: {
          productId: cardData.ec_product_id,
          name: cardData.ec_name,
          price,
        },
      });
    });
  });
};

const createCard = async (cardData, isListView) => {
  if (!cardData) {
    return null;
  }
  const carouselMode = shouldEnableProductCarousel(isListView);
  let {
    ec_images: ecImages = [],
  } = cardData;
  const {
    ec_thumbnails: ecThumbnails = [],
    priceInventory: price = {},
    additionalFields = {},
  } = cardData;

  const CardAttributes = productCardAttributes(cardData, price);
  const {
    isFullyObsolete,
    clickableUrl,
  } = CardAttributes;

  const priceAndCta = await getPriceAndCta(cardData, CardAttributes);
  const productDescription = getProductDescription(cardData, CardAttributes);
  const hasRegulatoryValues = !!(additionalFields?.ec_part_regulatory_status_ca
     || additionalFields?.ec_part_regulatory_status_us
     || additionalFields?.ec_part_regulatory_status_jp
     || additionalFields?.ec_part_regulatory_status_eu
     || additionalFields?.ec_product_regulatory_status);

  const regulatoryStatusLabels = hasRegulatoryValues ? await renderLabels(additionalFields) : '';
  const shouldShowRegulatoryMessage = checkRegulatoryStatus(additionalFields, price);

  let fallbackImage = null;
  if (
    ecImages.length === 0
    && ecThumbnails.length === 0
  ) {
    const sparkIcon = document.querySelector('.results[data-agilent-spark-icon]');
    const sparkIconData = sparkIcon?.dataset.agilentSparkIcon;

    let assetImagePath = null;
    let assetAltText = null;

    if (sparkIconData) {
      try {
        const parsedData = JSON.parse(sparkIconData);
        assetImagePath = parsedData.src;
        assetAltText = parsedData.altText;
        fallbackImage = {
          src: assetImagePath,
          altText: assetAltText,
        };
      } catch (error) {
        // eslint-disable-next-line no-console
        console.warn('Failed to parse spark icon data:', error);
      }
    }
    ecImages = [
      {
        src: assetImagePath,
        alt: assetAltText,
      },
    ];
  } else {
    const sparkIcon = document.querySelector('.results[data-agilent-spark-icon]');
    const sparkIconData = sparkIcon?.dataset.agilentSparkIcon;
    if (sparkIconData) {
      try {
        const parsedData = JSON.parse(sparkIconData);
        fallbackImage = {
          src: parsedData.src,
          altText: parsedData.altText,
        };
      } catch (error) {
        // eslint-disable-next-line no-console
        console.warn('Failed to parse spark icon data:', error);
      }
    }
  }
  const images = (ecImages.length > 0 ? ecImages : ecThumbnails);
  const ecName = cardData.ec_name;
  const dataType = additionalFields.datatype;
  const cardHTML = html`
    <div class="products-card" data-click-uri="${clickableUrl}">
      <div class="products-card__container">
        ${carouselMode ? await listCreateImages(images, CardAttributes, ecName, fallbackImage) : await gridCreateImages(images, CardAttributes, ecName, fallbackImage)}
        <div class="products-card__content">
          <div class="products-card__text">
            ${ecName ? `<h3 class="products-card__title">${isFullyObsolete ? ecName : `<a href="${clickableUrl}" data-product-click>${ecName}</a>`}</h3>` : ''}
            <p class="products-card__number ${(dataType === 'Parts' && cardData.ec_product_id) ? '' : 'hidden'}">${cardData.ec_product_id}</p>
            ${productDescription}
            ${cardData.values && cardData.values.length ? renderProperties(cardData) : ''}
            ${regulatoryStatusLabels}
          </div>
          <div class="products-card__empty-box"></div>
          <div class="products-card__right">
          ${shouldShowRegulatoryMessage ? `<p class="products-regulatory-message">${getPlaceholder('Product is not available')}</p>` : ''}
          ${priceAndCta}
          </div>
        </div>
      </div>
    </div>
  `;

  attachProductClickTracking(cardHTML, cardData);
  decorateIcons(cardHTML);
  decorateLabel(cardHTML);

  return cardHTML;
};

async function updateCard(cardData, block) {
  const {
    priceInventory: price = {},
    additionalFields = {},
  } = cardData;

  const CardAttributes = productCardAttributes(cardData, price);
  const {
    isFullyObsolete,
    clickableUrl,
  } = CardAttributes;

  const priceAndCta = await getPriceAndCta(cardData, CardAttributes);
  const productDescription = getProductDescription(cardData, CardAttributes);
  const hasRegulatoryValues = !!(additionalFields?.ec_part_regulatory_status_ca
     || additionalFields?.ec_part_regulatory_status_us
     || additionalFields?.ec_part_regulatory_status_jp
     || additionalFields?.ec_part_regulatory_status_eu
     || additionalFields?.ec_product_regulatory_status);

  const regulatoryStatusLabels = hasRegulatoryValues ? await renderLabels(additionalFields) : '';
  const shouldShowRegulatoryMessage = checkRegulatoryStatus(additionalFields, price);

  const ecName = cardData.ec_name;
  const dataType = additionalFields.datatype;
  const cardContentHTML = html`
    <div class="products-card__content">
      <div class="products-card__text">
        ${ecName ? `<h3 class="products-card__title">${isFullyObsolete ? ecName : `<a href="${clickableUrl}" data-product-click>${ecName}</a>`}</h3>` : ''}
        <p class="products-card__number ${(dataType === 'Parts' && cardData.ec_product_id) ? '' : 'hidden'}">${cardData.ec_product_id}</p>
        ${productDescription}
        ${cardData.values && cardData.values.length ? renderProperties(cardData) : ''}
        ${regulatoryStatusLabels}
      </div>
      <div class="products-card__empty-box"></div>
      <div class="products-card__right">
      ${shouldShowRegulatoryMessage ? `<p class="products-regulatory-message">${getPlaceholder('Product is not available')}</p>` : ''}
      ${priceAndCta}
      </div>
    </div>
  `;
  const oldContent = block.querySelector('.products-card__content');
  oldContent.replaceWith(cardContentHTML);
}

export default async function decorate(block) {
  let cardData = JSON.parse(block.dataset.result);
  const checkEcomEnabled = await isEcomEnabled();
  if (!cardData.priceInventory && checkEcomEnabled && isPartECSaleable(cardData)) {
    cardData.priceInventory = {
      isLoading: true,
    };
  }
  const resultListWrapper = block.closest('.search-results__items.block');
  if (resultListWrapper) {
    const isListView = resultListWrapper.classList.contains('list');
    let currentCard = await createCard(cardData, isListView);
    block.append(currentCard);

    let currentViewState = isListView;

    const handleResize = async () => {
      const newIsListView = resultListWrapper.classList.contains('list');
      const newCard = await createCard(cardData, newIsListView);
      currentCard.replaceWith(newCard);
      currentCard = newCard;
    };

    const mobileMediaQuery = window.matchMedia('(max-width: 767px)');
    const handleMediaChange = () => {
      handleResize();
    };

    mobileMediaQuery.addEventListener('change', handleMediaChange);

    window.addEventListener(`product:updatePriceInfo-${cardData.ec_product_id}`, async (event) => {
      const product = event.detail;
      cardData = product;
      updateCard(cardData, block, isListView);
    }, { once: true });

    if (currentCard.dataset) {
      currentCard.dataset.hasResizeListener = 'true';
    }

    const observer = new MutationObserver((mutations) => {
      mutations.forEach(async (mutation) => {
        if (mutation.type === 'attributes' && mutation.attributeName === 'class') {
          const newIsListView = resultListWrapper.classList.contains('list');

          if (newIsListView !== currentViewState) {
            currentViewState = newIsListView;

            const newCard = await createCard(cardData, newIsListView);
            currentCard.replaceWith(newCard);
            currentCard = newCard;

            if (currentCard.dataset) {
              currentCard.dataset.hasResizeListener = 'true';
            }
          }
        }
      });
    });

    observer.observe(resultListWrapper, {
      attributes: true,
      attributeFilter: ['class'],
    });
  }
}
