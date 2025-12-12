import {
  getMetadata,
  getPath,
  getUserInfo,
  decorateIcons,
  html,
  getCookie,
  getPlaceholder,
  loadBlock,
  decorateBlock,
  isLoggedIn,
  rememberPlace,
  forceCssReflow,
  handleMyaAnchors,
  loadEnvConfig,
} from '../../scripts/aem.js';

import { loadFragment } from '../fragment/fragment.js';

const globIcon = html`<span class="icon">
    <svg width="16" height="16" viewBox="0 0 16 16" xmlns="http://www.w3.org/2000/svg">
      <path
          d="M8 0C12.4063 0 16 3.59375 16 8C16 12.4375 12.4063 16 8 16C3.5625 16 0 12.4375 0 8C0 3.59375 3.5625 0 8 0ZM8 15C8.5 15 9.25 14.5625 9.90627 13.2187C10.2187 12.5937 10.5 11.8437 10.6563 11H5.3125C5.46875 11.8437 5.75 12.5937 6.0625 13.2187C6.71873 14.5625 7.46873 15 8 15ZM5.125 10H10.8437C10.9375 9.375 11 8.71873 11 8C11 7.31253 10.9375 6.65625 10.8437 6H5.125C5.03125 6.65625 5 7.31253 5 8C5 8.71873 5.03125 9.375 5.125 10ZM10.6563 5C10.5 4.15625 10.2187 3.4375 9.90627 2.8125C9.25 1.46875 8.5 1 8 1C7.46873 1 6.71873 1.46875 6.0625 2.8125C5.75 3.4375 5.46875 4.15625 5.3125 5H10.6563ZM11.8437 6C11.9375 6.65625 12 7.31253 12 8C12 8.71873 11.9375 9.375 11.8437 10H14.6875C14.875 9.375 15 8.71873 15 8C15 7.31253 14.875 6.65625 14.6875 6H11.8437ZM10.2187 1.375C10.875 2.25 11.4063 3.53125 11.6875 5H14.3125C13.5 3.3125 12.0313 2 10.2187 1.375ZM5.75 1.375C3.9375 2 2.46875 3.3125 1.65625 5H4.28125C4.5625 3.53125 5.09375 2.25 5.75 1.375ZM1 8C1 8.71873 1.09375 9.375 1.28125 10H4.125C4.03125 9.375 4 8.71873 4 8C4 7.31253 4.03125 6.65625 4.125 6H1.28125C1.09375 6.65625 1 7.31253 1 8ZM14.3125 11H11.6875C11.4063 12.5 10.875 13.75 10.2187 14.6563C12.0313 14.0313 13.5 12.7187 14.3125 11ZM4.28125 11H1.65625C2.46875 12.7187 3.9375 14.0313 5.75 14.6563C5.09375 13.75 4.5625 12.5 4.28125 11Z"
          fill="currentColor" />
    </svg>
</span>`;

const seachIcon = html`<span class="icon">
  <svg viewBox="0 0 512 512" fill="currentColor">
    <path d="M505 442.7L405.3 343c-4.5-4.5-10.6-7-17-7H372c27.6-35.3 44-79.7 44-128C416 93.1 322.9 0 208 0S0 93.1 0 208s93.1 208 208 208c48.3 0 92.7-16.4 128-44v16.3c0 6.4 2.5 12.5 7 17l99.7 99.7c9.4 9.4 24.6 9.4 33.9 0l28.3-28.3c9.4-9.4 9.4-24.6.1-34zM208 336c-70.7 0-128-57.2-128-128 0-70.7 57.2-128 128-128 70.7 0 128 57.2 128 128 0 70.7-57.2 128-128 128z"></path>
  </svg>
</span>`;

const caretDownIcon = html`<span class="icon">
  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 640 640" fill="currentColor">
    <!--!Font Awesome Free v7.0.0 by @fontawesome - https://fontawesome.com License - https://fontawesome.com/license/free Copyright 2025 Fonticons, Inc.-->
    <path d="M480 224C492.9 224 504.6 231.8 509.6 243.8C514.6 255.8 511.8 269.5 502.7 278.7L342.7 438.7C330.2 451.2 309.9 451.2 297.4 438.7L137.4 278.7C128.2 269.5 125.5 255.8 130.5 243.8C135.5 231.8 147.1 224 160 224L480 224z"/>
  </svg>
</span>`;

