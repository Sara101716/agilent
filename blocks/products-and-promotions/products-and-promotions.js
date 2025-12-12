import { decorateResponsiveMedia, getPlaceholder } from '../../scripts/aem.js';

// Helper function to make card elements clickable
const makeCardClickable = (card, cta) => {
  if (cta) {
    card.addEventListener('click', (event) => {
      if (event.target.tagName === 'A' || event.target.closest('a')) {
        return;
      }
      cta.click();
    });
  }
};

const decorateProductCard = (card) => {
  card.classList.add('product-card');
  const productInfo = card.querySelector(':scope > div');
  if (!productInfo || productInfo.children.length < 4) {
    // eslint-disable-next-line no-console
    console.warn('Expected at least 4 children for product card', productInfo ? productInfo.children.length : 0);
    return;
  }
  productInfo.classList.add('product-card__info');
  productInfo.classList.add('text-inverse');

  decorateResponsiveMedia(card);

  const [label, ...content] = [...productInfo.children].slice(0, -1);
  if (label && content.length > 0) {
    const contentDiv = document.createElement('div');
    contentDiv.className = 'product-card__content';
    contentDiv.append(...content);
    productInfo.prepend(...[label, contentDiv]);
  }

  const cta = productInfo.querySelector(':scope > .button-container .agt-link');
  if (cta) {
    cta.classList.add('agt-link--light');
    makeCardClickable(card, cta);
  }
};

const decorateFeatureCard = (card) => {
  card.classList.add('feature-card');
  const contentWrapper = card.querySelector(':scope > div');
  if (!contentWrapper || contentWrapper.children.length < 3) {
    // eslint-disable-next-line no-console
    console.warn('Expected at least 3 children for feature card', contentWrapper ? contentWrapper.children.length : 0);
    return;
  }
  contentWrapper.classList.add('feature-card__content');
  contentWrapper.classList.add('text-inverse');
  const content = [...contentWrapper.children].slice(0, -1);
  const contentDiv = document.createElement('div');
  contentDiv.className = 'feature-card__inner';
  contentDiv.append(...content);
  contentWrapper.prepend(contentDiv);
  const cta = contentWrapper.querySelector(':scope > .button-container .agt-link');
  if (cta) {
    cta.classList.add('agt-link--light');
    makeCardClickable(contentWrapper, cta);
  }
};

/**
 * Handle copy code functionality when a user clicks on the "Copy code" button
 * @param {HTMLElement} button - The button element that was clicked
 */
const handleCopyCode = (button) => {
  // Extract the code from the button's title attribute
  const title = button.getAttribute('title');
  // Extract any numeric code (sequence of digits) from the title
  const codeMatch = title.match(/(\d+)/);
  if (codeMatch && codeMatch[1]) {
    const code = codeMatch[1];
    const originalFocusedElement = button;

    navigator.clipboard.writeText(code)
      .then(() => {
        const card = button.closest('.promo-card');
        const firstButton = card.querySelector('.button-container a');

        if (firstButton && firstButton.dataset.successText) {
          if (!firstButton.dataset.originalText) {
            firstButton.dataset.originalText = firstButton.textContent;
          }
          if (!firstButton.dataset.originalHtml) {
            firstButton.dataset.originalHtml = firstButton.innerHTML;
          }
          firstButton.textContent = firstButton.dataset.successText;
          const pTag = card.querySelector('p:not([class]):not(:has(a)):not(:has(.icon))');
          if (pTag) {
            firstButton.setAttribute('aria-label', getPlaceholder('copy code aria label', firstButton.dataset.successText, pTag.textContent));
          }
        }

        setTimeout(() => {
          if (firstButton && firstButton.dataset.originalHtml) {
            firstButton.innerHTML = firstButton.dataset.originalHtml;
            const pTag = card.querySelector('p:not([class]):not(:has(a)):not(:has(.icon))');
            const originalTitle = firstButton.getAttribute('title');
            if (pTag && originalTitle) {
              firstButton.setAttribute('aria-label', getPlaceholder('coupon code aria label', originalTitle, pTag.textContent));
            }
            const currentlyFocused = document.activeElement;
            const shouldRestoreFocus = currentlyFocused === originalFocusedElement
              || currentlyFocused === document.body
              || !currentlyFocused;

            if (originalFocusedElement && originalFocusedElement.isConnected
              && shouldRestoreFocus) {
              originalFocusedElement.focus();
            }
          }
        }, 3000);
      })
      .catch((err) => {
        // eslint-disable-next-line no-console
        console.error('Failed to copy code:', err);
        const currentlyFocused = document.activeElement;
        const shouldRestoreFocus = currentlyFocused === originalFocusedElement
          || currentlyFocused === document.body
          || !currentlyFocused;

        if (originalFocusedElement && originalFocusedElement.isConnected
          && shouldRestoreFocus) {
          originalFocusedElement.focus();
        }
      });
  }
};

