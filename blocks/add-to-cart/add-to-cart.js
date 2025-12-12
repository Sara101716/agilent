import {
  decorateIcons,
  getPlaceholder,
  html,
  getCookie,
} from '../../scripts/aem.js';
import { trackAddToCartEvent } from './add-to-cart.analytics.js';
import { postAddtoCart, getCartData } from '../../scripts/services/atg.api.js';

let liveRegion = null;

function updateLiveRegion(message) {
  if (liveRegion) {
    liveRegion.textContent = '';
    setTimeout(() => {
      liveRegion.textContent = message;
    }, 50);
  }
}

function createLiveRegion(block) {
  liveRegion = document.querySelector('.aria-live-region');
  if (!liveRegion) {
    liveRegion = html`
      <div class="sr-only aria-live-region" aria-live="polite" aria-atomic="true"></div>
    `;
    block.appendChild(liveRegion);
  }
}

function getCartObject(cartStr) {
  return Object.entries(cartStr).reduce(
    (acc, [partNumber, quantities]) => {
      if (Array.isArray(quantities)) {
        const [firstQuantity] = quantities;
        acc[partNumber] = firstQuantity;
      } else {
        acc[partNumber] = parseInt(quantities.replace(/[[\]]/g, ''), 10);
      }
      return acc;
    },
    {},
  );
}

const fetchCartState = async () => {
  try {
    const response = await getCartData();
    if (response && response.partNumberQty) {
      return getCartObject(response.partNumberQty);
    }
  } catch (error) {
    console.error('Error fetching cart state:', error);
  }
  return {};
};
const fetchCartStatePromise = fetchCartState();

const handleCartAPI = async (state, quantity, block, action = 'add') => {
  const { partNumber } = state;
  const data = {
    action, partNumber, quantity, block,
  };

  try {
    const upperCasePartNumber = partNumber.toUpperCase();
    const cartResponse = await postAddtoCart(upperCasePartNumber, quantity, action === 'add' ? 'add' : 'update');
    if (!cartResponse) {
      trackAddToCartEvent({
        ...data, cart: { errorMessages: 'Failed to add this item to cart' },
      });
    } else {
      if (cartResponse.success) {
        const cartCount = cartResponse.cartCount || 0;
        const cartValueElement = document.querySelector('.header__cart-link-value');
        if (cartValueElement) {
          cartValueElement.textContent = cartCount;
        }
      }
      trackAddToCartEvent({
        ...data, cart: cartResponse,
      });
      return !!cartResponse.success;
    }
  } catch (error) {
    trackAddToCartEvent({
      ...data, cart: { errorMessages: error },
    });
    return false;
  }

  return false;
};

function renderContent(state, block) {
  const {
    status, quantity, isProcessing, buttonType,
  } = state;
  const disabled = block.hasAttribute('data-disabled');

  switch (status) {
    case 'loading':
      updateLiveRegion(`${getPlaceholder('Loading')}`);
      return `
          <button class="agt-button agt-button--${buttonType || 'primary'}">
            <span class="loading-spinner" aria-hidden="true"></span>
            <span>${getPlaceholder('Add to Cart')}</span>
          </button>
        `;

    case 'success':
      setTimeout(() => {
        const successIcons = block.querySelector('.success-animation');
        const dotIcon = successIcons.querySelector('.success-icon-dot');
        const tickIcon = successIcons.querySelector('.success-icon-tick');

        if (dotIcon) dotIcon.style.display = 'none';
        if (tickIcon) tickIcon.style.display = 'inline-block';
      }, 1000);

      return `
          <button class="agt-button agt-button--${buttonType || 'primary'}">
            <span class="success-animation" aria-hidden="true">
              <span class="icon icon-dot success-icon-dot" style="display: inline-block;"></span>
              <span class="icon icon-tick success-icon-tick" style="display: none;"></span>
              ${getPlaceholder('Added')}
            </span>
          </button>
        `;

    case 'added':
      return `
            <div class="agt-button agt-button--secondary quantity-controls">
              <button 
                class="quantity-btn ${quantity === 1 ? 'delete' : 'minus'} ${isProcessing ? 'loading' : ''}" 
                data-action="decrement"
                ${disabled ? 'disabled' : ''}
                aria-label="${quantity === 1 ? getPlaceholder('Remove from cart') : getPlaceholder('Decrease Quantity label')}"
              >
                <span class="icon icon-${quantity === 1 ? 'trash' : 'minus'}" aria-hidden="true"></span>
              </button>
              
              <div class="agt-input__container quantity-input-wrapper">
                <input 
                  type="number" 
                  class="agt-input agt-input--large quantity-input" 
                  value="${quantity}" 
                  min="1" 
                  ${disabled ? 'disabled' : ''}
                  aria-label="${getPlaceholder('Quantity')}"
                  aria-describedby="quantity-update-instruction"
                  data-action="input"
                />
                <span id="quantity-update-instruction" class="sr-only">
                  ${getPlaceholder('Quantity Update Instruction')}
                </span>
              </div>
              
              <button 
                class="quantity-btn plus ${isProcessing ? 'loading' : ''}" 
                data-action="increment"
                ${disabled ? 'disabled' : ''}
                aria-label="${getPlaceholder('Increase Quantity label')}"
              >
                <span class="icon icon-plus" aria-hidden="true"></span>
              </button>
            </div>
          `;

    default:
      return `
        <button 
          class="agt-button agt-button--${buttonType || 'primary'}" 
          data-action="add-to-cart" type="button"
          ${disabled ? 'disabled' : ''}
          aria-label="${getPlaceholder('Add to Cart')}"
          >
          <span>${getPlaceholder('Add to Cart')}</span>
        </button>
          `;
  }
}