const isDesktop = window.matchMedia('(min-width: 1025px)');

function addSkipToMainContent() {
  const mainEl = document.querySelector('main');

  if (mainEl) {
    mainEl.id = 'main-content';
  }

  const skipToMain = html`
    <a class="skip-to-content" href="#main-content" tab-index="0">
      ${getPlaceholder('Skip to main content')}
    </a>
  `;

  document.body.prepend(skipToMain);
}

function buildHamburger(header) {
  const openAriaLabel = getPlaceholder('Open navigation');
  const closeAriaLabel = getPlaceholder('Close navigation');

  const hamburger = html`
    <button class="header__nav-hamburger"
      aria-controls="nav" aria-label="${openAriaLabel}"
      aria-expanded="false"
    >
      <span class="header__nav-hamburger-icon"></span>
      <span class="header__nav-hamburger-icon"></span>
      <span class="header__nav-hamburger-icon"></span>
    </button>
  `;

  hamburger.addEventListener('click', () => {
    const isExpanded = hamburger.getAttribute('aria-expanded') === 'true';

    if (isExpanded) {
      hamburger.setAttribute('aria-expanded', 'false');
      hamburger.setAttribute('aria-label', openAriaLabel);
      header.classList.remove('header--expanded');
    } else {
      hamburger.setAttribute('aria-expanded', 'true');
      hamburger.setAttribute('aria-label', closeAriaLabel);
      header.classList.add('header--expanded');
    }
  });

  return hamburger;
}

function buildNavclose() {
  const closeAriaLabel = getPlaceholder('Close navigation');

  const close = html`
    <button class="nav-close"
      aria-controls="nav" aria-label="${closeAriaLabel}" title="${closeAriaLabel}"
      aria-expanded="false">
    <span class='icon icon-close'></span>
    </button>
  `;
  decorateIcons(close);

  return close;
}

function buildBradcrumbs(sectionName) {
  const breadcrumbs = html`
    <div class="header__breadcrumbs">
      <span class="header__breadcrumb-one-piece">${sectionName}</span>
      <div class="header__breadcrumb-two-pieces hidden">
        <button class="header__breadcrum-item">
          ${sectionName} <span class="icon icon-chevron-right"></span>
        </button>
        <span class="header__breadcrum-item">${sectionName}</span>
      </div>
    </div>
  `;

  decorateIcons(breadcrumbs);

  let buttonAction = () => { };
  const onePieceBreadcrumb = breadcrumbs.querySelector('.header__breadcrumb-one-piece');
  const twoPiecesBreadcrumb = breadcrumbs.querySelector('.header__breadcrumb-two-pieces');

  const setOnButton = (action) => {
    buttonAction = action;
  };

  const showOnePieceBreadcrumb = () => {
    onePieceBreadcrumb.classList.remove('hidden');
    twoPiecesBreadcrumb.classList.add('hidden');
  };

  const showTwoPiecesBreadcrumb = () => {
    onePieceBreadcrumb.classList.add('hidden');
    twoPiecesBreadcrumb.classList.remove('hidden');
  };

  const updateBreadcrumb = (text = '') => {
    if (!text) {
      showOnePieceBreadcrumb();
    } else {
      showTwoPiecesBreadcrumb();

      const breadcrumbItems = twoPiecesBreadcrumb.querySelectorAll('.header__breadcrum-item');
      breadcrumbItems[1].textContent = text;

      // adding click event to the first breadcrumb item
      breadcrumbItems[0].addEventListener('click', () => {
        showOnePieceBreadcrumb();
        buttonAction();
      }, { once: true });
    }
  };

  decorateIcons(breadcrumbs);

  return { breadcrumbs, updateBreadcrumb, setOnButton };
}