const decoratePromoCards = (cards, block) => {
  if (!cards || cards.length === 0) {
    return;
  }

  if (cards.length < 2) {
    // eslint-disable-next-line no-console
    console.warn('At least 2 promo cards are required for the layout');
    return;
  }

  const promoWrapper = document.createElement('div');
  promoWrapper.classList.add('promo-card-wrapper');
  cards.forEach((card) => {
    if (!card) return;

    card.classList.add('promo-card');
    const cardContent = card.querySelector(':scope > div');
    if (cardContent) {
      card.innerHTML = cardContent.innerHTML;
      const pTagWithIcon = card.querySelectorAll('p > span.icon, p > .icon, span.icon-ivd, .icon.icon-ivd');
      const ivdIcons = card.querySelectorAll('span.icon-ivd, .icon.icon-ivd, [class*="ivd"]');

      if (pTagWithIcon.length > 0 || ivdIcons.length > 0) {
        card.classList.add('icon-ivd');
      }

      const copyButton = card.querySelector('.button-container .agt-button--secondary, .button-container .agt-link');
      const btnEle = card.querySelectorAll('.button-container a');
      let secondButtonText = '';
      const secondButton = btnEle[1];
      if (secondButton) {
        secondButtonText = secondButton.textContent.trim();

        const secondButtonContainer = secondButton.closest('.button-container');
        if (secondButtonContainer) {
          secondButtonContainer.remove();
        }
      }

      btnEle.forEach((ele) => {
        const pTag = card.querySelector('p:not([class]):not(:has(a)):not(:has(.icon))');
        const btnText = ele.getAttribute('title');
        ele.setAttribute('role', 'button');
        ele.setAttribute('aria-label', getPlaceholder('coupon code aria label', btnText, pTag.textContent));
      });

      const allButtons = card.querySelectorAll('.button-container a');
      const firstButton = allButtons[0];

      if (firstButton) {
        firstButton.setAttribute('tabindex', '0');

        if (secondButtonText) {
          firstButton.dataset.successText = secondButtonText;
        }
      }

      if (copyButton && copyButton.title && /\d+/.test(copyButton.title)) {
        copyButton.addEventListener('click', (e) => {
          e.preventDefault();
          handleCopyCode(copyButton);
        });

        copyButton.addEventListener('keydown', (e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            handleCopyCode(copyButton);
          }
        });
      }
      // Make the entire card clickable only if there's an anchor tag with a picture
      const linkWithPicture = card.querySelector('a:has(picture)');
      if (linkWithPicture && linkWithPicture.href) {
        card.addEventListener('click', (event) => {
          if (event.target.tagName === 'A' || event.target.closest('a')) {
            return;
          }
          linkWithPicture.click();
        });
      }
    }

    promoWrapper.append(card);
  });
  if (cards.length === 3) {
    const section = block.closest('.section');
    if (section) {
      const seeAllLink = section.querySelector('.section__link');
      if (seeAllLink) {
        const viewMoreCard = document.createElement('div');
        viewMoreCard.className = 'promo-card promo-card--view-more';
        viewMoreCard.innerHTML = seeAllLink.innerHTML;
        promoWrapper.append(viewMoreCard);
        const isMobile = window.matchMedia('(max-width: 768px)');
        isMobile.addEventListener('change', () => {
          viewMoreCard.setAttribute('aria-hidden', !isMobile.matches);
        });
      }
    }
  }
  block.append(promoWrapper);
};

const setupQRCodeClickHandler = () => {
  // Find the QR code icon in the document (just the first one)
  const icon = document.querySelector('.products-and-promotions-container .default-content-wrapper span.icon-qr-code');

  if (icon) {
    // Add click event listener to the QR code icon
    icon.addEventListener('click', () => {
      // Toggle the 'active' class when clicked
      icon.parentElement.classList.toggle('active');
    });

    // Close QR code when clicking outside
    document.addEventListener('click', (event) => {
      if (!icon.contains(event.target)) {
        icon.parentElement.classList.remove('active');
      }
    });
  }
};

export default function decorate(block) {
  if (block.children.length < 4) {
    // eslint-disable-next-line no-console
    console.warn('Expected at least 4 children in products-and-promotions block');
    return;
  }

  if (block.children.length > 5) {
    // eslint-disable-next-line no-console
    console.warn('products-and-promotions block should only have maximum 5 childrens.');
    return;
  }

  const [productCard, featureCard, ...promoCards] = block.children;

  // Make sure to check that each child exists before decorating
  if (productCard) decorateProductCard(productCard);
  if (featureCard) decorateFeatureCard(featureCard);
  decoratePromoCards(promoCards, block);

  // Set up QR code click handlers after DOM is fully loaded
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', setupQRCodeClickHandler);
  } else {
    setupQRCodeClickHandler();
  }
}
