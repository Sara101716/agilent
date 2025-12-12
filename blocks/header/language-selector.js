import {
  html,
  isLoggedIn,
  setLanguage,
  loadEnvConfig,
  getPlaceholder,
  decorateIcons,
  getCountryInfo,
  getLocale,
} from '../../scripts/aem.js';

const globIcon = document.createElement('div');
globIcon.classList.add('language-globe');
const icon = document.createElement('span');
icon.classList.add('icon', 'icon-globe');
globIcon.appendChild(icon);
decorateIcons(globIcon);

const caretDownIcon = document.createElement('div');
caretDownIcon.classList.add('language-caret-down');
const caretIcon = document.createElement('span');
caretIcon.classList.add('icon', 'icon-caret-down');
caretDownIcon.appendChild(caretIcon);
decorateIcons(caretDownIcon);

export async function decorateLanguageSelector() {
  const config = await loadEnvConfig();

  const countryCode = getLocale().country;
  const countryDetails = await getCountryInfo(countryCode);
  if (!countryDetails || !config.lang || !config.countryNames) return;

  const countryArray = Object.entries(config.countryNames).map(([Key, Text]) => ({ Key, Text }));
  const loc = countryArray.find((locs) => locs.Key === countryDetails.country);
  if (!loc) return;

  const langSelector = document.querySelector('.header__language-selector');
  const langButton = langSelector.querySelector('button');
  langButton.ariaControls = 'langList';
  langButton.type = 'button';
  langButton.id = 'langButton';
  langButton.ariaHasPopup = true;

  const langList = langSelector.querySelector('ul');
  langList.role = 'menu';
  langList.id = 'langList';
  langList.ariaLabelledby = 'langButton';

  langList.classList.remove('hidden');

  const currentLanguage = getLocale().language;
  const languageNames = loc.Text.split(',');
  const localname = languageNames[0];
  const globalname = languageNames[1];
  const countryName = countryDetails.defaultLanguage === currentLanguage ? localname : globalname;

  langButton.ariaLabel = getPlaceholder('Language Button Aria Label');

  langButton.innerHTML = '';
  langButton.append(globIcon, ` ${countryName}`, caretDownIcon);

  const moreButtonContent = langList.lastElementChild.innerHTML;
  const moreButtonLink = langList.lastElementChild.querySelector('a').getAttribute('href');
  langList.innerHTML = '';

  if (loc && countryDetails.languages.length > 1) {
    langList.classList.add('hidden');
    langButton.ariaExpanded = false;

    countryDetails.languages.forEach((lang) => {
      const langArray = Object.entries(config.lang).map(([Key, Text]) => ({ Key, Text }));
      const langName = langArray.find((l) => l.Key === lang);
      if (langName) {
        const langLi = html`
          <li>
            <a
              href="#"
              class="${currentLanguage === langName.Key ? 'disabled' : ''}"
              role="menuitem"
              aria-label="${langName.Text}"
              tabindex="${currentLanguage === langName.Key ? -1 : 0}"
              aria-disabled="${currentLanguage === langName.Key ? 'true' : 'false'}"
            >
              ${langName.Text}
            </a>
          </li>
        `;
        langLi.querySelector('a').addEventListener('click', (e) => {
          e.preventDefault();
          if (langLi.querySelector('a').classList.contains('disabled')) return;
          setLanguage(langName.Key);
          window.location.reload();
        });
        langList.appendChild(langLi);
      }
    });

    if (!isLoggedIn()) { // User is not logged in
      const span = document.createElement('li');
      span.innerHTML = moreButtonContent;
      span.classList.add('more-button');
      const moreButtonIcon = document.createElement('span');
      moreButtonIcon.classList.add('language-more-button');
      const moreIcon = document.createElement('span');
      moreIcon.classList.add('icon', 'icon-chevron-right');
      moreButtonIcon.appendChild(moreIcon);
      decorateIcons(moreButtonIcon);
      span.querySelector('a').appendChild(moreButtonIcon);
      langList.appendChild(span);
    }

    let currentIndex = 0;

    const items = langList.querySelectorAll('a:not(.disabled)');
    if (!items.length) return;

    langButton.addEventListener('keydown', (e) => {
      if ((e.key === 'Enter' || e.key === ' ') && langList.classList.contains('hidden')) {
        e.preventDefault();
        langList.classList.remove('hidden');
        items[currentIndex].focus();
        langButton.ariaExpanded = true;
      }
    });

    items.forEach((item) => item.addEventListener('keydown', (e) => {
      switch (e.key) {
        case 'ArrowDown':
          e.preventDefault();
          currentIndex = (currentIndex + 1) % items.length;
          items[currentIndex].focus();
          break;

        case 'ArrowUp':
          e.preventDefault();
          currentIndex = (currentIndex - 1 + items.length) % items.length;
          items[currentIndex].focus();
          break;

        case 'Enter':
        case ' ':
          e.preventDefault();
          items[currentIndex].click();
          break;

        case 'Escape':
          e.preventDefault();
          langList.classList.add('hidden');
          langButton.ariaExpanded = false;
          langButton.focus();
          currentIndex = 0;
          break;

        default:
          break;
      }
    }));

    langButton.onclick = () => {
      langList.classList.remove('hidden');
      langList.focus();
      langButton.ariaExpanded = true;
    };

    langSelector.addEventListener('mouseleave', () => {
      langList.classList.add('hidden');
      langButton.ariaExpanded = false;
    });
  } else {
    langList.remove();
    langButton.ariaExpanded = false;
    langButton.querySelectorAll('.icon')[1].style.display = 'none';
    langButton.onclick = () => {
      window.location.href = moreButtonLink;
    };
  }
}