function wrappingPicture(picture) {
  const listItem = picture.closest('li');
  if (!listItem) return;
  const link = listItem.querySelector('a');

  // wrapping the picture with a link if thery are the parent of a the same list item
  if (link) {
    listItem.innerHTML = '';
    listItem.append(link);
    link.prepend(picture);
    link.classList.add('header__image-with-link');
  }
}

/**
 * Builds the menu structure for the header and returns
 * menu element and a function to rebuild the menu with new content.
 * */
const buildMenu = () => {
  const menuEl = html`
    <div class="header__top-bar">
      <div class="header__top-bar-cell-one">
      </div>
      <div class="header__top-bar-cell-two">
      </div>
      <div class="header__top-bar-cell-third">
      </div>
    </div>
  `;

  const rebuildMenu = (cellOne, cellTwo, cellThree) => {
    menuEl.querySelector('.header__top-bar-cell-one').replaceChildren(...cellOne);
    menuEl.querySelector('.header__top-bar-cell-two').replaceChildren(...cellTwo);
    menuEl.querySelector('.header__top-bar-cell-third').replaceChildren(...cellThree);

    return menuEl;
  };
  return { rebuildMenu, menuEl };
};

function expandSection(el, animationWrapper) {
  animationWrapper.style.display = 'grid';
  forceCssReflow(animationWrapper);
  el.classList.add('header__nav-section--expanded');
}

function collapseSection(el, animationWrapper) {
  let onTransitionCancel;
  const onTransitionEnd = () => {
    forceCssReflow(animationWrapper);
    animationWrapper.style.display = 'none';
    el.removeEventListener('transitionend', onTransitionCancel);
  };

  onTransitionCancel = () => {
    forceCssReflow(animationWrapper);
    animationWrapper.style.display = 'none';
    el.removeEventListener('transitionend', onTransitionEnd);
  };

  el.addEventListener('transitionend', onTransitionEnd, { once: true });
  el.addEventListener('transitioncancel', onTransitionCancel, { once: true });
  el.classList.remove('header__nav-section--expanded');
}

function handleNestingLevels(
  level,
  navItem,
  updateBreadcrumb,
  setPrevSectionValue,
  setRevertTheMenuPosition,
) {
  const listItemsContentSelector = `.header__nav-section-lvl-${level} > li > p, .header__nav-section-lvl-${level} > li > a`;

  navItem.querySelectorAll(listItemsContentSelector).forEach((el) => {
    const nestedEl = el.nextElementSibling;
    const hasNestedMenu = nestedEl?.tagName === 'UL';

    if (hasNestedMenu) {
      el.innerHTML += caretDownIcon.outerHTML;
      el.classList.add(`header__nav-section-lvl-${level}-button`);

      el.parentElement.querySelectorAll(':scope > ul').forEach((submenu) => {
        submenu.classList.add('header__nav-section--nested-menu');
      });
    } else {
      el.classList.add(`header__nav-section-lvl-${level}-link`);
    }

    if (!hasNestedMenu) {
      return;
    }

    // coping the last list item from lvl1 to every lvl3 menu when the products variant
    // it copy the lines that are displyed at the bottom of the products nav sectionns
    if (nestedEl.closest('.header__nav-section--products')) {
      const bottomLinks = navItem.querySelector('.header__nav-section-lvl-1:last-child');

      bottomLinks.classList.add('header__nav-section--bottom-links');

      const lastListItem = bottomLinks.cloneNode(true);
      const listItemWrapper = html`<li class="header__item-from-lvl-1">${lastListItem}</li>`;

      nestedEl.append(listItemWrapper);
    }

    // adding the clicke event only for elements that are not part of the applications section
    if (!el.closest('.header__nav-section-lvl-1--last-list')) {
      el.addEventListener('click', () => {
        updateBreadcrumb(el.textContent.trim());
        // holding the previous section value as it will be replaced with the nestedEl
        setPrevSectionValue(navItem.querySelector('.header__nav-section-content'));
        nestedEl.classList.add(`header__nav-section-lvl-${level + 1}--expanded`);
        const sectionContent = nestedEl.closest('.header__nav-section-content');
        // remember the position of the menu to revert it later
        setRevertTheMenuPosition(rememberPlace(nestedEl));
        sectionContent.replaceWith(nestedEl);
      });
    }
  });
}

