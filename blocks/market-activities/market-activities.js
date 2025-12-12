import { serviceFormTemplate } from '../../scripts/atoms/selectBoxDown.js';
import {
  handleFormSubmit,
  setupCustomDropdown,
} from '../../scripts/common/selectBoxHandler.js';
import { html, decorateResponsiveMedia } from '../../scripts/aem.js';

function processBlockContent(block, wrapper) {
  const rows = [...block.children];

  rows.forEach((row) => {
    const item = html`<div class="market-activity__item"></div>`;
    item.innerHTML = row.innerHTML;
    const [thumbnail, content] = item.children;

    if (thumbnail) {
      thumbnail.className = 'market-activity__thumbnail';
    }

    if (!content) return;

    content.className = 'market-activity__content';
    decorateResponsiveMedia(content);

    const qrImageIndex = [...content.children].findIndex((element) => element.querySelector('picture, img'));

    [...content.children].forEach((child) => {
      if (child.tagName === 'P' && child.textContent.includes('(mobile)')) {
        child.classList.add('mobile-content');
        child.textContent = child.textContent.replace('(mobile)', '').trim();
      }
    });

    if (qrImageIndex >= 0) {
      const container = html`<div class="market-activity__container"></div>`;
      const textContainer = html`<div class="market-activity__text"></div>`;
      const imageContainer = html`<div class="market-activity__image"></div>`;

      const remainingContent = [...content.children].slice(qrImageIndex + 1);
      if (remainingContent.length > 0) {
        textContainer.append(...remainingContent);
      }

      imageContainer.appendChild([...content.children][qrImageIndex]);
      container.append(imageContainer, textContainer);

      const title = html`<div class="market-activity__title"></div>`;
      const titleContent = content.querySelector('h1,h2,h3,h4,h5');
      const titleLink = content.querySelector('.button-container');

      if (titleContent) title.append(titleContent);
      if (titleLink) title.append(titleLink);

      content.append(title, container);
    } else {
      const formLinks = content.querySelector('ul');
      const submitButtonEl = content.querySelector('ul + .button-container a');
      let hasForm = false;
      if (formLinks) {
        const items = Array.from(formLinks.querySelectorAll('li')).map((li) => li.innerHTML.trim());
        const formHtml = serviceFormTemplate({ items }, submitButtonEl);

        if (formHtml) {
          const formWrapper = document.createElement('div');
          formWrapper.innerHTML = formHtml;
          const form = formWrapper.firstElementChild;

          if (form) {
            form.addEventListener('submit', handleFormSubmit);
            setupCustomDropdown(form);
            formLinks.replaceWith(form);
            hasForm = true;
          }
        }
      }

      if (submitButtonEl) {
        submitButtonEl.remove();
      }

      const title = html`<div class="market-activity__title"></div>`;
      const titleContent = content.querySelector('h1,h2,h3,h4,h5');
      const titleLink = content.querySelector('.button-container');

      if (titleLink) title.append(titleLink);
      if (titleContent) title.append(titleContent);
      if (title.children.length > 0) content.prepend(title);
      const container = html`<div class="market-activity__container"></div>`;
      const textContainer = html`<div class="market-activity__text"></div>`;

      textContainer.append(
        ...[...content.children].filter((child) => child !== title),
      );

      if (hasForm) container.classList.add('form-field');
      container.appendChild(textContainer);
      content.appendChild(container);
    }

    wrapper.appendChild(item);
  });
}

/**
 * Loads and decorates the market activities block
 * @param {Element} block The market activities block element
 */
export default function decorate(block) {
  const wrapper = document.createElement('div');
  wrapper.className = 'market-activities-inner';

  try {
    processBlockContent(block, wrapper);
    block.innerHTML = '';
    block.appendChild(wrapper);
    const mq = matchMedia('(min-width:1025px)');
    const sync = () => requestAnimationFrame(() => {
      const els = document.querySelectorAll('.market-activity__container');
      els.forEach((el) => {
        el.style.minHeight = (mq.matches && els.length)
          ? `${Math.max(...[...els].map((c) => c.offsetHeight))}px`
          : '';
      });
    });
    ['resize'].forEach((evt) => window.addEventListener(evt, sync, { passive: true }));
    mq.addEventListener('change', sync);
    sync();
  } catch (error) {
    console.warn('Authoring error: ', error);
  }
}
