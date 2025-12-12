import {
  decorateIcons, getLocale, getMetadata, getPath, html,
} from '../../scripts/aem.js';
import { loadFragment } from '../fragment/fragment.js';

/**
 * Toggles the visibility of an element.
 * @param {Element} button The button controlling the toggle.
 * @param {Element} content The content to be toggled.
 * @param {string} hiddenClass The class to toggle for hiding the content.
 */
export function toggleElement(button, content, hiddenClass) {
  const isExpanded = button.getAttribute('aria-expanded') === 'true';
  const newExpandedState = !isExpanded;

  button.setAttribute('aria-expanded', newExpandedState);
  content.classList.toggle(hiddenClass, !newExpandedState);
}

/**
 * Combines multiple `<ul>` elements into a single `<ul>`.
 * @param {NodeListOf<Element>} uls The list of `<ul>` elements.
 * @returns {Element} A single `<ul>` containing all `<li>` elements.
 */
function combineMultipleULs(uls) {
  const combinedUL = html`<ul></ul>`;
  uls.forEach((ul) => {
    [...ul.children].forEach((li) => {
      combinedUL.appendChild(li.cloneNode(true));
    });
  });
  return combinedUL;
}

/**
 * Builds an accordion item.
 * @param {Element} li The `li` element representing the accordion item.
 * @param {string} idPrefix The prefix for generating unique IDs.
 * @param {number} index The index of the current accordion item.
 * @returns {Element} The constructed accordion item element.
 */
export function buildAccordionItem(li, idPrefix, index) {
  const title = li.querySelector('h1, h2, h3, h4, h5, h6');
  if (!title) {
    return null;
  }

  const additionalElements = [...title.querySelectorAll('picture')];

  // Wrap each picture in an <a> tag with the image src as the href
  const wrappedAdditionalElements = additionalElements.map((picture) => {
    const img = picture.querySelector('img');
    if (!img) return picture;

    const href = img.getAttribute('src');
    return html`
    <a href="${href}" target="_blank" rel="noopener noreferrer">
      ${picture.outerHTML}
    </a>
  `;
  });

  // Remove the original <picture> elements
  additionalElements.forEach((el) => el.remove());

  const buttonId = `${idPrefix}-button-${index}`;
  const contentId = `${idPrefix}-content-${index}`;

  const link = title.querySelector('a');
  const linkHref = link ? link.getAttribute('href') : null;

  // If <a> exists, wrap the button inside the <a> tag
  const accordionButton = link
    ? html`
        <a href="${linkHref}" class="wechat-floatingbar__accordion-item-link">
          <button id="${buttonId}" class="wechat-floatingbar__accordion-item-title wechat-floatingbar__accordion-item-title-link" aria-expanded="false" aria-controls="${contentId}">
             ${title.textContent}
            <span class="icon icon-chevron-right"></span>
          </button>
        </a>
      `
    : html`
        <button id="${buttonId}" class="wechat-floatingbar__accordion-item-title" aria-expanded="false" aria-controls="${contentId}">
          ${title.innerHTML}
          <span class="icon icon-chevron-right"></span>
        </button>
      `;

  const contentElements = [...li.children].filter((child) => !child.matches('h1, h2, h3, h4, h5, h6, ul'));

  const accordionContent = html`
    <div id="${contentId}" class="wechat-floatingbar__accordion-item-content hidden" aria-hidden="true">
      ${wrappedAdditionalElements.map((el) => el.outerHTML).join('')}
      ${contentElements.map((child) => child.outerHTML).join('')}
    </div>
  `;

  if (!link) {
    accordionButton.addEventListener('click', () => {
      toggleElement(accordionButton, accordionContent, 'hidden');
    });
  }

  const accordionItem = html`
    <div class="wechat-floatingbar__accordion-item">
      ${accordionButton}
      ${accordionContent}
    </div>
  `;

  return accordionItem;
}

/**
 * Builds an accordion structure for a given `ul` element.
 * @param {Element} ul The `ul` element containing the accordion items.
 * @param {string} idPrefix The prefix for generating unique IDs.
 * @returns {Element} The constructed accordion element.
 */
function buildAccordion(ul, idPrefix) {
  const items = ul.querySelectorAll('li');
  const accordion = html`<div class="wechat-floatingbar__accordion"></div>`;

  items.forEach((item, index) => {
    const accordionItem = buildAccordionItem(item, idPrefix, index);
    if (accordionItem) {
      accordion.appendChild(accordionItem);
    }
  });

  return accordion;
}

function manageFloatingQRState(toggleButton, listWrapper) {
  const observer = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          toggleButton.setAttribute('aria-expanded', 'false');
          listWrapper.classList.add('hidden');
        } else {
          toggleButton.setAttribute('aria-expanded', 'true');
          listWrapper.classList.remove('hidden');
        }
      });
    },
    { threshold: 0.5 },
  );

  const hero = document.querySelector('.hero');
  if (hero) {
    observer.observe(hero);
  } else {
    toggleButton.setAttribute('aria-expanded', 'true');
    listWrapper.classList.remove('hidden');
  }
}

function toggleFloatingQRList(button, list) {
  toggleElement(button, list, 'hidden');
}