/**
 * Builds the top navigation section of the header.
 * @param {Element} topNavSection The section containing the top navigation elements.
 * @param {NodeList} navSections The sections containing the navigation items.
 * @return {Element} The constructed top navigation element.
 * */
function buildTopNav(topNavSection, navSections) {
  const logoPic = topNavSection.querySelector('.default-content-wrapper picture');
  const logoLink = logoPic.closest('a');
  const logo = logoLink || logoPic;

  if (!logo) {
    // eslint-disable-next-line no-console
    console.warn('Header: No logo found in the top nav section. Please ensure there is a logo image in the header.');
  }

  const searchEl = topNavSection.querySelector('.search.block');
  const linkList = [...topNavSection.querySelectorAll('.default-content-wrapper > ul > li')];
  const cartValue = getCookie('GenomicsCartCount') || '0';
  const sparkLogo = html`
    <a href="#" class="header__logo-spark">
      <img src="/icons/header/icon-agilent-spark-2x.webp" alt="Agilent Technologies" class="spark-logo"/>
    </a>
  `;
  const cartButton = html`
    <a href="/common/cart.jsp" class="header__cart-link">
      <span class="header__cart-link-value">${cartValue}</span>
      <img src="/icons/header/cart.webp" alt="${getPlaceholder('Shopping cart')}"/>
    </a>
  `;

  const cartUpdateHandler = (event) => {
    const { detail } = event;
    // Update the cart button with the new cart value
    cartButton.querySelector('.header__cart-link-value').textContent = detail.cartCount;
  };

  window.addEventListener('cart:Update', cartUpdateHandler);

  const navItems = [...navSections].map((section) => {
    const sectionEl = section.querySelector('.default-content-wrapper');
    const isTrainingVariant = section.classList.contains('training');
    const isProductsVariant = section.classList.contains('products');
    const isApplicationsVariant = section.classList.contains('applications');
    const { breadcrumbs, updateBreadcrumb, setOnButton } = buildBradcrumbs(section.dataset.navName);
    let prevSectionValue = null;
    let revertTheMenuPosition = null;

    const navItem = html`
      <div class="header__nav-section
          ${isTrainingVariant ? 'header__nav-section--training' : ''}
          ${isProductsVariant ? 'header__nav-section--products' : ''}
          ${isApplicationsVariant ? 'header__nav-section--applications' : ''}
      ">
        <button class="header__nav-section-button">
          ${section.dataset.navName}
          ${caretDownIcon.outerHTML}
        </button>
        <div class="header__animation-wrapper">
          <div class="header__nav-section-wrapper">
            ${breadcrumbs}
            <div class="header__nav-section-content">
              ${sectionEl ? sectionEl.innerHTML : ''}
            </div>
          </div>
        </div>
      </div>
    `;

    setOnButton(() => {
      revertTheMenuPosition();
      navItem.querySelector('.header__nav-section-wrapper').append(prevSectionValue);
    });

    navItem.querySelectorAll('.header__nav-section-content > ul').forEach((el) => {
      el.classList.add('header__nav-section-lvl-1');
    });
    navItem.querySelectorAll('.header__nav-section-lvl-1 > li > ul').forEach((el) => {
      el.classList.add('header__nav-section-lvl-2');
    });
    navItem.querySelectorAll('.header__nav-section-lvl-2 ul').forEach((el) => {
      el.classList.add('header__nav-section-lvl-3');
    });

    const setSectionValue = (newVal) => { prevSectionValue = newVal; };
    const setRevertTheMenuPosition = (newVal) => { revertTheMenuPosition = newVal; };

    if (isApplicationsVariant) {
      const lastLinkList = navItem.querySelector('.header__nav-section-lvl-1:last-of-type');
      lastLinkList.classList.add('header__nav-section-lvl-1--last-list');

      handleNestingLevels(1, navItem, updateBreadcrumb, setSectionValue, setRevertTheMenuPosition);
      navItem.querySelectorAll('.header__nav-section-lvl-2 > li:empty').forEach((el) => {
        el.classList.add('header__nav-section-separator');
      });
    } else {
      handleNestingLevels(2, navItem, updateBreadcrumb, setSectionValue, setRevertTheMenuPosition);
    }

    if (!isApplicationsVariant && !isTrainingVariant) {
      navItem.querySelectorAll('.header__nav-section-lvl-1').forEach((lvl1El) => {
        lvl1El.classList.add('header__nav-section--grey-style');
      });
    }

    if (navItem.querySelectorAll('.header__nav-section-lvl-1 li').length === 1) {
      const link = navItem.querySelector('.header__nav-section-lvl-1 li a');

      link.classList.add('header__nav-section-button');
      return link;
    }

    return navItem;
  });
  const seperator = html`<span class="header__nav-separator"></span>`;
  const hamburger = buildHamburger(document.querySelector('body'));
  const navclose = buildNavclose(document.querySelector('body'));
  const seachButton = html`<button class="header__search-button" aria-label="Search">${seachIcon}</button>`;

  seachButton.addEventListener('click', () => {
    searchEl.classList.toggle('visible');
  });

  document.addEventListener('click', (e) => {
    const searchFormCnt = document.querySelector('.search__form');
    if (!searchFormCnt.contains(e.target) && !seachButton.contains(e.target)) {
      searchEl.classList.remove('visible');
    }
  });

  logoPic.classList.add('header__logo-image');
  logoLink.classList.add('header__logo-link');

  navItems.forEach((item, index) => {
    item.querySelector('.header__nav-section-button')?.addEventListener('click', () => {
      navItems.forEach((el, elIndex) => {
        const animationWrapper = el.querySelector('.header__animation-wrapper');

        if (elIndex === index) {
          if (el.classList.contains('header__nav-section--expanded')) {
            collapseSection(el, animationWrapper);
          } else {
            expandSection(el, animationWrapper);
          }
        } else {
          if (animationWrapper) {
            animationWrapper.style.display = 'none';
          }

          el.classList.remove('header__nav-section--expanded');
        }
      });
    });
  });

  const [
    about,
    contactUs,
    languageSelector,
    anonymousButton,
    authenticatedMenuButton,
  ] = linkList.map((el, index) => {
    // changing the list items to buttons or links
    if (el.querySelector('ul')) {
      // it's a button with links list
      const buttonText = el.querySelector('p').textContent;
      const links = el.querySelector('ul');
      const leftIcon = index === 2 ? globIcon.outerHTML : '';
      globIcon.querySelector('svg').style.fill = '#ffffff';
      const button = html`<button>${leftIcon}${buttonText}${caretDownIcon.outerHTML}</button>`;
      const buttonWithLinks = html`
        <div class="header__button-with-links">
          ${button}
          ${links}
        </div>
      `;

      links.classList.add('hidden');
      button.addEventListener('click', () => {
        links.classList.toggle('hidden');
      });

      document.addEventListener('mouseout', (e) => {
        const { target } = e;

        if (target !== buttonWithLinks && target.closest('.header__button-with-links') !== buttonWithLinks) {
          links.classList.add('hidden');
        }
      });

      return buttonWithLinks;
    }

    const a = el.querySelector('a');
    const link = a?.href || '#';

    const newA = html`
      <a href="${link}">${el.textContent}</a>
    `;

    if (a.customAction) {
      newA.addEventListener('click', (e) => a.customAction(e));
    }

    return newA;
  });

  let loginButton = anonymousButton;

  const accountText = loginButton.innerHTML.trim();
  loginButton.innerHTML = `<span class="account">${accountText}</span>`;

  if (isLoggedIn()) {
    loginButton = authenticatedMenuButton;
    loginButton.classList.add('logged-in');
    const loginButtonElem = loginButton.querySelector('button');
    loginButtonElem.classList.add('loggedin-button');
    const loginButtonIconElem = html`<span class='icon icon-caret-down'></span>`;
    const userMenu = authenticatedMenuButton.querySelector('ul');
    const loggedInUser = getUserInfo();
    if (loggedInUser) {
      const userNameListItem = html`<li class="user">${loggedInUser.name}</li>`;
      userMenu.prepend(userNameListItem);
    }
    loginButtonElem.innerHTML = `
    <span class="header__login-button-label">
      ${loginButtonElem.textContent} ${loggedInUser?.name || ''}
    </span>
    ${loginButtonIconElem ? loginButtonIconElem.outerHTML : ''}
    `;
  }

  about.classList.add('header__about-button');
  languageSelector.classList.add('header__language-selector');
  contactUs.classList.add('header__contact-us', 'header__nav-section-button');
  loginButton.classList.add('header__login-button');

  languageSelector.querySelector('ul > li:last-child').classList.add('header__language-selector--last-item');

  const accountButton = html`
    <button class="header__account-button">
      <span class="header__account-button-label">${getPlaceholder('Account')}</span>
    </button>
  `;

  const { rebuildMenu, menuEl } = buildMenu();

  const rebuildForMobile = () => rebuildMenu(
    [logo, hamburger, navclose],
    [languageSelector, loginButton, seachButton, cartButton, searchEl],
    [accountButton, ...navItems, about, contactUs],
  );

  const rebuildForDesktop = () => {
    rebuildMenu(
      [logo],
      [about, contactUs, languageSelector, loginButton, searchEl],
      [sparkLogo, ...navItems, seperator, cartButton],
    );
  };

  if (isDesktop.matches) {
    rebuildForDesktop();
  } else {
    rebuildForMobile();
  }

  isDesktop.addEventListener('change', (e) => {
    if (e.matches) {
      rebuildForDesktop();
    } else {
      rebuildForMobile();
    }
  });

  return menuEl;
}

