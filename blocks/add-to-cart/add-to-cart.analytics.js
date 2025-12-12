import { getCountryInfo, pushToDataLayer } from '../../scripts/aem.js';
import { getPrice, getResultData } from '../../scripts/analytics/adobe-data-layer.js';
import { trackCoveoEvent } from '../../scripts/coveo/coveo-analytics.js';

export const trackAddToCartEvent = async ({
  partNumber, quantity, block, cart, action,
}) => {
  const { category } = getResultData(block);
  const name = block.getAttribute('title') || '';

  const eventDetails = { event: '', eventInfo: { type: '' } };

  switch (action) {
    case 'add':
      eventDetails.event = 'add_to_cart';
      eventDetails.eventInfo.type = 'commerce.productListAdds';
      break;
    case 'increase':
      eventDetails.event = 'cart_modified_quantityAdded';
      eventDetails.eventInfo.type = 'agilent.cartmodified.quantityAdded';
      break;
    case 'decrease':
      eventDetails.event = 'cart_modified_quantityReduced';
      eventDetails.eventInfo.type = 'agilent.cartmodified.quantityReduced';
      break;
    case 'delete':
      eventDetails.event = 'remove_from_cart';
      eventDetails.eventInfo.type = 'commerce.productListRemovals';
      break;
    default:
      break;
  }

  const addToCartResponse = {
    ...eventDetails,
    xdm: {
      error: {
        transactionFailed: (cart?.success ? 'No' : 'Yes'),
        failuereMsg: cart?.errorMessages || '',
      },
      productListItems: [
        {
          SKU: partNumber,
          currencyCode: (await getCountryInfo()).currency || 'USD',
          discountAmount: 0,
          name,
          productCategories: category?.map((item) => ({ categoryName: item })) || '',
          quantity,
          priceTotal: getPrice(block),
        },
      ],
    },
  };
  pushToDataLayer(addToCartResponse);

  const coveoEventData = {
    currency: (await getCountryInfo()).currency || 'USD',
    product: {
      productId: partNumber,
      name,
      price: getPrice(block),
    },
  };

  switch (action) {
    case 'increase':
      coveoEventData.action = 'add';
      coveoEventData.quantity = 1;
      break;
    case 'add':
      coveoEventData.action = 'add';
      coveoEventData.quantity = quantity;
      break;
    case 'decrease':
      coveoEventData.action = 'remove';
      coveoEventData.quantity = 1;
      break;
    case 'delete':
      coveoEventData.action = 'remove';
      if (quantity >= 1) {
        coveoEventData.quantity = quantity;
      } else {
        coveoEventData.quantity = 1;
      }
      break;
    default:
      break;
  }

  await trackCoveoEvent('ec.cartAction', coveoEventData);
};
