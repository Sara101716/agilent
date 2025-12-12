/*
 * Copyright 2025 Adobe. All rights reserved.
 * This file is licensed to you under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License. You may obtain a copy
 * of the License at http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software distributed under
 * the License is distributed on an "AS IS" BASIS, WITHOUT WARRANTIES OR REPRESENTATIONS
 * OF ANY KIND, either express or implied. See the License for the specific language
 * governing permissions and limitations under the License.
 */

/* eslint-env browser */
function sampleRUM(checkpoint, data) {
  // eslint-disable-next-line max-len
  const timeShift = () => (window.performance ? window.performance.now() : Date.now() - window.hlx.rum.firstReadTime);
  try {
    window.hlx = window.hlx || {};
    sampleRUM.enhance = () => { };
    if (!window.hlx.rum) {
      const param = new URLSearchParams(window.location.search).get('rum');
      const weight = (window.SAMPLE_PAGEVIEWS_AT_RATE === 'high' && 10)
        || (window.SAMPLE_PAGEVIEWS_AT_RATE === 'low' && 1000)
        || (param === 'on' && 1)
        || 100;
      const id = Math.random().toString(36).slice(-4);
      const isSelected = param !== 'off' && Math.random() * weight < 1;
      // eslint-disable-next-line object-curly-newline, max-len
      window.hlx.rum = {
        weight,
        id,
        isSelected,
        firstReadTime: window.performance ? window.performance.timeOrigin : Date.now(),
        sampleRUM,
        queue: [],
        collector: (...args) => window.hlx.rum.queue.push(args),
      };
      if (isSelected) {
        const dataFromErrorObj = (error) => {
          const errData = { source: 'undefined error' };
          try {
            errData.target = error.toString();
            errData.source = error.stack
              .split('\n')
              .filter((line) => line.match(/https?:\/\//))
              .shift()
              .replace(/at ([^ ]+) \((.+)\)/, '$1@$2')
              .replace(/ at /, '@')
              .trim();
          } catch (err) {
            /* error structure was not as expected */
          }
          return errData;
        };

        window.addEventListener('error', ({ error }) => {
          const errData = dataFromErrorObj(error);
          sampleRUM('error', errData);
        });

        window.addEventListener('unhandledrejection', ({ reason }) => {
          let errData = {
            source: 'Unhandled Rejection',
            target: reason || 'Unknown',
          };
          if (reason instanceof Error) {
            errData = dataFromErrorObj(reason);
          }
          sampleRUM('error', errData);
        });

        sampleRUM.baseURL = sampleRUM.baseURL || new URL(window.RUM_BASE || '/', new URL('https://rum.hlx.page'));
        sampleRUM.collectBaseURL = sampleRUM.collectBaseURL || sampleRUM.baseURL;
        sampleRUM.sendPing = (ck, time, pingData = {}) => {
          // eslint-disable-next-line max-len, object-curly-newline
          const rumData = JSON.stringify({
            weight,
            id,
            referer: window.location.href,
            checkpoint: ck,
            t: time,
            ...pingData,
          });
          const urlParams = window.RUM_PARAMS
            ? `?${new URLSearchParams(window.RUM_PARAMS).toString()}`
            : '';
          const { href: url, origin } = new URL(
            `.rum/${weight}${urlParams}`,
            sampleRUM.collectBaseURL,
          );
          const body = origin === window.location.origin
            ? new Blob([rumData], { type: 'application/json' })
            : rumData;
          navigator.sendBeacon(url, body);
          // eslint-disable-next-line no-console
          console.debug(`ping:${ck}`, pingData);
        };
        sampleRUM.sendPing('top', timeShift());

        sampleRUM.enhance = () => {
          // only enhance once
          if (document.querySelector('script[src*="rum-enhancer"]')) return;
          const { enhancerVersion, enhancerHash } = sampleRUM.enhancerContext || {};
          const script = document.createElement('script');
          if (enhancerHash) {
            script.integrity = enhancerHash;
            script.setAttribute('crossorigin', 'anonymous');
          }
          script.src = new URL(
            `.rum/@adobe/helix-rum-enhancer@${enhancerVersion || '^2'}/src/index.js`,
            sampleRUM.baseURL,
          ).href;
          document.head.appendChild(script);
        };
        if (!window.hlx.RUM_MANUAL_ENHANCE) {
          sampleRUM.enhance();
        }
      }
    }
    if (window.hlx.rum && window.hlx.rum.isSelected && checkpoint) {
      window.hlx.rum.collector(checkpoint, data, timeShift());
    }
    document.dispatchEvent(new CustomEvent('rum', { detail: { checkpoint, data } }));
  } catch (error) {
    // something went awry
  }
}

/**
 * Retrieves the content of metadata tags.
 * @param {string} name The metadata name (or property)
 * @param {Document} doc Document object to query for metadata. Defaults to the window's document
 * @returns {string} The metadata value(s)
 */
function getMetadata(name, doc = document) {
  const attr = name && name.includes(':') ? 'property' : 'name';
  const meta = [...doc.head.querySelectorAll(`meta[${attr}="${name}"]`)]
    .map((m) => m.content)
    .join(', ');
  return meta || '';
}

function getCookie(name) {
  const value = `; ${document.cookie}`;
  const parts = value.split(`; ${name}=`);
  if (parts.length >= 2) {
    return decodeURIComponent(parts.pop().split(';').shift());
  }
  return null;
}

function isCDN(hostname = window.location.hostname, matchAllInternal = false) {
  return (matchAllInternal && hostname === window.location.hostname) || hostname === 'agilent.com' || hostname === 'agilent.com.cn' || hostname.endsWith('.agilent.com') || hostname.endsWith('.agilent.com.cn');
}

function isEDS() {
  return window.location.hostname.endsWith('aem.page')
    || window.location.hostname.endsWith('aem.live');
}

function setCookie(name, value, days) {
  let expires = '';
  let currentDomain = '';
  if (typeof days === 'number') {
    const date = new Date();
    date.setTime(date.getTime() + Math.ceil(days * 864e5)); // 864e5 = 86400000 ms = 1 day
    expires = `; expires=${date.toUTCString()}`;
  }
  if (window.location.hostname.endsWith('.agilent.com.cn')) {
    currentDomain = '; domain=.agilent.com.cn';
  } else if (isCDN()) {
    currentDomain = '; domain=.agilent.com';
  }
  document.cookie = `${name}=${encodeURIComponent(value)}${expires}; path=/${currentDomain}`;
}

const legacyLocaleCookieName = 'agilent_locale';
const legacyLocales = {
  zh: 'zh_CN',
  ja: 'ja_JP',
  de: 'de_DE',
  es: 'es_ES',
  fr: 'fr_FR',
  it: 'it_IT',
  ko: 'ko_KR',
  pt: 'pt_BR',
  en: 'en_US',
};
function setLanguage(language) {
  setCookie(legacyLocaleCookieName, legacyLocales[language], 90);
}
const countryCodeCookieName = 'CountryCode';
function setLocale(language, country) {
  setLanguage(language);
  setCookie(countryCodeCookieName, country.toUpperCase(), 90);
}

let locale;
function getLocale() {
  if (locale) {
    return locale;
  }

  const storedLanguageCookie = getCookie(legacyLocaleCookieName);
  const storedLanguage = (typeof storedLanguageCookie === 'string')
    ? storedLanguageCookie.toLowerCase().substring(0, 2)
    : '';
  const validLanguage = /^[a-z]{2}$/.test(storedLanguage);
  const language = validLanguage ? storedLanguage : 'en';

  const storedCountryCookie = getCookie(countryCodeCookieName);
  const storedCountry = (typeof storedCountryCookie === 'string')
    ? storedCountryCookie.toUpperCase()
    : '';
  const validCountry = /^[A-Z]{2}$/.test(storedCountry);
  const country = validCountry ? storedCountry : 'US';

  const languageCountry = `${language}-${country}`;

  if (!validLanguage || !validCountry) {
    setLocale(language, country);
  }

  const fallbacks = [languageCountry, ...(getMetadata('locale-fallbacks') || `${language}, en`).split(/ *, */)];
  locale = {
    languageCountry,
    language,
    country,
    rootPath: languageCountry.toLowerCase(),
    fallbacks,
    fallbackPaths: fallbacks.map((fallback) => fallback.toLowerCase()),
  };
  return locale;
}

/**
 * Setup block utils.
 */
function setup() {
  window.hlx = window.hlx || {};
  window.hlx.RUM_MASK_URL = 'full';
  window.hlx.RUM_MANUAL_ENHANCE = true;
  window.hlx.codeBasePath = '';
  window.hlx.lighthouse = new URLSearchParams(window.location.search).get('lighthouse') === 'on';

  const scriptEl = document.querySelector('script[src$="/scripts/scripts.js"]');
  if (scriptEl) {
    try {
      [window.hlx.codeBasePath] = new URL(scriptEl.src).pathname.split('/scripts/scripts.js');
    } catch (error) {
      // eslint-disable-next-line no-console
      console.error('setup failed', error);
    }
  }
}

let fetchIndexPromise;
async function fetchIndex() {
  if (fetchIndexPromise) {
    return fetchIndexPromise;
  }
  fetchIndexPromise = (async () => {
    try {
      const indexResponse = await fetch('/query-index.json');
      if (indexResponse.ok) {
        const index = await indexResponse.json();
        return Object.fromEntries(index.data.map((item) => [item.path, item]));
      }
      // eslint-disable-next-line no-console
      console.error('Failed to fetchIndex', indexResponse.status, indexResponse.statusText);
    } catch (e) {
      // eslint-disable-next-line no-console
      console.error('Failed to fetchIndex', e);
    }
    return {};
  })();
  return fetchIndexPromise;
}

/**
 * Sanitizes a string for use as class name.
 * @param {string} name The unsanitized string
 * @returns {string} The class name
 */
function toClassName(name) {
  return typeof name === 'string'
    ? name
      .toLowerCase()
      .replace(/[^0-9a-z]/gi, '-')
      .replace(/-+/g, '-')
      .replace(/^-|-$/g, '')
    : '';
}

/**
 * Sanitizes a string for use as a js property name.
 * @param {string} name The unsanitized string
 * @returns {string} The camelCased name
 */
function toCamelCase(name) {
  return toClassName(name).replace(/-([a-z])/g, (g) => g[1].toUpperCase());
}

/**
 * Extracts the config from a block.
 * @param {Element} block The block element
 * @returns {object} The block config
 */
// eslint-disable-next-line import/prefer-default-export
function readBlockConfig(block) {
  const config = {};
  block.querySelectorAll(':scope > div').forEach((row) => {
    if (row.children) {
      const cols = [...row.children];
      if (cols[1]) {
        const col = cols[1];
        const name = toCamelCase(cols[0].textContent);
        let value = '';
        if (col.querySelector('a')) {
          const as = [...col.querySelectorAll('a')];
          if (as.length === 1) {
            value = as[0].href;
          } else {
            value = as.map((a) => a.href);
          }
        } else if (col.querySelector('img')) {
          const imgs = [...col.querySelectorAll('img')];
          if (imgs.length === 1) {
            const img = imgs[0];
            value = { src: img.src, altText: img.alt || '' };
          } else {
            value = imgs.map((img) => ({ src: img.src, altText: img.alt || '' }));
          }
        } else if (col.querySelector('p')) {
          const ps = [...col.querySelectorAll('p')];
          if (ps.length === 1) {
            value = ps[0].textContent;
          } else {
            value = ps.map((p) => p.textContent);
          }
        } else value = row.children[1].textContent;
        config[name] = value;
      }
    }
  });
  return config;
}

/**
 * Loads a CSS file.
 * @param {string} href URL to the CSS file
 */
async function loadCSS(href) {
  return new Promise((resolve) => {
    if (!document.querySelector(`head > link[href="${href}"]`)) {
      const link = document.createElement('link');
      link.rel = 'stylesheet';
      link.href = href;
      // TODO: the below onload were cancelling promises. Now forcefully resolving the loadCSS task.
      // link.onload = resolve;
      // link.onerror = reject;
      document.head.append(link);
      resolve();
    } else {
      resolve();
    }
  });
}

/**
 * Loads a non module JS file.
 * @param {string} src URL to the JS file
 * @param {Object} attrs additional optional attributes
 */
async function loadScript(src, attrs) {
  return new Promise((resolve, reject) => {
    if (!document.querySelector(`head > script[src="${src}"]`)) {
      const script = document.createElement('script');
      script.src = src;
      if (attrs) {
        // eslint-disable-next-line no-restricted-syntax, guard-for-in
        for (const attr in attrs) {
          script.setAttribute(attr, attrs[attr]);
        }
      }
      script.onload = resolve;
      script.onerror = reject;
      document.head.append(script);
    } else {
      resolve();
    }
  });
}

/**
 * Returns a picture element with webp and fallbacks
 * @param {string} src The image URL
 * @param {string} [alt] The image alternative text
 * @param {boolean} [eager] Set loading attribute to eager
 * @param {Array} [breakpoints] Breakpoints and corresponding params (eg. width)
 * @returns {Element} The picture element
 */
function createOptimizedPicture(
  src,
  alt = '',
  eager = false,
  breakpoints = [{ media: '(min-width: 600px)', width: '2000' }, { width: '750' }],
) {
  const url = new URL(src, window.location.href);
  const picture = document.createElement('picture');
  const { pathname } = url;
  const ext = pathname.substring(pathname.lastIndexOf('.') + 1);

  // webp
  breakpoints.forEach((br) => {
    const source = document.createElement('source');
    if (br.media) source.setAttribute('media', br.media);
    source.setAttribute('type', 'image/webp');
    source.setAttribute('srcset', `${pathname}?width=${br.width}&format=webply&optimize=medium`);
    picture.appendChild(source);
  });

  // fallback
  breakpoints.forEach((br, i) => {
    if (i < breakpoints.length - 1) {
      const source = document.createElement('source');
      if (br.media) source.setAttribute('media', br.media);
      source.setAttribute('srcset', `${pathname}?width=${br.width}&format=${ext}&optimize=medium`);
      picture.appendChild(source);
    } else {
      const img = document.createElement('img');
      img.setAttribute('loading', eager ? 'eager' : 'lazy');
      img.setAttribute('alt', alt);
      picture.appendChild(img);
      img.setAttribute('src', `${pathname}?width=${br.width}&format=${ext}&optimize=medium`);
    }
  });

  return picture;
}

async function loadJsAndCss(pathFragment, block) {
  const cssLoaded = loadCSS(`${window.hlx.codeBasePath}/${pathFragment}.css`);
  const decorationComplete = new Promise((resolve, reject) => {
    (async () => {
      try {
        const mod = await import(
          `${window.hlx.codeBasePath}/${pathFragment}.js`
        );
        if (mod.default) {
          await mod.default(block);
        }
      } catch (error) {
        // eslint-disable-next-line no-console
        console.error(`failed to load module for ${pathFragment}`, error);
        reject(error);
      }
      resolve();
    })();
  });
  await Promise.all([cssLoaded, decorationComplete]);
}

/**
 * Set template (page structure) and theme (page styles).
 */
async function decorateTemplateAndTheme() {
  const addClasses = (element, classes) => {
    classes.split(',').forEach((c) => {
      element.classList.add(toClassName(c.trim()));
    });
  };
  const template = getMetadata('template')
    // search results auto template
    || (document.querySelector('main .search-results') && 'searchresults');
  if (template) {
    addClasses(document.body, template);
    try {
      await loadJsAndCss(`templates/${template}/${template}`);
    } catch (error) {
      // eslint-disable-next-line no-console
      console.error(`failed to load module for ${template}`, error);
    }
  }
  const theme = getMetadata('theme');
  if (theme) addClasses(document.body, theme);
}

/**
 * Wrap inline text content of block cells within a <p> tag.
 * @param {Element} block the block element
 */
function wrapTextNodes(block) {
  const validWrappers = [
    'P',
    'PRE',
    'UL',
    'OL',
    'PICTURE',
    'TABLE',
    'H1',
    'H2',
    'H3',
    'H4',
    'H5',
    'H6',
  ];

  const wrap = (el) => {
    const wrapper = document.createElement('p');
    wrapper.append(...el.childNodes);
    el.append(wrapper);
  };

  block.querySelectorAll(':scope > div > div').forEach((blockColumn) => {
    if (blockColumn.hasChildNodes()) {
      const hasWrapper = !!blockColumn.firstElementChild
        && validWrappers.some((tagName) => blockColumn.firstElementChild.tagName === tagName);
      if (!hasWrapper) {
        wrap(blockColumn);
      } else if (
        blockColumn.firstElementChild.tagName === 'PICTURE'
        && (blockColumn.children.length > 1 || !!blockColumn.textContent.trim())
      ) {
        wrap(blockColumn);
      }
    }
  });
}

/**
 * Decorates paragraphs containing a single link as buttons.
 * @param {Element} element container element
 */
function decorateButtons(element) {
  element.querySelectorAll('a').forEach((a) => {
    const title = (a.title || a.textContent)?.trim();

    if (title) {
      a.title = title;
    }

    if (a.href !== a.textContent) {
      const up = a.parentElement;
      const twoup = a.parentElement.parentElement;
      if (!a.querySelector('img')) {
        if (up.childNodes.length === 1 && (up.tagName === 'P' || up.tagName === 'DIV')) {
          a.className = 'agt-link'; // default
          if (a.closest('.text-inverse')) {
            a.classList.add('agt-link--light');
          }
          up.classList.add('button-container');
        }
        if (
          up.childNodes.length === 1
          && up.tagName === 'STRONG'
          && twoup.childNodes.length === 1
          && twoup.tagName === 'P'
        ) {
          a.className = 'agt-button agt-button--primary';
          twoup.classList.add('button-container');
        }
        if (
          up.childNodes.length === 1
          && up.tagName === 'EM'
          && twoup.childNodes.length === 1
          && twoup.tagName === 'P'
        ) {
          twoup.classList.add('button-container');
          if (a.closest('.text-inverse')) {
            a.className = 'agt-button agt-button--ghost-light';
          } else {
            a.className = 'agt-button agt-button--secondary';
          }
        }
      }
    }
  });
}

function findIconName(iconClassList) {
  return Array.from(iconClassList)
    .find((c) => c.startsWith('icon-'))
    .substring(5);
}

function loadIcon(iconName, prefix = '') {
  return fetch(`${window.hlx.codeBasePath}${prefix}/icons/${iconName}.svg`)
    .then((response) => {
      if (response.ok) {
        return response.text();
      }
      throw new Error(`Failed to load icon: ${iconName}`);
    }).catch((error) => {
      // eslint-disable-next-line no-console
      console.error('Error loading SVG icon:', error);
    });
}

/**
 * Add <img> for icon, prefixed with codeBasePath and optional prefix.
 * @param {Element} [span] span element with icon classes
 * @param {string} [prefix] prefix to be added to icon src
 * @param {string} [alt] alt text to be added to icon
 */
function decorateIcon(span, prefix = '', alt = '') {
  window.CACHE_ICONS = window.CACHE_ICONS || {};
  const iconName = findIconName(span.classList);
  if (!iconName.startsWith('label-')) {
    if (!window.CACHE_ICONS[iconName]) {
      window.CACHE_ICONS[iconName] = loadIcon(iconName, prefix);
    }
    window.CACHE_ICONS[iconName].then((iconContent) => {
      span.innerHTML = iconContent;
      const svg = span.querySelector('svg');
      if (svg) {
        svg.setAttribute('aria-hidden', 'true');
        if (alt) {
          svg.setAttribute('aria-label', alt);
          svg.removeAttribute('aria-hidden');
        }
      }
    });
  }
}

/**
 * Add <img> for icons, prefixed with codeBasePath and optional prefix.
 * @param {Element} [element] Element containing icons
 * @param {string} [prefix] prefix to be added to icon the src
 */
function decorateIcons(element, prefix = '') {
  const icons = element.querySelectorAll('span.icon');
  [...icons].forEach((span) => {
    decorateIcon(span, prefix);
  });
}

/**
 * Decorates all sections in a container element.
 * @param {Element} main The container element
 */
function decorateSections(main) {
  main.querySelectorAll(':scope > div').forEach((section) => {
    const wrappers = [];
    let defaultContent = false;
    [...section.children].forEach((e) => {
      if (e.tagName === 'DIV' || !defaultContent) {
        const wrapper = document.createElement('div');
        wrappers.push(wrapper);
        defaultContent = e.tagName !== 'DIV';
        if (defaultContent) wrapper.classList.add('default-content-wrapper');
      }
      wrappers[wrappers.length - 1].append(e);
    });
    wrappers.forEach((wrapper) => section.append(wrapper));
    section.classList.add('section');
    section.dataset.sectionStatus = 'initialized';
    section.style.display = 'none';

    // Process section metadata
    const sectionMeta = section.querySelector('div.section-metadata');
    if (sectionMeta) {
      const meta = readBlockConfig(sectionMeta);
      Object.keys(meta).forEach((key) => {
        if (key === 'style') {
          const styles = meta.style
            .split(',')
            .filter((style) => style)
            .map((style) => toClassName(style.trim()));
          styles.forEach((style) => section.classList.add(style));
        } else {
          section.dataset[key] = meta[key];
        }
      });
      sectionMeta.parentNode.remove();
    }
  });
}

const placeholderPromises = {};
const placeholdersArray = [];

async function fetchPlaceholders() {
  if (Object.keys(placeholderPromises).length === 0) {
    getLocale().fallbackPaths.forEach((path) => {
      if (placeholderPromises[path]) return;
      placeholderPromises[path] = new Promise((resolve) => {
        fetch(`/${path}/placeholders.json`).then((resp) => {
          if (resp.ok) {
            return resp.json();
          }
          // eslint-disable-next-line no-console
          console.warn(`Could not load placeholders from [${path}]`);
          return { data: [] };
        }).then((json) => {
          const placeholders = {};
          const dataSheet = (Array.isArray(json.data) ? json.data : json.data?.data) || [];
          dataSheet
            .filter((placeholder) => placeholder.Key)
            .forEach((placeholder) => {
              placeholders[placeholder.Key?.toLowerCase()] = placeholder.Text;
            });
          resolve(placeholders);
        }).catch((e) => {
          // eslint-disable-next-line no-console
          console.error(`Error while loading placeholders: [${e.message}]`, e);
          resolve({});
        });
      });
    });
  }

  const placeholdersValues = await Promise.allSettled(getLocale()
    .fallbackPaths.map(async (path) => placeholderPromises[path]));

  placeholdersValues.forEach((data) => {
    placeholdersArray.push({ ...data.value });
  });
}

function getPlaceholder(name, ...params) {
  for (const placeholder of placeholdersArray) {
    const value = placeholder[name?.toLowerCase()];
    if (value) {
      return value.replace(/\{\d+\}/g, (match) => {
        // Replace {0}, {1}, etc. with corresponding values from params
        const index = parseInt(match.slice(1, -1), 10);
        return params[index] || '';
      });
    }
  }
  return name;
}

function setCurrentPageCookie() {
  setCookie('currPageURL', window.location.href);
}

/**
 * Builds a block DOM Element from a two dimensional array, string, or object
 * @param {string} blockName name of the block
 * @param {*} content two dimensional array or string or object of content
 */
function buildBlock(blockName, content) {
  const table = Array.isArray(content) ? content : [[content]];
  const blockEl = document.createElement('div');
  // build image block nested div structure
  blockEl.classList.add(blockName);
  table.forEach((row) => {
    const rowEl = document.createElement('div');
    row.forEach((col) => {
      const colEl = document.createElement('div');
      const vals = col.elems ? col.elems : [col];
      vals.forEach((val) => {
        if (val) {
          if (typeof val === 'string') {
            colEl.innerHTML += val;
          } else {
            colEl.appendChild(val);
          }
        }
      });
      rowEl.appendChild(colEl);
    });
    blockEl.appendChild(rowEl);
  });
  return blockEl;
}

/**
 * Loads JS and CSS for a block.
 * @param {Element} block The block element
 */
async function loadBlock(block) {
  const status = block.dataset.blockStatus;
  if (status !== 'loading' && status !== 'loaded') {
    block.dataset.blockStatus = 'loading';
    const { blockName } = block.dataset;
    try {
      const separatorIndex = blockName.lastIndexOf('__');
      const filename = separatorIndex >= 0 ? blockName.slice(separatorIndex + 2) : blockName;
      await loadJsAndCss(`blocks/${blockName.replace(/__/g, '/')}/${filename}`, block);
    } catch (error) {
      // eslint-disable-next-line no-console
      console.error(`failed to load block ${blockName}`, error);
    }
    block.dataset.blockStatus = 'loaded';
  }
  return block;
}

/**
 * Decorates a block.
 * @param {Element} block The block element
 */
function decorateBlock(block, customHTML = false) {
  const shortBlockName = block.classList[0];
  if (shortBlockName) {
    block.classList.add('block');
    block.dataset.blockName = shortBlockName;
    block.dataset.blockStatus = 'initialized';
    if (!customHTML) {
      wrapTextNodes(block);
    }
    const blockWrapper = block.parentElement;
    blockWrapper.classList.add(`${shortBlockName}-wrapper`);
    const section = block.closest('.section');
    if (section) section.classList.add(`${shortBlockName}-container`);
  }
}

/**
 * Decorates all blocks in a container element.
 * @param {Element} main The container element
 */
function decorateBlocks(main) {
  main.querySelectorAll('div.section > div > div').forEach((block) => decorateBlock(block));
}

/**
 * Loads a block named 'header' into header
 * @param {Element} header header element
 * @returns {Promise}
 */
async function loadHeader(header) {
  const headerBlock = buildBlock('header', '');
  header.append(headerBlock);
  decorateBlock(headerBlock);
  return loadBlock(headerBlock);
}

/**
 * Loads a block named 'footer' into footer
 * @param footer footer element
 * @returns {Promise}
 */
async function loadFooter(footer) {
  const footerBlock = buildBlock('footer', '');
  footer.append(footerBlock);
  decorateBlock(footerBlock);
  return loadBlock(footerBlock);
}

/**
 * Wait for Image.
 * @param {Element} section section element
 */
async function waitForLCPMedia(section) {
  const lcpCandidates = section.querySelectorAll('.hero img, .hero video') || [section.querySelector('img, video')];
  [...lcpCandidates].map((lcpCandidate) => new Promise((resolve) => {
    if (lcpCandidate) {
      if (lcpCandidate.tagName === 'VIDEO') {
        lcpCandidate.addEventListener('loadeddata', resolve);
      } else if (!lcpCandidate.complete) {
        lcpCandidate.setAttribute('loading', 'eager');
        lcpCandidate.setAttribute('fetchpriority', 'high');
        lcpCandidate.addEventListener('load', resolve);
      }
      lcpCandidate.addEventListener('error', resolve);
    } else {
      resolve();
    }
  }));
}

/**
 * Loads all blocks in a section.
 * @param {Element} section The section element
 */
async function loadSection(section, loadCallback) {
  const status = section.dataset.sectionStatus;
  if (!status || status === 'initialized') {
    section.dataset.sectionStatus = 'loading';
    const blocks = [...section.querySelectorAll('div.block')];
    for (let i = 0; i < blocks.length; i += 1) {
      // eslint-disable-next-line no-await-in-loop
      await loadBlock(blocks[i]);
    }
    decorateIcons(section);
    if (loadCallback) await loadCallback(section);
    section.dataset.sectionStatus = 'loaded';
    section.style.display = null;
  }
}

/**
 * Loads all sections.
 * @param {Element} element The parent element of sections to load
 */
async function loadSections(element) {
  const sections = [...element.querySelectorAll('div.section')];
  for (let i = 0; i < sections.length; i += 1) {
    // eslint-disable-next-line no-await-in-loop
    await loadSection(sections[i]);
    if (i === 0 && sampleRUM.enhance) {
      sampleRUM.enhance();
    }
  }
}

function getLocaleAgnosticPath(path) {
  const pathTokens = path.split('/');
  // check if the link starts with a locale path segment
  if (pathTokens.length < 2 || !/^[a-z]{2}(?:-[a-z]{2})?$/.exec(pathTokens[1])) {
    return false;
  }

  // remove locale prefix and optionally trailing slash
  const localeAgnosticTokens = pathTokens.slice(2, pathTokens[pathTokens.length - 1] === '' ? -1 : undefined);
  if (localeAgnosticTokens.length === 0) {
    return {
      path: '',
      indexPath: '',
    };
  }

  const localeAgnosticPath = `/${localeAgnosticTokens.join('/')}`;
  return {
    path: localeAgnosticPath,
    indexPath: localeAgnosticPath.endsWith('.plain.html') ? localeAgnosticPath.slice(0, -11) : localeAgnosticPath,
  };
}

async function getLinkFallback(link) {
  const defaultResult = {
    link,
    rewrite: false,
  };

  if (!link || isEDS()) {
    return defaultResult;
  }

  const originalUrl = new URL(link, `${window.location.origin}${window.location.pathname}`);

  // handle only html links
  // check if the link points to the domain of our site
  // check if the filename contains an extension
  if (originalUrl.origin !== window.location.origin || (!originalUrl.pathname.endsWith('.plain.html') && originalUrl.pathname.split('/').pop().includes('.'))) {
    return defaultResult;
  }

  // remove trailing slash
  if (isCDN() && originalUrl.pathname.endsWith('/')) {
    defaultResult.originalUrl = originalUrl;
    defaultResult.link = `${originalUrl.pathname.slice(0, -1)}${originalUrl.search}${originalUrl.hash}`;
    defaultResult.rewrite = true;
  }

  const index = await fetchIndex();
  // check if the link points to the current locale and exists in the index
  if (originalUrl.pathname.startsWith(`/${getLocale().rootPath}`) && (index[originalUrl.pathname] || index[`${originalUrl.pathname}/`])) {
    return defaultResult;
  }

  const localeAgnosticPath = getLocaleAgnosticPath(originalUrl.pathname);
  // check if the link starts with a locale path segment
  if (!localeAgnosticPath) {
    return defaultResult;
  }

  // find the first (= best matching) locale path which exists in the index
  const rewriteLocale = getLocale().fallbackPaths.find((fallbackLocale) => {
    const localePath = `/${fallbackLocale}${localeAgnosticPath.indexPath}`;
    return index[localePath] || index[`${localePath}/`];
  });

  if (!rewriteLocale) {
    return {
      ...defaultResult,
      notFound: true,
    };
  }

  const rewritePath = `/${rewriteLocale}${localeAgnosticPath.path}`;
  if (rewritePath === originalUrl.pathname
    || (!isCDN() && rewritePath === originalUrl.pathname.slice(0, -1))) {
    return defaultResult;
  }

  return {
    originalUrl,
    link: `${rewritePath}${originalUrl.search}${originalUrl.hash}`,
    rewrite: true,
  };
}

/**
 * @param {string} [localeAgnosticPath=''] Optional. Appended to the locale root path.
 * @param {boolean} [checkExists=true] Optional. If true, applies the fallback logic to the path.
 * @return {Promise<string>} The locale-aware path.
 */
async function getPath(localeAgnosticPath = '', checkExists = true) {
  const path = `/${getLocale().rootPath}${localeAgnosticPath}`;
  if (checkExists) {
    const fallback = await getLinkFallback(path);
    if (fallback.rewrite) {
      return fallback.link;
    }
  }
  return path;
}

let configPromise;
async function loadEnvConfig() {
  if (configPromise) {
    return configPromise;
  }

  const fetchPromise = window.sirius?.loading?.envConfigPromise ?? fetch('/.env/config.json');

  configPromise = fetchPromise.then((response) => {
    if (!response.ok) {
      throw new Error('Failed to load config');
    }
    return response.json();
  }).then((data) => {
    if (data[':type'] === 'multi-sheet') { // handle multisheet
      return data[':names'].reduce((acc, name) => {
        const obj = data[name].data.reduce((configData, item) => {
          if (item.Key && item.Text) {
            configData[item.Key] = item.Text;
          }
          return configData;
        }, {});
        if (name === 'data'
          || name.toLowerCase() === getLocale().rootPath
          || name.toUpperCase() === getLocale().country
          || name.toLowerCase() === window.location.host.toLowerCase()) {
          return { ...acc, ...obj };
        }
        return {
          ...acc,
          [name]: obj,
        };
      }, {});
    } // handle single sheet as fallback.
    return data.data.reduce((config, item) => {
      if (item.Key && item.Text) {
        config[item.Key] = item.Text;
      }
      return config;
    }, {});
  });
  return configPromise;
}

const countryInfoPromises = {};
async function getCountryInfo(country = getLocale().country) {
  const countryInfo = async () => {
    const config = await loadEnvConfig();
    const countryInfoUrl = new URL(`${config.countryInfo || '/services/countryinfo'}`, window.location.origin);
    if (countryInfoUrl.origin !== window.location.origin || getLocale().country !== country) {
      countryInfoUrl.searchParams.set('country', country);
    }
    const response = await fetch(countryInfoUrl.toString());
    if (!response.ok) {
      throw new Error('Failed to load country info');
    }
    return response.json();
  };

  if (countryInfoPromises[country]) {
    return countryInfoPromises[country];
  }

  countryInfoPromises[country] = countryInfo();
  return countryInfoPromises[country];
}

async function callAgSessionMe(method = 'GET', body = false) {
  const config = await loadEnvConfig();
  const headers = {};
  if (method === 'POST') {
    headers['Content-Type'] = 'application/json';
  }
  const response = await fetch(config.agSessionMeEndpoint || '/account/api/v1/agsessionme', {
    method,
    headers,
    credentials: 'include',
    body: body ? JSON.stringify(body) : null,
  });
  if (!response.ok) {
    throw new Error('Failed to call agsessionme');
  }
  return response.json();
}

const loginPath = '/sso/authorize';
const logoutPath = '/sso/logout';
const userInfoPath = '/sso/userinfo';

function login(refresh = false) {
  window.location.href = `${loginPath}${refresh ? '?refresh' : ''}`;
}

function registration() {
  window.location.href = `${loginPath}?register`;
}

function refreshToken() {
  const oldExpiration = Number(getCookie('sso_expiration'));
  const iframe = document.createElement('iframe');
  iframe.style.display = 'none';
  iframe.src = `${loginPath}?tokenRefresh`;
  iframe.addEventListener('load', () => {
    // eslint-disable-next-line no-use-before-define
    setTokenExpirationCounter();
    const expiration = Number(getCookie('sso_expiration'));
    console.warn(`Token session extended by ${expiration - oldExpiration}`);
  });
  document.body.append(iframe);
}

function logout() {
  localStorage.removeItem('userName');
  localStorage.removeItem('customerType');
  localStorage.removeItem('groups');
  localStorage.removeItem('userObj');
  window.location.href = logoutPath;
}

function isLoggedIn() {
  return getCookie('loginFlag') === 'true';
}

function getUserInfo() {
  if (!isLoggedIn()) {
    return false;
  }
  return {
    name: localStorage.getItem('userName'),
    customerType: localStorage.getItem('customerType'),
    groups: localStorage.getItem('groups'),
  };
}
const beforeAutoLogout = 300;
const beforeSSOTimeout = 120; // 2 minutes before SSO timeout
let ssoTimeoutId;
let currentIdleTimerId;

function setTokenExpirationCounter() {
  try {
    const expiration = Number(getCookie('sso_expiration')); // expiration timestamp in seconds
    const now = Math.floor(Date.now() / 1000); // current time in seconds
    ssoTimeoutId = setTimeout(() => {
      try {
        refreshToken();
      } catch (error) {
        // eslint-disable-next-line no-console
        console.error('Failed refresh token', error);
        logout();
      }
    }, (expiration - now - beforeSSOTimeout) * 1000); // 5 min before sso timeout
  } catch (error) {
    // eslint-disable-next-line no-console
    console.error('Failed to check token timeout', error);
    logout();
  }
}

function startSSOTimers(status) {
  // SSO timeout
  if (!ssoTimeoutId) {
    setTokenExpirationCounter();
  }

  // Idle session timer
  if (currentIdleTimerId) {
    clearTimeout(currentIdleTimerId);
  }
  currentIdleTimerId = setTimeout(async () => {
    try {
      const dialog = document.createElement('dialog');
      const idleStatus = await callAgSessionMe();
      if (idleStatus.agsessionme !== 'true') {
        // eslint-disable-next-line no-console
        console.error('Failed to update idle session. Invalid state.', idleStatus);
        logout();
      }
      // check if TTL got refreshed from parallel browsed pages.
      if (idleStatus.TTL <= beforeAutoLogout) {
        const logoutTimerId = setTimeout(async () => {
          const beforeLogoutStatus = await callAgSessionMe();
          if (beforeLogoutStatus.agsessionme !== 'true' || beforeLogoutStatus.TTL <= beforeAutoLogout) {
            logout();
          } else {
            dialog.remove();
            // restart timer
            startSSOTimers(idleStatus);
          }
        }, (idleStatus.TTL - 1) * 1000);
        dialog.classList.add('session-expiration-dialog');
        dialog.innerHTML = '<div class="idle-timer"></div>';
        const idleTimerBlock = dialog.querySelector('.idle-timer');
        decorateBlock(idleTimerBlock);
        await loadBlock(idleTimerBlock);
        document.body.appendChild(dialog);
        dialog.showModal();
        idleTimerBlock.startTimer(logoutTimerId, beforeAutoLogout);
      } else {
        // restart timer
        startSSOTimers(idleStatus);
      }
    } catch (error) {
      // eslint-disable-next-line no-console
      console.error('Failed to check idle session', error);
      logout();
    }
  }, (status.TTL - beforeAutoLogout) * 1000);
}

async function refreshSSOSession() {
  const status = await callAgSessionMe('POST', {
    action: 'checkping',
  });
  if (status?.agsessionme !== 'true') {
    throw new Error('Failed to update SSO session.');
  }
  startSSOTimers(status);
  return status;
}

/**
 * Same as refreshSSOSession, but handles errors and returns a boolean instead of failing.
 *
 * @returns {Promise<boolean>} true if SSO session was refreshed successfully, false otherwise
 */
async function refreshSSO() {
  try {
    await refreshSSOSession();
    return true;
  } catch (error) {
    // eslint-disable-next-line no-console
    console.error('Failed to refresh SSO', error);
    return false;
  }
}

async function createSSOSession() {
  const userInfoResponse = await fetch(`${userInfoPath}?token`);
  if (!userInfoResponse.ok) {
    throw new Error('Failed to get user info');
  }
  // adding all the keys in userObj - to be done
  const userInfo = await userInfoResponse.json();
  localStorage.setItem('userName', userInfo.name);
  localStorage.setItem('customerType', userInfo.customerType);
  localStorage.setItem('groups', userInfo.groups);
  const userObj = {
    firstName: userInfo.firstName,
    lastName: userInfo.lastName,
    userId: userInfo.userId,
    email: userInfo.email,
    eCommerceStatus: userInfo.eCommerceStatus,
    defaultSoldTo: userInfo.defaultSoldTo,
    encSoldTo: userInfo.encryptedSoldTo,
    provisionApps: [],
    SHR: false,
    SMR: false,
  };

  if (userInfo.groups?.includes('MyAgilent')) {
    userObj.provisionApps.push('MYA');
  }

  if (Array.isArray(userInfo.roles)) {
    if (userInfo.roles.includes('pps:true')) {
      userObj.provisionApps.push('PPS');
    }

    if (userInfo.roles.includes('service:true')) {
      userObj.SHR = true;
    }

    if (userInfo.roles.includes('service-master:true')) {
      userObj.SMR = true;
    }
  }

  localStorage.setItem('userObj', JSON.stringify(userObj));

  const createStatus = await callAgSessionMe('POST', {
    action: 'create',
  });
  if (createStatus.created !== true) {
    throw new Error('Failed to create SSO session.');
  }
  const newStatus = await callAgSessionMe();
  if (newStatus?.agsessionme !== 'true') {
    throw new Error('Failed to create SSO session. Invalid state.');
  }
  startSSOTimers(newStatus);
  // wrap user login status in delayed event for analytics purpose.
  window.addEventListener('load:Delayed', () => {
    window.dispatchEvent(new CustomEvent('user:Login', { detail: userInfoResponse }));
  });
}

let initializingSSO = false;

let logoutCheckDelay = 15000; // first check after 15 seconds
function ssoLogoutCheck() {
  const delay = logoutCheckDelay;
  logoutCheckDelay = 5000; // subsequent checks every 5 seconds
  setTimeout(async () => {
    initializingSSO = false;
    // eslint-disable-next-line no-use-before-define
    checkSSO(true);
  }, delay);
}

async function checkSSO(skipRefresh = false) {
  try {
    if (!isCDN() || initializingSSO) {
      return;
    }
    const status = await callAgSessionMe();
    if (status?.agsessionme !== 'true') {
      // no active SSO session we need to clean up our state
      if (isLoggedIn() || getCookie('sso_expiration')) {
        // eslint-disable-next-line no-console
        console.error('Invalid login state.');
        logout();
      }
      return;
    }
    if (status.TTL < 0) {
      login(true);
    } else if (status.TTL >= 0 && !skipRefresh) {
      await refreshSSOSession();
    }
    ssoLogoutCheck();
  } catch (error) {
    // eslint-disable-next-line no-console
    console.error('Failed to check SSO', error);
    logout();
  }
}

async function initSSO() {
  const url = new URL(window.location.href);
  try {
    if (!isCDN()) {
      return;
    }
    if (url.searchParams.get('sso') === 'success') {
      initializingSSO = true;
      url.searchParams.delete('sso');
      window.history.replaceState(window.history.state, '', url.toString());
      await createSSOSession();
      ssoLogoutCheck();
    }
    // check if user logged in but our session is not started yet
    if (isLoggedIn() && !getCookie('sso_expiration')) {
      await checkSSO();
      login(true);
    }
  } catch (error) {
    // eslint-disable-next-line no-console
    console.error('Failed to initialize SSO', error);
    logout();
  }
}

/**
 * Creates a new HTML element from a string of HTML
 * @param {TemplateStringsArray} strings - The string parts of the HTML template
 * @param {...(string | HTMLElement)} values - The dynamic values to be inserted into the template
 * @returns {HTMLElement} - The HTML element created from the string
 * @example
 * html`<div class="my-class">Hello, world!</div>`
 * @example
 * html`<div class="my-class">${myVariable}</div>`
 * @example
 * html`<div class="my-class">${html`<span>Inner HTML</span>`}</div>`
 * @example
 * html`<div class="my-class">${someHTMLElement}</div>`
 * @example
 * html`<div class="my-class">${someHTMLElementsArray}</div>`
 */
function html(strings, ...values) {
  const template = document.createElement('template');
  template.innerHTML = strings.reduce((acc, str, i) => {
    if (
      values[i] instanceof HTMLElement
      || values[i] instanceof Array
      || values[i] instanceof NodeList
    ) {
      return `${acc}${str}<template data-html-id="value-${i}"></template>`;
    }

    return acc + str + (values[i] ?? '');
  }, '');

  template.content.querySelectorAll('[data-html-id]').forEach((el) => {
    const numberFromID = el.dataset.htmlId.split('-')[1];

    if (values[numberFromID] instanceof Array || values[numberFromID] instanceof NodeList) {
      el.replaceWith(...values[numberFromID]);
      return;
    }

    if (values[numberFromID] instanceof HTMLElement) {
      el.replaceWith(values[numberFromID]);
      return;
    }

    // eslint-disable-next-line no-console
    console.error('Case not handled for', el);
  });

  const { children } = template.content;

  return children.length === 1 ? children[0] : children;
}

function pushToDataLayer(eventData) {
  if (!window.adobeDataLayer) {
    window.adobeDataLayer = [];
  }
  window.adobeDataLayer.push(eventData);
}

/**
 * Forces a reflow of an element.
 * @param {Element} el The element to reflow
 */
function forceCssReflow(el) {
  // eslint-disable-next-line no-unused-expressions
  el.offsetHeight;
}

/**
 * Remembers the place of an element in the DOM
 * This function replaces the element with a placeholder
 * and returns a function to restore the element later.
 * @param {HTMLElement} element - The element to remember
 * @example
 * const restoreElement = rememberPlace(document.querySelector('.my-element'));
 * // Later, you can restore the element with:
 * restoreElement();
 */
function rememberPlace(element) {
  const placeholderEl = html`<span class="hidden"></span>`;

  element.replaceWith(placeholderEl);

  return () => {
    placeholderEl.replaceWith(element);
  };
}

/**
 * @param {Object} [config]
 * @param {string} [config.prefix]
 * @param {string} [config.suffix]
 * @param {string} [config.delimiter='-']
 * @returns {string}
 */
function generateId({ prefix = '', delimiter = '-' } = {}) {
  return (
    [prefix, Date.now().toString(36) + Math.random().toString(36).slice(2)]
      .filter(Boolean)
      .join(delimiter)
  );
}

function decorateLabel(rootEl) {
  const labelsData = {
    'ce-ivd': {
      title: getPlaceholder('Conformité Européenne In Vitro Diagnostic'),
      value: getPlaceholder('CE-IVD'),
      class: 'icon-label-ce-ivd',
    },
    ruo: {
      title: getPlaceholder('Research Use Only'),
      value: getPlaceholder('RUO'),
      class: 'icon-label-ruo',
    },
    ivd: {
      title: getPlaceholder('In Vitro Diagnostic'),
      value: getPlaceholder('IVD'),
      class: 'icon-label-ivd',
    },
    asr: {
      title: getPlaceholder('Analyte Specific Reagent'),
      value: getPlaceholder('ASR'),
      class: 'icon-label-asr',
    },
    ffu: {
      title: getPlaceholder('For Forensic Use'),
      value: getPlaceholder('FFU'),
      class: 'icon-label-ffu',
    },
    eua: {
      title: getPlaceholder('Emergency Use Authorization'),
      value: getPlaceholder('EUA'),
      class: 'icon-label-eua',
    },
    eco: {
      title: getPlaceholder('Eco leaf'),
      class: 'icon icon-leaf icon-label-eco',
    },
  };

  const labels = [...rootEl.querySelectorAll('span.icon[class*="icon-label-"]')];

  labels.forEach((label) => {
    const iconClass = [...label.classList].find((className) => className.startsWith('icon-label-'));
    const labelKey = iconClass.split('icon-label-')[1];
    const labelData = labelsData[labelKey];
    const useLightTheme = [...label.classList].some((className) => className.endsWith('--light'));

    const labelHTML = html`
      <span class="${labelData ? labelData.class : ''} icon-label ${useLightTheme ? `icon-label-${labelKey}--light` : ''}" title="${labelData ? labelData.title : ''}" aria-label="${labelData ? labelData.title : ''}">
        ${labelData ? labelData.value : ''}
      </span>
    `;

    label.replaceWith(labelHTML);
    decorateIcons(labelHTML.parentElement);
  });
}

/**
 * Decorates responsive media lists.
 * Looks for ul elements with up to 3 li children,
 * each containing either a picture or video element.
 * Transforms such lists into a responsive media block
 * with desktop, tablet, and mobile sections.
 * @param {Element} rootEl The root element to search within
 * @example
 * <ul>
 *   <li><video>...</video></li> <!-- Desktop -->
 *   <li><picture>...</picture></li> <!-- Tablet -->
 *   <li><picture>...</picture></li> <!-- Mobile -->
 * </ul>
 *
 */
function decorateResponsiveMedia(rootEl) {
  rootEl.querySelectorAll('ul').forEach((list) => {
    const listItems = list.querySelectorAll('li');
    const mediaOnlyList = Array.from(listItems).every((li) => {
      const children = Array.from(li.children);

      return children.every((child) => child.tagName === 'PICTURE' || child.tagName === 'VIDEO');
    });

    if (list.length > 3 || !mediaOnlyList) {
      return;
    }

    const desktopMedia = list.children[0]?.children[0];
    const tabletMedia = list.children[1]?.children[0] || desktopMedia;
    const mobileMedia = list.children[2]?.children[0] || tabletMedia;

    const responsiveMedia = html`
      <div class="responsive-media">
        <div class="responsive-media__desktop">
          ${desktopMedia}
        </div>
        <div class="responsive-media__tablet">
          ${tabletMedia}
        </div>
        <div class="responsive-media__mobile">
          ${mobileMedia}
        </div>
      </div>
    `;

    list.replaceWith(responsiveMedia);
  });
}

async function decorateTooltips(rootEl) {
  const createTootltip = (toolTipText, targetEl, focusTarget) => import('./lib-js/tooltip.js').then((module) => {
    const tooltipId = generateId('tooltip');
    const tooltipEl = html`
        <div class="agt-tooltip" id="${tooltipId}" role="tooltip">
          <div class="agt-tooltip__arrow-background agt-tooltip__arrow-background--auto"></div>
          <span class="agt-tooltip__arrow agt-tooltip__arrow--edge-auto agt-tooltip__arrow--position-auto"></span>
          <div class="agt-tooltip__text">
            ${toolTipText}
          </div>
        </div>
      `;

    targetEl.setAttribute('aria-describedby', tooltipId);
    targetEl.insertAdjacentElement('afterend', tooltipEl);
    module.default(tooltipEl, { focusTarget });
  });

  const promises = [...rootEl.querySelectorAll('[data-tooltip-text]')].map(async (el) => {
    const toolTipText = el.dataset.tooltipText;
    const focusTarget = document.querySelector(`#${el.dataset.tooltipFocusTarget}`) || el;

    if (toolTipText) {
      await createTootltip(toolTipText, el, focusTarget);
    }
  });

  return Promise.allSettled(promises);
}

function extractCurrencyToken(str) {
  if (str == null) return null;
  const input = (typeof str === 'string') ? str : String(str);
  const symMatch = input.match(/\p{Sc}/u);
  if (symMatch) return symMatch[0];
  const KNOWN_CODES = new Set([
    'USD', 'EUR', 'GBP', 'CHF', 'CAD', 'AUD', 'NZD', 'JPY', 'CNY', 'RMB', 'HKD', 'SGD', 'INR', 'SEK', 'NOK', 'DKK',
    'PLN', 'CZK', 'HUF', 'RON', 'BGN', 'MXN', 'BRL', 'ARS', 'CLP', 'COP', 'PEN', 'ZAR', 'TRY', 'ILS', 'AED', 'SAR',
    'KWD', 'QAR', 'TWD', 'THB', 'VND', 'KRW', 'PHP', 'IDR', 'MYR', 'RUB', 'UAH', 'NGN', 'GHS', 'KES',
  ]);
  const codeMatches = input.toUpperCase().match(/\b[A-Z]{2,4}\b/g);
  if (codeMatches) {
    for (const code of codeMatches) {
      if (KNOWN_CODES.has(code)) return code;
    }
  }
  return null;
}

let lastInteractionWasKeyboard = false;
function initGlobalInputFocusHandling() {
  document.addEventListener('keydown', (e) => {
    lastInteractionWasKeyboard = e.key === 'Tab';
  });

  document.addEventListener('mousedown', () => {
    lastInteractionWasKeyboard = false;
  });

  document.addEventListener('focusin', (e) => {
    const element = e.target;
    if (element.classList?.contains('agt-input') || element.classList?.contains('filters__accordion-summary')) {
      element.classList.toggle('mouse-focus', !lastInteractionWasKeyboard);
    }
  });
}

function parseCurrency(inputCurrency) {
  const input = (typeof inputCurrency === 'string')
    ? inputCurrency
    : String(inputCurrency ?? '');
  const currency = extractCurrencyToken(input);
  const sRaw = input
    .replace(/[\u00A0\u2000-\u200A\u202F\u205F\u3000\s]/g, '')
    .replace(/[^\d.,'()-]/g, '');
  const isNegative = /-\d|^\(|\)$/.test(sRaw);
  const s = sRaw.replace(/[()-]/g, '');
  if (/,-?$/.test(sRaw)) {
    const integer = (isNegative ? '-' : '') + s.replace(/,-?$/, '').replace(/\./g, '');
    return {
      style: 'EU', cents: '00', integer: integer || (isNegative ? '-0' : '0'), currency,
    };
  }
  const lastDot = s.lastIndexOf('.');
  const lastComma = s.lastIndexOf(',');
  const lastSep = Math.max(lastDot, lastComma);
  const hasApos = s.includes("'");
  const isTwoDigitDecimalAt = (idx) => idx > -1 && /^\d{2}$/.test(s.slice(idx + 1));
  const digitsOnly = (str) => (str.match(/\d+/g) || []).join('') || '0';
  let style = 'unknown';
  let cents = '00';
  let integer = (isNegative ? '-' : '') + digitsOnly(s);
  if (hasApos && lastDot > -1 && isTwoDigitDecimalAt(lastDot)) {
    style = 'CH';
    cents = s.slice(lastDot + 1);
    const intPart = s.slice(0, lastDot).replace(/'/g, '');
    integer = (isNegative ? '-' : '') + digitsOnly(intPart);
    return {
      style, cents, integer, currency,
    };
  }
  if (hasApos && lastDot === -1 && lastComma === -1) {
    style = 'CH';
    cents = '00';
    integer = (isNegative ? '-' : '') + digitsOnly(s.replace(/'/g, ''));
    return {
      style, cents, integer, currency,
    };
  }
  if (lastDot !== -1 && lastComma !== -1) {
    if (lastSep === lastDot && isTwoDigitDecimalAt(lastDot)) {
      style = hasApos ? 'CH' : 'US';
      cents = s.slice(lastDot + 1);
      const intPart = s.slice(0, lastDot).replace(/[,']/g, '');
      integer = (isNegative ? '-' : '') + digitsOnly(intPart);
      return {
        style, cents, integer, currency,
      };
    }
    if (lastSep === lastComma && isTwoDigitDecimalAt(lastComma)) {
      style = 'EU';
      cents = s.slice(lastComma + 1);
      const intPart = s.slice(0, lastComma).replace(/[.']/g, '');
      integer = (isNegative ? '-' : '') + digitsOnly(intPart);
      return {
        style, cents, integer, currency,
      };
    }
  }
  if (lastDot > -1 && lastComma === -1) {
    if (isTwoDigitDecimalAt(lastDot)) {
      style = 'US';
      cents = s.slice(lastDot + 1);
      const intPart = s.slice(0, lastDot).replace(/[,']/g, '');
      integer = (isNegative ? '-' : '') + digitsOnly(intPart);
      return {
        style, cents, integer, currency,
      };
    }
    style = hasApos ? 'CH' : 'unknown';
    cents = '00';
    integer = (isNegative ? '-' : '') + digitsOnly(s.replace(/[.'"]/g, ''));
    return {
      style, cents, integer, currency,
    };
  }
  if (lastComma > -1 && lastDot === -1) {
    if (isTwoDigitDecimalAt(lastComma)) {
      style = 'EU';
      cents = s.slice(lastComma + 1);
      const intPart = s.slice(0, lastComma).replace(/[.'"]/g, '');
      integer = (isNegative ? '-' : '') + digitsOnly(intPart);
      return {
        style, cents, integer, currency,
      };
    }
    style = 'unknown';
    cents = '00';
    integer = (isNegative ? '-' : '') + digitsOnly(s.replace(/[,'"]/g, ''));
    return {
      style, cents, integer, currency,
    };
  }
  return {
    style, cents, integer, currency,
  };
}

const getCurrencyCents = (s) => parseCurrency(s).cents;
const getCurrencyInteger = (s) => parseCurrency(s).integer;
const getCurrencyToken = (s) => parseCurrency(s).currency;

/**
 * Auto initialization.
 */
function init() {
  setup();
  sampleRUM.collectBaseURL = window.origin;
  sampleRUM();
  loadEnvConfig();
  getCountryInfo();
  fetchIndex();
  fetchPlaceholders();
  initGlobalInputFocusHandling();
  setCurrentPageCookie();
  const newLocale = new URLSearchParams(window.location.search).get('set-locale');
  if (newLocale) {
    setLocale(newLocale.substring(0, 2), newLocale.substring(3, 5));
  }
}

async function prepareGetAssetPath() {
  if (isCDN()) return (path) => path;
  const config = await loadEnvConfig();
  return (path) => `${config.assetHost || ''}${path}`;
}

function addImageErrorHandler(imgElement, fallbackImage = null) {
  if (!imgElement || imgElement.tagName !== 'IMG') {
    return;
  }

  imgElement.onerror = () => {
    imgElement.onerror = null;

    if (fallbackImage?.src) {
      imgElement.src = fallbackImage.src;
      imgElement.alt = fallbackImage.altText || '';
    } else {
      imgElement.style.display = 'none';
    }
  };
}

const isExternalURL = (url) => {
  try {
    const u = new URL(url, window.location.href);
    return u.origin !== window.location.origin;
  } catch {
    return false;
  }
};

function debounce(func, delay) {
  let timeout;
  return function (...args) {
    clearTimeout(timeout);
    timeout = setTimeout(() => func.apply(this, args), delay);
  };
}

function setBlockToFullViewportWidth(block) {
  block.parentElement.classList.add('full-width');
}

function setBlockToOverflowViewportWidth(block, config) {
  const viewports = config.viewports || ['mobile', 'tablet', 'desktop'];

  viewports.forEach((vp) => {
    block.parentElement.classList.add(`overflow-container--${vp}`);
  });
}

/**
 * Preserves focus on an element within rootEl.
 * Returns a function that restores focus to the previously focused element.
 *
 * The function should be used when the DOM is updated and focus needs to be restored.
 * example:
 * ```
 * const restoreFocus = preserveFocus(rootEl);
 * // update DOM - i.e. load new content
 * restoreFocus(); // restores focus to the previously focused element if it still exists
 * ```
 * The focus target needs to have either a name and value attribute,
 * or data-name and data-value attributes on a parent element,
 *
 * @param {Element} rootEl The root element containing the focused element
 * @returns {Function} A function that restores focus to the previously focused element
 */
function preserveFocus(rootEl) {
  const focusedElement = document.activeElement;
  let focusElSelector = '';

  if (focusedElement && focusedElement.name) {
    const nameAttr = focusedElement.name;
    const valueAttr = focusedElement.value;

    focusElSelector = `[name="${nameAttr}"][value="${valueAttr}"]`;
  } else if (focusedElement) {
    const nameAttr = focusedElement.closest('[data-name]')?.getAttribute('data-name');
    const valueAttr = focusedElement.closest('[data-value]')?.getAttribute('data-value');

    if (nameAttr && valueAttr) {
      focusElSelector = `[data-name="${nameAttr}"][data-value="${valueAttr}"] button`;
    }
  }

  return () => {
    if (focusElSelector) {
      const focusTarget = rootEl.querySelector(focusElSelector);

      focusTarget?.focus();
    }
  };
}

async function handleMyaAnchors(document) {
  const config = await loadEnvConfig();
  const countryCode = getLocale().country;

  document.querySelectorAll('a').forEach((anchor) => {
    if (config && config.myaHost && anchor.href.startsWith('/hub')) {
      anchor.href = config.myaHost + anchor.href;
    }
    if (countryCode && countryCode.toLowerCase() === 'cn' && anchor.href.includes(`${config.myaHost}/`)) {
      anchor.href = anchor.href.replace(`${config.myaHost}/`, `${config.myaHost}.cn/`);
    }
  });
}

export {
  init,
  buildBlock,
  createOptimizedPicture,
  debounce,
  decorateBlock,
  decorateBlocks,
  decorateButtons,
  decorateIcon,
  decorateIcons,
  decorateSections,
  decorateTemplateAndTheme,
  decorateTooltips,
  getPlaceholder,
  getMetadata,
  loadBlock,
  loadCSS,
  loadIcon,
  loadFooter,
  loadHeader,
  loadScript,
  loadSection,
  loadSections,
  preserveFocus,
  readBlockConfig,
  sampleRUM,
  setBlockToOverflowViewportWidth,
  setup,
  setBlockToFullViewportWidth,
  toCamelCase,
  toClassName,
  waitForLCPMedia,
  wrapTextNodes,
  getPath,
  getLinkFallback,
  getLocale,
  setLanguage,
  getLocaleAgnosticPath,
  isCDN,
  fetchIndex,
  loadEnvConfig,
  initSSO,
  checkSSO,
  refreshSSO,
  login,
  registration,
  logout,
  refreshSSOSession,
  isLoggedIn,
  getUserInfo,
  getCookie,
  setCookie,
  html,
  pushToDataLayer,
  forceCssReflow,
  rememberPlace,
  generateId,
  decorateResponsiveMedia,
  decorateLabel,
  parseCurrency,
  getCurrencyToken,
  getCurrencyInteger,
  getCurrencyCents,
  prepareGetAssetPath,
  addImageErrorHandler,
  isExternalURL,
  getCountryInfo,
  handleMyaAnchors,
};
