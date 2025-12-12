import {
  html, decorateBlock, loadBlock, loadEnvConfig,
} from '../../scripts/aem.js';
import { trackAddToCartEvent } from '../add-to-cart/add-to-cart.analytics.js';
import { postAddtoCart, isEcomEnabled, getRequestQuoteBlock } from '../../scripts/services/atg.api.js';

function quickOrderFormTemplate(quickOrderContent) {
  return `
    <form class="quickorder__form agt-input__wrapper">
    <div id="quick-order-loader" class="quick-order-loader">
        <div class="load-spinner"></div>
      </div>
      <div class="agt-input__container">
              <label class="quickorder__form-label" for="part-number">${quickOrderContent.label ? quickOrderContent.label.innerHTML : ''}</label>
        <input name="partNumber" class="agt-input agt-input--large quickorder__form-input" type="text" id="part-number" placeholder="${quickOrderContent.placeholder ? quickOrderContent.placeholder.innerHTML : ''}">
      </div>
      <div class="quickorder-buttons">
        <button type="submit" class="agt-button agt-button--secondary quickorder__form-submit">
          ${quickOrderContent.addToCartButton ? quickOrderContent.addToCartButton.innerHTML : ''}
        </button>
        ${quickOrderContent.addMultipleLink ? quickOrderContent.addMultipleLink.outerHTML : ''}
      </div>
      <div class="quickorder__success-wrapper"></div>
    </form>`;
}

function validatePartNumber(partNumber) {
  return partNumber && partNumber.trim() !== '';
}

function showPartNumberError(form, message) {
  const inputContainer = form.querySelector('.agt-input__container');
  const partNumberInput = form.querySelector('.quickorder__form-input');
  const errorId = 'part-number-error';

  // Remove existing error if present
  const existingError = document.getElementById(errorId);
  if (existingError) {
    existingError.remove();
  }

  // Insert new error message
  inputContainer.insertAdjacentHTML(
    'beforeend',
    `<span id="${errorId}" class="agt-input__error-container">${message}</span>`,
  );

  partNumberInput.classList.add('agt-input--error');
  partNumberInput.setAttribute('aria-describedby', errorId);
  partNumberInput.setAttribute('aria-invalid', 'true');
  partNumberInput.focus();
}

const config = await loadEnvConfig();

async function showAlertMessage(form, message, isSuccess) {
  if (isSuccess) {
    const alertWrapper = form.querySelector('.quickorder__success-wrapper');
    try {
      const alertBlock = html`<div class="alert alert-success" role="alert" aria-live="polite" aria-atomic="true">
        <span class="alert-message">${message}</span>
      </div>`;
      alertWrapper.appendChild(alertBlock);

      decorateBlock(alertBlock);
      await loadBlock(alertBlock);

      if (alertBlock && alertBlock.hasAttribute('aria-label')) {
        alertBlock.removeAttribute('aria-label');
        const alertCloseBtn = alertBlock.querySelector('.alert-close');
        alertCloseBtn.setAttribute('tabindex', '-1');
        alertCloseBtn.setAttribute('aria-hidden', 'true');
      }

      setTimeout(() => {
        const alertCloseButton = alertBlock.querySelector('.alert-close');
        if (alertCloseButton) {
          alertCloseButton.click();
        }
      }, config.alertTimeOut || 3000);
    } catch (error) {
      // eslint-disable-next-line no-console
      console.error('Error initializing alert block:', error);
    }
  } else {
    showPartNumberError(form, message);
  }
}

const handleCartAPI = async (partNumber, quantity, form, errorMessage) => {
  const upperCasePartNumber = partNumber.toUpperCase();
  const data = {
    partNumber: upperCasePartNumber,
    quantity,
    block: form,
    action: 'add',
  };
  const loader = document.getElementById('quick-order-loader');
  loader.classList.add('loading');
  try {
    const cartResponse = await postAddtoCart(upperCasePartNumber, quantity, 'add');

    if (!cartResponse) {
      trackAddToCartEvent({
        ...data,
        cart: { errorMessages: 'Failed to add this item to cart' },
      });
    } else {
      if (cartResponse.success) {
        const cartCount = cartResponse.cartCount || 0;
        const cartValueElement = document.querySelector('.header__cart-link-value');
        if (cartValueElement) {
          cartValueElement.textContent = cartCount;
        }
        showAlertMessage(form, cartResponse.successMessages, true);
      } else if (cartResponse.errorMessages && cartResponse.errorMessages.length > 0) {
        const errorLocalMessage = cartResponse.errorMessages[0].localizedMessage || '';
        showAlertMessage(form, errorLocalMessage, false);

        // Remove existing request-quote block if present
        const existingRequestQuote = document.querySelector('.request-quote');
        if (existingRequestQuote) {
          existingRequestQuote.remove();
        }

        const requestQuoteBlock = await getRequestQuoteBlock({ partNumber });

        const wrapper = document.querySelector('.quickorder__form-wrapper');
        if (wrapper) {
          wrapper.classList.add('cta-wrapper');
          wrapper.insertAdjacentElement('beforeend', requestQuoteBlock);
        }
        decorateBlock(requestQuoteBlock);
        await loadBlock(requestQuoteBlock);

        const requestQuoteLink = document.getElementById('req-quote-Link');
        const requestQuoteBtn = document.querySelector('.request-quote');
        if (requestQuoteLink) requestQuoteLink.classList.add('hidden');

        if (requestQuoteBtn) {
          const innerAnchor = requestQuoteBtn.querySelector('a');
          if (innerAnchor) {
            innerAnchor.classList.remove('agt-button', 'agt-button--secondary');
          }
        }

        if (requestQuoteLink && requestQuoteBtn) {
          requestQuoteLink.replaceWith(requestQuoteBtn);
        }
      }
      trackAddToCartEvent({ ...data, cart: cartResponse });
    }
  } catch (error) {
    showPartNumberError(form, errorMessage);
    trackAddToCartEvent({
      ...data,
      cart: { errorMessages: error.message || error },
    });
  } finally {
    loader.classList.remove('loading');
  }
};

