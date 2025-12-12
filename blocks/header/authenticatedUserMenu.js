import {
  getCookie,
  getPlaceholder,
  setCookie,
  decorateIcons,
  loadEnvConfig,
  getLocale,
} from '../../scripts/aem.js';

import {
  displayPPSModal,
  buildMsModalHtml,
  showPageSpinner,
  hidePageSpinner,
} from './headerModals.js';

const allSoldToData = {};
const userObj = JSON.parse(localStorage.getItem('userObj'));

export const mapClassesToLinks = () => {
  const hashToClasses = {
    '#myaccount': 'punchout my-account',
    '#dashboard': 'profile-dashboard punchout',
    '#chkoutstats': 'punchout',
    '#salesinvoice': 'invoice',
    '#quotes': 'punchout',
    '#savedcart': 'punchout',
    '#mycart': 'punchout',
    '#promotions': 'punchout my-promotions',
    '#agreement': 'lic-agmt',
    '#instlist': 'prod-soft',
    '#servrepair': 'punchout serv-repr',
    '#contracts': 'punchout path-cont',
    '#logout': 'punchout border-line',
    '#catalog': 'punchout',
  };

  const menuItems = document.querySelectorAll(
    '.header__button-with-links.logged-in ul li',
  );
  menuItems.forEach((li) => {
    const link = li.querySelector('a');
    if (!link) return;
    const { hash } = new URL(link.href);
    if (hashToClasses[hash]) {
      hashToClasses[hash].split(' ').forEach((cls) => li.classList.add(cls));
    }
  });
};

function getProvisionFlags() {
  const apps = Array.isArray(userObj.provisionApps)
    ? userObj.provisionApps.map((a) => a.trim().toUpperCase())
    : [];
  return {
    MYAflag: apps.includes('MYA'),
    PPSflag: apps.includes('PPS'),
    servicesRole: userObj.SHR === true || userObj.SMR === true,
    myaFnoFlag: (userObj.eCommerceStatus || '').toLowerCase() === 'web',
  };
}

function showMenuItemsByClass(classes) {
  const menuItems = document.querySelectorAll(
    '.header__button-with-links.logged-in ul li',
  );
  menuItems.forEach((li) => {
    if (classes.some((cls) => li.classList.contains(cls))) {
      li.classList.remove('hide');
    }
  });
}

function hideMenuItemsByClass(classes) {
  const menuItems = document.querySelectorAll(
    '.header__button-with-links.logged-in ul li',
  );
  menuItems.forEach((li) => {
    if (classes.some((cls) => li.classList.contains(cls))) {
      li.classList.add('hide');
    }
  });
}

function handleMYAFlags(flags) {
  const menuItems = document.querySelectorAll(
    '.header__button-with-links.logged-in ul li',
  );

  if (flags.myaFnoFlag && flags.MYAflag) {
    menuItems.forEach((li) => {
      if (li.classList.contains('lic-agmt')) {
        li.classList.remove('hide');
      }
    });
    menuItems.forEach((li) => {
      if (
        !li.classList.contains('border-line')
        && !li.classList.contains('lic-agmt')
        && !li.classList.contains('user')
      ) {
        li.classList.add('hide');
      }
    });
  } else if (flags.MYAflag) {
    showMenuItemsByClass(['profile-dashboard', 'serv-repr', 'lic-agmt']);
    menuItems.forEach((li) => {
      if (li.classList.contains('prod-soft')) {
        if (flags.servicesRole) {
          li.classList.remove('hide');
        } else {
          li.classList.add('hide');
        }
      }
    });
  } else {
    hideMenuItemsByClass([
      'profile-dashboard',
      'prod-soft',
      'serv-repr',
      'lic-agmt',
    ]);
  }
}

function handlePPSFlags(PPSflag) {
  if (PPSflag) {
    showMenuItemsByClass(['path-cont']);
    if (!getCookie('shown-pps-modal')) {
      displayPPSModal();
      setCookie('shown-pps-modal', true, 30);
    }
  } else {
    hideMenuItemsByClass(['path-cont']);
  }
}