function render(state, block) {
  block.innerHTML = renderContent(state, block);
  createLiveRegion(block);
  decorateIcons(block);
}

const updateState = (state, block, newState) => {
  Object.assign(state, newState);

  if (newState.quantity !== undefined) {
    block.setAttribute('data-quantity', newState.quantity);
  }

  render(state, block);
};

async function restoreCartContent() {
  try {
    const cartContent = getCookie('CartPartNumberQty');
    if (cartContent) {
      const cartStateObj = JSON.parse(atob(cartContent));
      return getCartObject(cartStateObj);
    }
  } catch (error) {
    // eslint-disable-next-line no-console
    console.error('Error parsing cart content:', error);
  }
  return fetchCartStatePromise;
}

const handleAddToCart = async (state, block) => {
  updateState(state, block, { status: 'loading', isProcessing: true });

  try {
    const success = await handleCartAPI(state, 1, block, 'add');
    if (success) {
      updateState(state, block, { status: 'success', quantity: 1, isProcessing: false });
      updateLiveRegion(`${state.title} ${getPlaceholder('Added to cart')}`);
      setTimeout(() => updateState(state, block, { status: 'added' }), 2000);
    } else {
      updateState(state, block, { status: 'default', isProcessing: false });
    }
  } catch (error) {
    updateState(state, block, { status: 'default', isProcessing: false });
  }
};

const handleIncrement = async (state, block) => {
  const newQuantity = state.quantity + 1;
  updateState(state, block, { status: 'loading', isProcessing: true });
  try {
    const success = await handleCartAPI(state, newQuantity, block, 'increase');
    if (success) {
      updateState(state, block, { status: 'success', quantity: newQuantity, isProcessing: false });
      updateLiveRegion(`${newQuantity} ${state.title} ${getPlaceholder('Added to cart')}`);
      setTimeout(() => updateState(state, block, { status: 'added' }), 2000);
    } else {
      updateState(state, block, { status: 'added', quantity: state.quantity, isProcessing: false });
    }
  } catch (error) {
    updateState(state, block, { isProcessing: false });
  }
};

const handleDecrement = async (state, block) => {
  const newQuantity = Math.max(1, state.quantity - 1);
  updateState(state, block, { status: 'loading', isProcessing: true });

  try {
    const success = await handleCartAPI(state, newQuantity, block, 'decrease');
    if (success) {
      updateState(state, block, { status: 'success', quantity: newQuantity, isProcessing: false });
      updateLiveRegion(`${newQuantity} ${state.title} ${getPlaceholder('Added to cart')}`);
      setTimeout(() => updateState(state, block, { status: 'added' }), 2000);
    } else {
      updateState(state, block, { status: 'added', quantity: state.quantity, isProcessing: false });
    }
  } catch (error) {
    updateState(state, block, { isProcessing: false });
  }
};