function getStickyHeaderObserver() {
  const mainCont = document.querySelector('main');
  const headerWrapper = document.querySelector('.header-wrapper');
  let isSticky = false;
  const stickyHeaderHeight = parseInt(getComputedStyle(document.documentElement).getPropertyValue('--nav-sticky-height'), 10) || 71;
  function updateStickyState() {
    const { top } = mainCont.getBoundingClientRect();

    if (top < stickyHeaderHeight && !isSticky) {
      headerWrapper.classList.add('sticky');
      isSticky = true;
    } else if (top >= stickyHeaderHeight && isSticky) {
      headerWrapper.classList.remove('sticky');
      isSticky = false;
    }
  }

  function onScroll() {
    if (isDesktop.matches) {
      window.requestAnimationFrame(updateStickyState);
    }
  }

  window.addEventListener('scroll', onScroll);
}

function trackHeaderBottomPosition() {
  const headerWrapper = document.querySelector('.header-wrapper');
  const animationWrappers = document.querySelectorAll('.header__animation-wrapper');
  if (!headerWrapper || !animationWrappers.length) return null;
  const lastPos = null;
  let frameId;
  const track = () => {
    const currentBottom = headerWrapper.getBoundingClientRect().bottom;
    if (currentBottom !== lastPos) {
      animationWrappers.forEach((wrapper) => {
        if (isDesktop.matches) {
          wrapper.style.transform = `translateY(${currentBottom}px)`;
        } else {
          wrapper.style.transform = 'none';
        }
        wrapper.style.top = '0px';
        wrapper.style.zIndex = '999';
      });
    }
    frameId = requestAnimationFrame(track);
  };
  track();
  return () => frameId && cancelAnimationFrame(frameId);
}