export function provisionCheck() {
  const flags = getProvisionFlags();
  if (Object.keys(flags).length === 0) {
    hideMenuItemsByClass([
      'profile-dashboard',
      'prod-soft',
      'serv-repr',
      'path-cont',
      'lic-agmt',
    ]);
    return;
  }
  handleMYAFlags(flags);
  handlePPSFlags(flags.PPSflag);
}

export async function subscriptionLink() {
  const { country } = getLocale();
  const countryList = await loadEnvConfig();
  const orderURLCountryListInvoice = countryList.orderURLCountryListInvoice.split(',');
  const orderURLCountryListVAT = countryList.orderURLCountryListVAT.split(',');
  const allowedCountries = countryList.allowedCountries.split(',');
  const hideElementsByClass = (classNames) => {
    classNames.forEach((cls) => {
      document
        .querySelectorAll(`.${cls}`)
        .forEach((el) => el.classList.add('hide'));
    });
  };

  if (!country) {
    hideElementsByClass(['mysubscriptionlink', 'invoice', 'vat']);
  } else {
    if (!allowedCountries.includes(country)) {
      hideElementsByClass(['mysubscriptionlink']);
    }
    if (
      typeof orderURLCountryListInvoice !== 'undefined'
      && !orderURLCountryListInvoice.includes(country)
    ) {
      hideElementsByClass(['invoice']);
    }
    if (
      typeof orderURLCountryListVAT !== 'undefined'
      && !orderURLCountryListVAT.includes(country)
    ) {
      hideElementsByClass(['vat']);
    }
  }
}

export function punchoutUserIntegration() {
  const isPunchOutUser = getCookie('IPU');
  if (isPunchOutUser !== null) {
    const punchoutElements = document.querySelectorAll('.punchout');
    punchoutElements.forEach((element) => {
      const anchor = element.querySelector('a');
      if (anchor) {
        anchor.href = '#';
        anchor.style.cursor = 'auto';
      }
    });
    const moreButtons = document.querySelectorAll(
      ".header__login-button ul li[class*='moreButton']",
    );
    moreButtons.forEach((button) => {
      button.style.display = 'none';
    });
  }
}

export async function updateMyAccountSoldTo(soldtodata) {
  document.querySelectorAll('.header__soldto-item').forEach((el) => el.remove());

  const soldtoTemplate = document.createElement('template');
  soldtoTemplate.innerHTML = `
  <li class="header__soldto-item">
    <p class="header__soldto" tabindex="0">
     
      ${
  soldtodata?.soldTo
    ? `${getPlaceholder('SoldTo', soldtodata.soldTo)}`
    : ''}

      ${
  soldtodata?.friendlyName
    ? ` (${soldtodata.friendlyName})`
    : ''}
    
    </p>
  </li>`;
  const soldToElement = soldtoTemplate.content.firstElementChild;

  const userElem = document.querySelector('.header__button-with-links.logged-in ul li.user')
    || document.querySelector('.hidden .user');

  if (!userElem) {
    return;
  }

  userElem.insertAdjacentElement(
    'afterend',
    soldToElement,
  );

  const locBtn = document.querySelector('.header__soldto');
  locBtn.classList.add('loc-icon');
  locBtn.setAttribute('role', 'button');
  locBtn.setAttribute('aria-label', getPlaceholder('close'));
  locBtn.setAttribute('tabindex', '0');
  const icon = document.createElement('span');
  icon.classList.add('icon', 'icon-location');
  locBtn.prepend(icon);
  decorateIcons(locBtn);
}

export function showSoldToModal() {
  const modal = document.querySelector('#msold-modal');

  if (modal) modal.classList.add('show');
  document.querySelector('.loading-overlay').classList.add('visible');
}

export async function setNewSoldTo(soldToId, OKTUID) {
  try {
    showPageSpinner();

    const config = await loadEnvConfig();
    const getSoldToEncrypt = `${config.setLocationApi}`;
    const acomdata = `${config.soldToAcomId}`;

    const payLoad = { id: OKTUID, defaultSoldTo: soldToId, aId: acomdata };

    const res = await fetch(getSoldToEncrypt, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify(payLoad),
    });

    if (!res.ok) throw new Error(`Save failed (${res.status})`);

    const response = await res.json();

    const encryptSoldKey = response.data.soldTo || null;

    userObj.encSoldTo = encryptSoldKey;
    localStorage.setItem('userObj', JSON.stringify(userObj));
    window.location.reload();
  } catch (err) {
    console.error('K: Error saving Sold-To', err);
  } finally {
    hidePageSpinner();
  }
}