const handleQuantityInput = (state, event) => {
  const input = event.target;
  const inputValue = input.value.trim();

  if (inputValue === '') {
    input.dataset.tempValue = '';
    return;
  }

  const newQuantity = Math.max(1, parseInt(inputValue, 10));

  if (Number.isNaN(newQuantity) || newQuantity < 1) {
    return;
  }

  input.dataset.tempValue = newQuantity;
};

const handleQuantityBlur = async (state, block, event) => {
  const input = event.target;
  const inputValue = input.value.trim();

  const newQuantity = Math.max(0, parseInt(inputValue, 10)); // Allow 0 for deletion

  if (Number.isNaN(newQuantity)) {
    input.value = state.quantity;
    return;
  }

  // If quantity is 0, delete the cart
  if (newQuantity === 0) {
    try {
      updateState(state, block, { status: 'loading', isProcessing: true });
      const success = await handleCartAPI(state, 0, block, 'delete');
      if (success) {
        updateState(state, block, { status: 'deleted', quantity: 0, isProcessing: false });
        updateLiveRegion(`${state.title} ${getPlaceholder('Removed from cart')}`);
      } else {
        updateState(state, block, { status: 'added', quantity: state.quantity, isProcessing: false });
      }
    } catch (error) {
      updateState(state, block, { status: 'default', isProcessing: false });
    }
    return;
  }

  if (newQuantity === state.quantity) {
    return;
  }

  updateState(state, block, { status: 'loading', isProcessing: true });

  try {
    const success = await handleCartAPI(state, newQuantity, block, state.quantity < newQuantity ? 'increase' : 'decrease');
    if (success) {
      updateState(state, block, { status: 'success', quantity: newQuantity, isProcessing: false });
      updateLiveRegion(`${newQuantity} ${state.title} ${getPlaceholder('Added to cart')}}`);
      setTimeout(() => updateState(state, block, { status: 'added' }), 2000);
    } else {
      updateState(state, block, { status: 'added', quantity: state.quantity, isProcessing: false });
    }
  } catch (error) {
    updateState(state, block, { status: 'default', isProcessing: false });
  }
};

const handleDelete = async (state, block) => {
  if (state.isProcessing || !state.partNumber) return;

  updateState(state, block, { status: 'loading', isProcessing: true });

  try {
    const success = await handleCartAPI(state, 0, block, 'delete');
    if (success) {
      updateState(state, block, { status: 'default', quantity: 0, isProcessing: false });
      updateLiveRegion(`${state.title} ${getPlaceholder('Removed from cart')}`);
    }
  } catch (error) {
    updateState(state, block, { status: 'default', isProcessing: false });
  }
};

export default async function decorate(block) {
  const cartState = await restoreCartContent();
  const quantity = parseInt(block.getAttribute('data-quantity'), 10)
    || cartState[block.getAttribute('partnumber')]
    || 0;
  const state = {
    status: quantity > 0 ? 'added' : 'default',
    quantity,
    partNumber: block.getAttribute('partnumber') || '',
    buttonType: block.getAttribute('buttonType') || 'primary',
    title: block.getAttribute('title') || '',
    isProcessing: false,
  };

  block.addEventListener('click', async (event) => {
    const action = event.target.closest('[data-action]')?.dataset?.action;
    if (!action) return;
    state.quantity = parseInt(block.getAttribute('data-quantity'), 10) || state.quantity;
    switch (action) {
      case 'add-to-cart':
        handleAddToCart(state, block);
        break;
      case 'increment':
        handleIncrement(state, block);
        break;
      case 'decrement':
        if (state.quantity === 1) {
          await handleDelete(state, block);
        } else {
          await handleDecrement(state, block);
        }
        break;
      case 'delete':
        await handleDelete(state, block);
        break;
      default:
        break;
    }
  });

  block.addEventListener('input', (event) => {
    if (event.target.matches('.quantity-input')) {
      handleQuantityInput(state, event);
    }
  });

  block.addEventListener('blur', (event) => {
    if (event.target.matches('.quantity-input')) {
      handleQuantityBlur(state, block, event);
    }
  }, true);

  block.addEventListener('keydown', async (event) => {
    if (event.target.matches('.quantity-input')) {
      if (event.key === '-' || event.keyCode === 189) {
        event.preventDefault();
      }

      if (event.key === 'Enter') {
        event.preventDefault();
        await handleQuantityBlur(state, block, event);
      }
    }
  });

  render(state, block);
}