function userIconClick() {
  const accountIconBtn = document.querySelector('button.loggedin-button .icon-circle'); // Update selector if needed
  const loginMenu = document.querySelector('div.header__login-button ul');
  const hamburgerBtn = document.querySelector('.header__nav-hamburger');
  const navCloseBtn = document.querySelector('.nav-close');

  accountIconBtn.addEventListener('click', () => {
    hamburgerBtn.classList.remove('show');
    hamburgerBtn.classList.add('hide');
    navCloseBtn.classList.add('show');
  });
  navCloseBtn.addEventListener('click', () => {
    navCloseBtn.classList.remove('show');
    hamburgerBtn.classList.remove('hide');
    hamburgerBtn.classList.add('show');
    loginMenu.classList.add('hidden');
  });
}

/**
 * loads and decorates the header, mainly the nav
 * @param {Element} block The header block element
 */
export default async function decorate(block) {
  const config = await loadEnvConfig();
  const websiteDomain = config.assetHost;

  // load nav as fragment
  const navMeta = getMetadata('nav');

  let navPath;
  let fragment;

  function getLocaleFromPath(pathname) {
  // Match any part of the path that starts with a `/` and is followed by a locale (2 or 5 letter)
    const match = pathname.match(/^\/([a-z]{2,5}(?:-[a-z]{2})?)/);
    return match ? match[1] : null;
  }
  // UAT-15199 - within DA or EDS environment load the nav based on the locale in the path
  if (!websiteDomain.includes(window.location.hostname)) {
    const locale = getLocaleFromPath(window.location.pathname);
    if (locale) {
      navPath = `/${locale}/shared/header`;
      fragment = await loadFragment(navPath);

      if (!fragment && locale.length > 2) {
        // try to fallback to language only if region specific locale not found
        const languageOnlyLocale = locale.split('-')[0];
        navPath = `/${languageOnlyLocale}/shared/header`;
        fragment = await loadFragment(navPath);
      }
    }
  } else {
    navPath = navMeta ? new URL(navMeta, window.location).pathname : await getPath('/shared/header');
    fragment = await loadFragment(navPath);
  }

  if (fragment.lang) {
    document.getElementsByTagName('header')[0]?.setAttribute('lang', fragment.lang);
  }
  fragment.querySelectorAll('img').forEach((img) => {
    img.setAttribute('loading', 'eager');
    img.setAttribute('fetchpriority', 'high');
  });

  // decorate nav DOM
  block.textContent = '';
  const nav = html`
    <nav id="nav">
      <div class="header__overlay"></div>
      <div class="breadcrumb block"></div>
    </nav>
  `;
  const topNav = buildTopNav(fragment.firstElementChild, fragment.querySelectorAll('.section[data-nav-name]'));

  addSkipToMainContent();
  nav.prepend(topNav);
  block.append(nav);

  nav.querySelectorAll('picture').forEach((pic) => {
    wrappingPicture(pic);
  });

  getStickyHeaderObserver();
  trackHeaderBottomPosition();
  const { decorateLanguageSelector } = await import('./language-selector.js');
  decorateLanguageSelector();

  const metaDataContent = getMetadata('breadcrumb');
  if (metaDataContent) {
    const breadcrumbContainer = nav.querySelector('.breadcrumb.block');
    if (breadcrumbContainer) {
      decorateBlock(breadcrumbContainer);
      try {
        await loadBlock(breadcrumbContainer);
      } catch (error) {
        // eslint-disable-next-line no-console
        console.error('Failed to load breadcrumb block:', error);
      }
    }
  }

  nav.querySelector('.header__overlay').addEventListener('click', () => {
    if (isDesktop.matches) {
      document.querySelector('.header__nav-section--expanded')?.classList.remove('header__nav-section--expanded');
    }
  });

  await Promise.all([...block.querySelectorAll('img')].map((img) => new Promise((resolve) => {
    if (!img.complete) {
      img.addEventListener('load', resolve);
      img.addEventListener('error', resolve);
    } else {
      resolve();
    }
  })));

  if (isLoggedIn()) {
    const { initAuthUserMenu } = await import('./authenticatedUserMenu.js');
    initAuthUserMenu();
  }
  const accountIcon = isLoggedIn()
    ? document.querySelector('.loggedin-button')
    : document.querySelector('.header__login-button');
  accountIcon.setAttribute('aria-label', getPlaceholder('account'));
  accountIcon.setAttribute('tabindex', '0');
  const userIcon = document.createElement('span');
  userIcon.classList.add('icon', 'icon-circle');
  accountIcon.appendChild(userIcon);
  decorateIcons(accountIcon);
  if (!isDesktop.matches) { userIconClick(); }

  handleMyaAnchors(document);
}