export async function getDisplaySoldTo(soldToDecryptId) {
  try {
    const config = await loadEnvConfig();
    const url = `${config.oktuidDecryptApi}`;
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ data: { encryptedData: soldToDecryptId } }),
    });
    if (!res.ok) throw new Error(`Decrypt request failed (${res.status})`);
    const response = await res.json();
    const displaySoldToData = response.data;
    updateMyAccountSoldTo(displaySoldToData);
  } catch (err) {
    console.error('F: Error decrypting Sold-To', err);
  }
}
export async function getSoldToPopUpData(cookieSoldTo, OKTUID) {
  try {
    showPageSpinner();

    const config = await loadEnvConfig();
    const url = `${config.locationSearchApi}`;
    const acomdata = `${config.soldToAcomId}`;
    const payLoad = { userId: OKTUID, aId: acomdata, scope: { soldTo: true } };
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      crossDomain: true,
      body: JSON.stringify(payLoad),
    });

    if (!res.ok) throw new Error(`Fetch failed (${res.status})`);

    const response = await res.json();

    if (!response.success) {
      document.querySelector('.loading-overlay').classList.remove('visible');
      hidePageSpinner();
      return;
    }

    const allSoldToDataPreSort = response.data.entitledSoldTo;
    const allSoldToDataSorted = [];

    allSoldToDataPreSort.soldToId.forEach((item) => {
      if (!allSoldToDataSorted.find((i) => i.id === item.id)) {
        if (item.id === allSoldToDataPreSort.defaultSoldTo) {
          allSoldToDataSorted.unshift(item);
        } else {
          allSoldToDataSorted.push(item);
        }
      }
    });

    allSoldToData.soldToId = allSoldToDataSorted;
    allSoldToData.defaultSoldTo = allSoldToDataPreSort.defaultSoldTo;

    buildMsModalHtml(
      allSoldToData,
      OKTUID,
      cookieSoldTo,
      allSoldToData.defaultSoldTo,
      setNewSoldTo,
    );
  } catch (err) {
    console.error('C: Error fetching Sold-To list', err);
  } finally {
    hidePageSpinner();
  }
}

// SoldTO Ends//

// authenticad user menu

export function initAuthUserMenu() {
  mapClassesToLinks();

  const menuItems = document.querySelectorAll('.header__button-with-links.logged-in ul li');
  const presentClasses = new Set();
  menuItems.forEach((li) => {
    li.classList.forEach((cls) => presentClasses.add(cls));
  });

  const classFunctionMap = {
    punchout: punchoutUserIntegration,
    'profile-dashboard': provisionCheck,
    'serv-repr': provisionCheck,
    'lic-agmt': provisionCheck,
    'prod-soft': provisionCheck,
    'path-cont': provisionCheck,
    mysubscriptionlink: subscriptionLink,
    invoice: subscriptionLink,
    vat: subscriptionLink,
  };

  const calledFunctions = new Set();
  Object.entries(classFunctionMap).forEach(([cls, fn]) => {
    if (presentClasses.has(cls) && !calledFunctions.has(fn)) {
      fn();
      calledFunctions.add(fn);
    }
  });

  // SoldTo
  const defaultSoldToId = '';
  const OKTUID = userObj.userId;
  const encSoldToID = userObj.encSoldTo;
  const myaFnoFlag = ((userObj.eCommerceStatus) || '').toLowerCase() === 'web';
  if (!myaFnoFlag) {
    if (
      typeof OKTUID !== 'undefined'
      && OKTUID != null
      && typeof encSoldToID !== 'undefined'
      && encSoldToID != null
    ) {
      getDisplaySoldTo(encSoldToID, OKTUID, defaultSoldToId);
    }
  }
  document.addEventListener('click', (e) => {
    const el = e.target;
    if (el.classList && el.classList.contains('header__soldto')) {
      if (document.querySelector('#msold-modal')) {
        showSoldToModal(encSoldToID, OKTUID, defaultSoldToId);
      } else {
        getSoldToPopUpData(encSoldToID, OKTUID, defaultSoldToId);
      }
    }
  });
}
