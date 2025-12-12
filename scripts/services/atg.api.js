import {
  loadEnvConfig,
  getCountryInfo,
  getLocale,
  isLoggedIn,
  loadBlock,
  decorateBlock,
} from '../aem.js';

const config = await loadEnvConfig();

const getCartData = async () => {
  try {
    const endpoint = config.addToCartProxyEndpoint || '/services/addtocart-proxy';
    const method = 'POST';

    const response = await fetch(endpoint, {
      method,
      headers: {
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    return await response.json();
  } catch (error) {
    // eslint-disable-next-line no-console
    console.error('Error in getCartData:', error);
    return null;
  }
};

const postAddtoCart = async (partNumber, quantity, action = 'add') => {
  try {
    const url = config.addToCartProxyEndpoint || '/services/addtocart-proxy';

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        action,
        addItemCount: 1,
        items: [
          {
            productId: partNumber.toUpperCase(),
            quantity,
          },
        ],
      }),
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    return await response.json();
  } catch (error) {
    // eslint-disable-next-line no-console
    console.error('Error in postAddtoCart:', error);
    return null;
  }
};

const fetchProductInventory = async (partNumbers) => {
  try {
    const batchSize = parseInt(config.priceInventoryBatchSize, 10) || 2;
    const partNumbersArray = Array.isArray(partNumbers)
      ? partNumbers.map((pn) => pn.toUpperCase())
      : [partNumbers.toUpperCase()];
    const makeRequest = async (parts) => {
      const body = {
        quantity: 1,
        partNumbers: parts.join(','),
        countryCode: getLocale().country,
        filter: 'both',
      };
      const response = await fetch(`${config.pricingProxyEndpoint || '/services/priceavailability-proxy'}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(body),
      });
      return response.json();
    };

    // If only one part number or batchSize is 'ALL', process all at once
    if (partNumbersArray.length === 1 || config.priceInventoryBatchSize === 'ALL') {
      return makeRequest(partNumbersArray);
    }

    // Split into batches
    const batches = [];
    for (let i = 0; i < partNumbersArray.length; i += batchSize) {
      batches.push(partNumbersArray.slice(i, i + batchSize));
    }

    const batchPromises = batches.map(async (batch) => makeRequest(batch));

    const batchResults = await Promise.allSettled(batchPromises);

    return batchResults
      .filter((result) => result.status === 'fulfilled')
      .map((result) => result.value)
      .reduce((merged, result) => ({ ...merged, ...result }), {});
  } catch (error) {
    return null;
  }
};
// TODO: Need to move to other file based on the api useage.
let ecomEnabled = null;

const fetchEcomEnabled = async () => {
  if (ecomEnabled) {
    return ecomEnabled;
  }
  const countryCode = getLocale().country;
  ecomEnabled = (async () => {
    try {
      const data = await getCountryInfo(countryCode);
      return data?.ecomEnabled || null;
    } catch {
      return null;
    }
  })();

  return ecomEnabled;
};

const isEcomEnabled = async () => {
  const ecomEnabledValue = await fetchEcomEnabled();
  const isEcomCountryEnabled = ecomEnabledValue === 'true';
  const isEcomHybridCountryEnabled = ecomEnabledValue === 'hybrid' && isLoggedIn();
  return isEcomCountryEnabled || isEcomHybridCountryEnabled;
};

const isPartECSaleable = (product) => {
  const countryCode = getLocale().country;
  if (product.additionalFields.datatype === 'Parts' && product.additionalFields.ec_esaleable === 'Yes') {
    if (countryCode === 'AU') {
      return !['IVD', 'CE-IVD'].includes(product.additionalFields.ec_part_regulatory_status_eu);
    }
    return true;
  }
  return false;
};

const filterECSaleableParts = (products) => products.filter(isPartECSaleable);

const fetchPartsPriceFromProductList = async (products) => {
  const validParts = filterECSaleableParts(products);

  if (validParts.length > 0) {
    const partIds = validParts.map((part) => part.ec_product_id);
    const checkEcomEnabled = await isEcomEnabled();
    const priceInventoryResponse = checkEcomEnabled
      ? await fetchProductInventory(partIds)
      : null;
    const priceResults = priceInventoryResponse ? Object.keys(priceInventoryResponse) : [];
    const updatedProducts = [...products];
    if (priceResults.length > 0) {
      priceResults.forEach((key) => {
        const productIndex = updatedProducts.findIndex((p) => p.ec_product_id === key);
        if (productIndex !== -1) {
          const updatedProduct = {
            ...updatedProducts[productIndex],
            priceInventory: priceInventoryResponse[key],
          };
          updatedProducts[productIndex] = updatedProduct;
        }
      });
    }
    return updatedProducts;
  }

  return products;
};

export const fetchProducts = async (partNumbers) => {
  const { country, language } = getLocale();
  const locale = `${language}_${country}`;
  const query = `query {
    getProducts(ids: ${JSON.stringify(partNumbers)}, locale: "${locale}") {
      status
      httpStatusCode
      data {
        id
        productName
        productDescription
      }
      error {
        errorCode
        errorDescription
      }
    }
  }`;
  try {
    const { productDetailsEndpoint } = config;
    const response = await fetch(productDetailsEndpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ query }),
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    return await response.json();
  } catch (error) {
    return null;
  }
};

const getRequestQuoteBlock = async (productOptions) => {
  const { ecName, ecProductId, partNumber } = productOptions;
  const wrapper = document.createElement('div');

  let htmlContent = '';

  if (ecName && ecProductId) {
    htmlContent = `
      <div class="request-quote"
        data-block-name="request-quote"
        title="${ecName}"
        buttonType="secondary"
        requestQuoteUrl="/common/requestQuote.jsp"
        productId="${ecProductId}">
      </div>
    `;
  } else if (partNumber) {
    htmlContent = `
      <span class="request-quote"
        data-block-name="request-quote"
        buttonType="secondary"
        requestQuoteUrl="/common/requestQuote.jsp"
        productId="${partNumber}">
      </span>
    `;
  }
  wrapper.innerHTML = htmlContent;
  const requestQuoteBlock = wrapper.firstElementChild;

  if (requestQuoteBlock) {
    decorateBlock(requestQuoteBlock);
    return loadBlock(requestQuoteBlock);
  }

  return null;
};
export {
  fetchProductInventory,
  postAddtoCart,
  isEcomEnabled,
  isPartECSaleable,
  filterECSaleableParts,
  fetchPartsPriceFromProductList,
  fetchEcomEnabled,
  getCartData,
  getRequestQuoteBlock,
};