async function registerFormEvents(form, options) {
  const addMultipleLink = form.querySelector('.agt-link');

  // Only set up media query if link exists
  if (addMultipleLink) {
    const isMobile = window.matchMedia('(max-width: 767px)');

    const toggleClasses = () => {
      if (isMobile.matches) {
        addMultipleLink.classList.add(...['agt-button', 'agt-button--secondary']);
        addMultipleLink.classList.remove('agt-link');
      } else {
        addMultipleLink.classList.remove(...['agt-button', 'agt-button--secondary']);
        addMultipleLink.classList.add('agt-link');
      }
    };

    toggleClasses();
    isMobile.addEventListener('change', toggleClasses);
  }

  const partNumberInput = form.querySelector('.quickorder__form-input');
  partNumberInput.addEventListener('input', () => {
    const inputContainer = form.querySelector('.agt-input__container');
    const errorElement = inputContainer.querySelector('.agt-input__error-container');
    if (errorElement) {
      inputContainer.removeChild(errorElement);
      partNumberInput.classList.remove('agt-input--error');
      partNumberInput.removeAttribute('aria-describedby');
      partNumberInput.setAttribute('aria-invalid', 'false');
    }
  });

  partNumberInput.addEventListener('keypress', (event) => {
    const { key } = event;
    const allowedChars = /^[a-zA-Z0-9\-_.]$/;
    if (!allowedChars.test(key)) {
      event.preventDefault();
    }
  });

  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    const partNumber = partNumberInput.value.toUpperCase();

    // Clear previous error
    const inputContainer = form.querySelector('.agt-input__container');
    const errorElement = inputContainer.querySelector('.agt-input__error-container');
    if (errorElement) {
      errorElement.remove();
      partNumberInput.classList.remove('agt-input--error');
      partNumberInput.removeAttribute('aria-describedby');
      partNumberInput.setAttribute('aria-invalid', 'false');
    }

    const { errorMessageElem } = options;
    const errorMessage = errorMessageElem ? errorMessageElem.innerHTML : '';

    if (validatePartNumber(partNumber)) {
      await handleCartAPI(partNumber, 1, form, errorMessage);
    } else {
      showAlertMessage(form, errorMessage);
    }
    partNumberInput.value = '';
  });
}

export default async function decorate(block) {
  const ecomEnabledValue = await isEcomEnabled();
  if (!ecomEnabledValue) {
    block.remove();
    return;
  }

  const rows = block.querySelectorAll(':scope > div > div');

  if (rows.length >= 1) {
    const columnOneContent = rows[0];
    const columnTwoContent = rows[1];
    columnOneContent.classList.add('quickorder__form-wrapper');
    const title = columnOneContent.querySelector('h1, h2, h3, h4, h5, h6');
    if (title) {
      title.classList.add('quickorder__title');
    }

    const label = columnOneContent.querySelector('p');
    const placeholder = columnOneContent.querySelector('p em');
    const addToCartButton = columnOneContent.querySelector('p .agt-button--secondary');
    const addMultipleLink = columnOneContent.querySelector('p .agt-link');
    const errorMessageElem = columnOneContent.querySelector('p strong');

    const quickOrderFormContent = {
      label,
      placeholder,
      addToCartButton,
      addMultipleLink,
    };

    const formHtml = quickOrderFormTemplate(quickOrderFormContent);
    const titleHtml = title ? title.outerHTML : '';
    columnOneContent.innerHTML = titleHtml + formHtml;
    registerFormEvents(columnOneContent.querySelector('.quickorder__form'), { errorMessageElem });

    if (columnTwoContent) {
      if (!columnTwoContent.querySelector(':scope > picture, :scope > video')) {
        columnTwoContent.classList.add('quickorder__content-wrapper');
      } else {
        columnTwoContent.classList.add('quickorder__media-wrapper');
      }

      const titleColumnTwo = columnTwoContent.querySelector('h1, h2, h3, h4, h5, h6');
      if (titleColumnTwo) {
        titleColumnTwo.classList.add('quickorder__title');
      }
    }
  } else {
    // eslint-disable-next-line no-console
    console.warn('Quick Order block requires at least one row with content.');
  }
}
