import { getMetadata, getPath } from '../../scripts/aem.js';
import { loadFragment } from '../fragment/fragment.js';

const footerItems = [
  { footer__links: '.columns-wrapper' },
  { footer__info: '.default-content-wrapper' },
  { footer__logo: '.section:nth-child(1) .default-content-wrapper img' },
  { footer__bottom: '.section:nth-child(2) .default-content-wrapper' },
  { 'footer__bottom-links': '.section:nth-child(2) ul' },
  { footer__legal: '.footer__bottom > p' },
];

const addCssClass = function addCssClass(fragment) {
  footerItems.forEach((item) => {
    const [className, selector] = Object.entries(item)[0];
    const element = fragment.querySelector(selector);
    if (element) {
      element.classList.add(className);
    } else {
      // eslint-disable-next-line no-console
      console.warn(`Element with selector "${selector}" not found in footer fragment.`);
    }
  });
};

/**
 * Loads and decorates the footer
 * @param {Element} block The footer block element
 */
export default async function decorate(block) {
  // Load footer fragment
  block.classList.add('footer');
  const footerMeta = getMetadata('footer');
  const footerPath = footerMeta ? new URL(footerMeta, window.location).pathname : await getPath('/shared/footer');
  const footerContent = await loadFragment(footerPath);
  if (footerContent.lang) {
    document.getElementsByTagName('footer')[0]?.setAttribute('lang', footerContent.lang);
  }

  if (footerContent.children.length === 3) {
    const socialBarElem = footerContent.children[0];
    const footerWrapperElem = block.parentElement;
    socialBarElem.classList.add('footer__social-bar');
    footerWrapperElem.insertAdjacentElement('afterbegin', socialBarElem);
  }

  addCssClass(footerContent);
  const footerInfo = footerContent.querySelector('.footer__info');
  const footerContactInfo = footerInfo.querySelector('ul');
  if (footerInfo.children[0].innerHTML) {
    try {
      const footerContactInfoHTML = `
        ${footerInfo.children[0].innerHTML}
        <address class="footer__address">${footerContactInfo.children[0].innerHTML}</address>
        <div class="footer__email">${footerContactInfo.children[1].innerHTML}</div>
        <div class="footer__phone">${footerContactInfo.children[2].innerHTML}</div>
      `;
      footerInfo.innerHTML = footerContactInfoHTML;
      // Remove all &nbsp; from .footer__phone (not just trailing)
      const phoneDiv = footerInfo.querySelector('.footer__phone');
      if (phoneDiv) {
        phoneDiv.innerHTML = phoneDiv.innerHTML.replace(/(&nbsp;)+/g, ' ').replace(/\s+/g, ' ').trim();
      }
    } catch (error) {
      // eslint-disable-next-line no-console
      console.warn('Error processing footer address elements:', error);
    }
  }

  block.querySelector(':scope > div').append(...footerContent.children);
}