export function buildDesktopFloatingQR(fragment) {
  const children = [...fragment.children];
  if (!children.length) {
    return null;
  }

  const icon = children[1];
  const iconContent = icon.querySelector('p');
  const firstLevelItems = children.slice(2);

  const toggleButton = html`
    <button class="wechat-floatingbar__toggle" aria-expanded="false" aria-controls="wechat-floatingbar-list">
      ${iconContent ? iconContent.innerHTML : ''}
    </button>
  `;

  const listWrapper = html`
    <div id="wechat-floatingbar-list" class="wechat-floatingbar__list hidden"></div>
  `;

  firstLevelItems.forEach((item, index) => {
    const title = item.querySelector(':scope > div:first-child > p');
    const uls = item.querySelectorAll('ul');

    if (!title) return;

    const listItem = html`<div class="wechat-floatingbar__list-item"></div>`;

    if (uls.length > 0) {
      const combinedUL = combineMultipleULs(uls);
      const accordion = buildAccordion(combinedUL, `accordion-${index}`);
      const accordionButton = html`
        <button class="wechat-floatingbar__list-title" aria-expanded="false" aria-controls="accordion-${index}">
          ${title.innerHTML}
        </button>
      `;

      const accordionWrapper = html`
        <div id="accordion-${index}" class="wechat-floatingbar__accordion-wrapper hidden">
          ${accordion}
        </div>
      `;

      accordionButton.addEventListener('click', () => {
        // Close all other first-level items
        const allButtons = document.querySelectorAll('.wechat-floatingbar__list-title');
        const allWrappers = document.querySelectorAll('.wechat-floatingbar__accordion-wrapper');

        allButtons.forEach((btn) => {
          if (btn !== accordionButton) {
            btn.setAttribute('aria-expanded', 'false');
          }
        });

        allWrappers.forEach((wrapper) => {
          if (wrapper !== accordionWrapper) {
            wrapper.classList.add('hidden');
          }
        });

        const isExpanded = accordionButton.getAttribute('aria-expanded') === 'true';
        accordionButton.setAttribute('aria-expanded', !isExpanded);
        accordionWrapper.classList.toggle('hidden', isExpanded);
      });

      listItem.appendChild(accordionButton);
      listItem.appendChild(accordionWrapper);
    } else {
      const linkElement = title.querySelector('a');
      if (!linkElement) return;
      const href = linkElement.getAttribute('href');
      const iconSvg = title.querySelector('span.icon');
      const hasIconInsideLink = !!linkElement.querySelector('span.icon');

      const link = html`
    <a href="${href}" class="wechat-floatingbar__list-title">
      ${!hasIconInsideLink && iconSvg ? iconSvg.outerHTML : ''}
      ${linkElement.innerHTML}
    </a>
  `;

      listItem.appendChild(link);
    }

    listWrapper.appendChild(listItem);
  });

  toggleButton.addEventListener('click', () => toggleFloatingQRList(toggleButton, listWrapper));

  manageFloatingQRState(toggleButton, listWrapper);

  const floatingQR = html`
    <div class="wechat-floatingbar">
      ${toggleButton}
      ${listWrapper}
    </div>
  `;

  return floatingQR;
}

export function buildMobileFloatingQR(fragment, isChinaVersion = false) {
  const firstChild = fragment.children[0];
  if (!firstChild) return null;

  const paragraphs = firstChild.querySelectorAll('p');

  const mobileWrapper = html`<div class="wechat-floatingbar__mobile"></div>`;

  paragraphs.forEach((p) => {
    const link = p.querySelector('a');
    const icon = p.querySelector('span.icon');
    if (!link) return;

    const href = link.getAttribute('href');
    const title = link.textContent.trim();

    // For China version, we may want to add specific behavior or styling
    const mobileItem = html`
      <a href="${href}" title="${link.getAttribute('title') || ''}" class="agt-button agt-button--primary wechat-floatingbar__mobile-item ${!isChinaVersion ? 'wechat-floatingbar__mobile-item--global' : ''}">
          ${icon ? icon.outerHTML : ''}
          ${!isChinaVersion ? title : ''}
      </a>
    `;

    mobileWrapper.appendChild(mobileItem);
  });

  return mobileWrapper;
}

export default async function decorate(block) {
  const isMobile = window.matchMedia('(max-width: 767px)');
  const isChinaVersion = getLocale().country === 'CN';

  block.innerHTML = '';
  const floatingBar = getMetadata('wechat-floatingbar');
  const fragmentPath = floatingBar ? new URL(floatingBar, window.location).pathname : await getPath('/shared/floating');
  const fragment = await loadFragment(fragmentPath);

  if (!fragment) {
    return;
  }

  let currentView = null;

  const renderView = () => {
    if (currentView) {
      block.removeChild(currentView);
    }

    const clonedFragment = fragment.cloneNode(true);

    if (isChinaVersion) {
      // Render China-specific floating bar
      currentView = isMobile.matches
        ? buildMobileFloatingQR(clonedFragment, true) // China-specific mobile view
        : buildDesktopFloatingQR(clonedFragment); // China-specific desktop view
    } else {
      // Render global floating bar for all devices
      currentView = buildMobileFloatingQR(clonedFragment, false);
    }

    if (currentView) {
      decorateIcons(currentView);
      const hasContent = currentView.querySelector('a, button') || currentView.textContent.trim();

      if (!hasContent) {
        block.remove();
        return null;
      }
      block.appendChild(currentView);
      return block;
    }

    return null;
  };

  renderView();

  // Re-render on viewport changes
  isMobile.addEventListener('change', renderView);
}
