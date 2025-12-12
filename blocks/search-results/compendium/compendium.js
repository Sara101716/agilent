/* eslint-disable max-len */
import {
  html, getPlaceholder, isCDN, parseCurrency, loadEnvConfig, getLocale,
} from '../../../scripts/aem.js';
import { stripHtml } from '../../../scripts/coveo/utils.js';
import { fetchProductInventory, postAddtoCart } from '../../../scripts/services/atg.api.js';
import { trackAddToCartEvent } from '../../add-to-cart/add-to-cart.analytics.js';

const panelCleanupMap = new WeakMap();
function getFocusableIn(container) {
  const candidates = container.querySelectorAll(
    'a[href], area[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])',
  );
  return Array.from(candidates).filter((el) => {
    const style = window.getComputedStyle(el);
    return (
      el.offsetParent !== null
      && style.visibility !== 'hidden'
      && style.display !== 'none'
      && !el.hasAttribute('hidden')
      && el.getAttribute('aria-hidden') !== 'true'
    );
  });
}

function setPanelCleanup(panelEl, cleanupFn) {
  const prev = panelCleanupMap.get(panelEl);
  if (typeof prev === 'function') prev();
  if (typeof cleanupFn === 'function') {
    panelCleanupMap.set(panelEl, cleanupFn);
  } else {
    panelCleanupMap.delete(panelEl);
  }
}

function wirePanelTabCycle(panelEl, currentCtrlBtn) {
  const focusables = () => getFocusableIn(panelEl);

  const collapseToControl = () => {
    panelEl.setAttribute('data-open', 'false');
    panelEl.hidden = true;
    setPanelCleanup(panelEl, null);
    currentCtrlBtn.setAttribute('aria-expanded', 'false');
    currentCtrlBtn.focus();
  };

  const onKeyDown = (e) => {
    if (e.key !== 'Tab') return;

    const els = focusables();
    if (els.length === 0) {
      e.preventDefault();
      collapseToControl();
      return;
    }

    const first = els[0];
    const last = els[els.length - 1];

    if (e.shiftKey && document.activeElement === first) {
      e.preventDefault();
      collapseToControl();
      return;
    }

    if (!e.shiftKey && document.activeElement === last) {
      e.preventDefault();
      collapseToControl();
    }
  };

  panelEl.addEventListener('keydown', onKeyDown);
  setPanelCleanup(panelEl, () => panelEl.removeEventListener('keydown', onKeyDown));
}

function loadFormEvents(cardEl) {
  const form = cardEl.querySelector('.products-form');

  if (form) {
    const selects = form.querySelectorAll('select[data-sku]');
    const addBtn = form.querySelector('.products-cta .agt-button');

    const refreshCTA = () => {
      if (addBtn) {
        addBtn.textContent = `${getPlaceholder('Add to Cart')}`;
      }
    };

    addBtn.addEventListener('click', (e) => {
      e.preventDefault();

      const isMobile = window.matchMedia('(max-width: 768px)').matches;

      selects.forEach(async (selectEl) => {
        const isDesktopSelect = !selectEl.id.endsWith('-m');
        const isMobileSelect = selectEl.id.endsWith('-m');

        if ((isMobile && isMobileSelect) || (!isMobile && isDesktopSelect)) {
          const partNumber = selectEl?.dataset.sku;
          const quantity = Number(selectEl.value);
          const action = 'add';
          const block = selectEl.closest('.block');
          const data = {
            partNumber, quantity, block, action,
          };
          try {
            const cartResponse = await postAddtoCart(partNumber, quantity, action);

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
                const alertEl = cardEl.querySelector('.added-to-cart');
                alertEl.style.display = 'flex';
                alertEl.addEventListener('click', () => {
                  alertEl.style.display = 'none';
                }, { once: true });
              }
              trackAddToCartEvent({ ...data, cart: cartResponse });
            }
          } catch (error) {
            // eslint-disable-next-line no-console
            console.error(error);
          }
        }
      });
    });

    const announceQty = (sel) => {
      const sku = sel.getAttribute('data-sku') || '';
      const val = sel.value;
      const live = document.getElementById(`${sel.id}-status`);
      if (live) {
        live.textContent = getPlaceholder('Quantity for part number', sku, val);
      }
    };

    selects.forEach((sel) => {
      sel.addEventListener('change', () => {
        refreshCTA();
        announceQty(sel);
      });
    });

    form.querySelectorAll('.qty-select .qty-inc').forEach((btn) => {
      btn.addEventListener('click', () => {
        const sel = btn.closest('.qty-select')?.querySelector('select[data-sku]');
        if (!sel) return;
        const lastOpt = sel.options[sel.options.length - 1];
        const max = lastOpt ? parseInt(lastOpt.value, 10) : 999;
        const next = Math.min(max, (parseInt(sel.value, 10) || 0) + 1);
        sel.value = String(next);
        sel.dispatchEvent(new Event('change', { bubbles: true }));
        announceQty(sel);
      });
    });

    refreshCTA();
  }
}

function initCompendiumCard(cardEl) {
  if (!cardEl || cardEl.dataset.init === 'true') return;
  cardEl.dataset.init = 'true';

  const links = cardEl.querySelectorAll('.pub-controls .ctrl');
  const panels = cardEl.querySelectorAll('.section-panel');

  const closeAll = () => {
    panels.forEach((p) => {
      p.setAttribute('data-open', 'false');
      p.hidden = true;
      setPanelCleanup(p, null);
    });
    links.forEach((l) => l.setAttribute('aria-expanded', 'false'));
  };

  links.forEach((link) => {
    link.addEventListener('click', (e) => {
      if (link.tagName === 'A') e.preventDefault();

      const toggle = link.getAttribute('data-toggle');
      const idMap = {
        'more-docs': 'panel-more-docs',
        'quick-view': 'panel-quick-view',
        'supporting-products': 'panel-supporting-products',
      };
      const panelId = idMap[toggle];
      if (!panelId) return;

      const panel = cardEl.querySelector(`#${panelId}`);
      const isOpen = panel.getAttribute('data-open') === 'true';

      closeAll();

      if (!isOpen) {
        panel.hidden = false;
        requestAnimationFrame(() => {
          panel.setAttribute('data-open', 'true');
          link.setAttribute('aria-expanded', 'true');

          wirePanelTabCycle(panel, link);
        });
      } else {
        link.focus();
      }
    });

    link.addEventListener('keydown', (e) => {
      if (e.key !== 'Tab' || e.shiftKey) return;

      const toggle = link.getAttribute('data-toggle');
      const idMap = {
        'more-docs': 'panel-more-docs',
        'quick-view': 'panel-quick-view',
        'supporting-products': 'panel-supporting-products',
      };
      const panelId = idMap[toggle];
      if (!panelId) return;

      const panel = cardEl.querySelector(`#${panelId}`);
      const expanded = link.getAttribute('aria-expanded') === 'true';
      const open = panel && panel.getAttribute('data-open') === 'true';

      if (expanded && open) {
        const first = getFocusableIn(panel)[0];
        if (first) {
          e.preventDefault();
          first.focus();
        } else {
          e.preventDefault();
          panel.setAttribute('data-open', 'false');
          panel.hidden = true;
          setPanelCleanup(panel, null);
          link.setAttribute('aria-expanded', 'false');
          link.focus();
        }
      }
    });
  });

  loadFormEvents(cardEl);
}

function startCompendiumObserver(root = document.documentElement) {
  root.querySelectorAll('.compendiumcard').forEach(initCompendiumCard);

  const observer = new MutationObserver((mutations) => {
    mutations.forEach((m) => {
      m.addedNodes.forEach((node) => {
        if (node.nodeType === 1) {
          if (node.classList && node.classList.contains('compendiumcard')) {
            initCompendiumCard(node);
          }
          node.querySelectorAll?.('.compendiumcard').forEach(initCompendiumCard);
        }
      });
    });
  });

  observer.observe(root, { childList: true, subtree: true });
  return observer;
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => startCompendiumObserver());
} else {
  startCompendiumObserver();
}

function replaceCharAtIndex(originalString, charToReplace, index) {
  if (index < 0 || index >= originalString.length) return originalString;
  const firstPart = originalString.slice(0, index);
  const lastPart = originalString.slice(index + 1);
  return firstPart + charToReplace + lastPart;
}

function renderPublicationMetaHTML(data, objectTypeParam) {
  const publicationMetadataTextPlaceholder = getPlaceholder('Publication tags');
  let markup = `<div class="pub-meta" role="group" aria-label="${publicationMetadataTextPlaceholder}">`;

  const objectType = typeof objectTypeParam === 'string' ? objectTypeParam.trim() : '';
  if (objectType) {
    const objectTypePH = getPlaceholder(objectType);
    markup += `
      <div class="pub-meta__chips">
        <span class="chip">${objectTypePH}</span>
      </div>
    `;
  }

  const items = [];
  const metadata = data?.metadata ?? [];
  metadata.forEach((item) => {
    const sep = '<span class="pub-meta__sep" aria-hidden="true">|</span>';

    if (typeof item === 'string') {
      items.push(`${sep}<span class="meta-text">${item}</span>`);
      return;
    }

    if (item.type === 'publication') {
      const title = item.title ? `<span class="publication-bold">${item.title}</span>` : '';
      items.push(`${sep}<span class="meta-text publication">${title}${item.data ?? ''}</span>`);
      return;
    }

    if (item.type === 'k-v-pair') {
      const title = item.title ? `<span class="kv-title">${item.title}</span>` : '';
      const dataPart = item.data ? `<span class="kv-data">${item.data}</span>` : '';
      items.push(`${sep}<span class="meta-text kv-pair">${title}${dataPart}</span>`);
      return;
    }

    const title = item.title ? `${item.title} ` : '';
    const dataTextPlaceholder = getPlaceholder(item.data);
    items.push(`${sep}<span class="meta-text">${title}${dataTextPlaceholder ?? ''}</span>`);
  });
  markup += items.join('');
  markup += '</div>';
  return markup;
}

function renderMoreDocumentsTable(detailValues = [], options = {}, uid = '') {
  const captionId = `more-docs-caption-${uid}`;
  const headerLanguage = getPlaceholder('Language');
  const headerSupporting = getPlaceholder('Supporting documents');
  const captionText = getPlaceholder('More documents');
  const captionClass = options.srOnly ? 'sr-only' : '';

  const rows = detailValues.map((detail) => {
    let lang = (detail?.key ?? '');
    const language = lang.indexOf(' ');
    lang = replaceCharAtIndex(lang, '&nbsp &nbsp  | &nbsp &nbsp', language);
    const anchor = (detail?.value ?? '');
    return `<tr><td>${lang}</td><td>${anchor}</td></tr>`;
  }).join('');

  return `
    <table class="doc-table more-docs" role="table" aria-describedby="${captionId}">
      <caption id="${captionId}" class="${captionClass}">${captionText}</caption>
      <thead>
        <tr>
          <th scope="col">${headerLanguage}</th>
          <th scope="col">${headerSupporting}</th>
        </tr>
      </thead>
      <tbody>${rows}</tbody>
    </table>
  `;
}

function parseMultiLinks(value) {
  if (!value) return [];

  if (Array.isArray(value) && value.length === 2 && typeof value[0] === 'string' && typeof value[1] === 'string') {
    return [{
      label: value[0].trim(),
      url: value[1] ? window.location.origin + value[1].trim() : null,
    }];
  }

  const raw = Array.isArray(value) ? value[0] : value;
  if (typeof raw !== 'string') return [];
  const chunks = raw.split('~').map((s) => s.trim()).filter(Boolean);
  return chunks.map((chunk) => {
    const [label, urlPath = ''] = chunk.split('|').map((s) => s.trim());
    return {
      label,
      url: urlPath ? window.location.origin + urlPath : null,
    };
  });
}

function renderQuickViewTable(detailValues = [], options = {}, uid = '') {
  const captionId = `quick-view-caption-${uid}`;
  const captionText = getPlaceholder('Quick view');
  const captionClass = options.srOnly ? 'sr-only' : '';

  const rows = detailValues.map((d) => {
    if (Array.isArray(d?.value) || (typeof d?.value === 'string' && (d.value.includes('|') || d.value.includes('~')))) {
      const items = parseMultiLinks(d.value);
      const htmlValue = items
        .map((item) => (item.url
          ? `<a href="${item.url}">${item.label}</a>`
          : item.label))
        .join(', ');

      return `
      <tr>
        <td scope="row">${d.key ?? ''}</td>
        <td>${htmlValue}</td>
      </tr>`;
    }

    return `
      <tr>
        <td scope="row">${d.key ?? ''}</td>
        <td>${d.value ?? ''}</td>
      </tr>`;
  }).join('');

  return `
    <table class="doc-table quick-view-table" role="table" aria-describedby="${captionId}">
      <caption id="${captionId}" class="${captionClass}">${captionText}</caption>
      <tbody>${rows}</tbody>
    </table>
  `;
}

function formatPrice(price) {
  if (!price || price === '--') return '--';

  const parsed = parseCurrency(price);
  const { currency, integer, cents } = parsed;

  if (currency === 'USD' || currency === 'CAD') {
    return `$${parseInt(integer, 10).toLocaleString()}.${cents}`;
  }

  return price;
}

function renderSupportingProductsTable(detailValues = [], options = {}) {
  const captionId = 'supporting-products-caption';
  const captionText = getPlaceholder('Supporting products');
  const addedToCartText = getPlaceholder('The items were added successfully to your cart');
  const captionClass = options.srOnly ? 'sr-only' : '';
  const qtyMax = Number.isFinite(options.qtyMax) ? options.qtyMax : 10;
  const requestQuoteLabel = getPlaceholder('Request Quote');
  const addToCart = getPlaceholder('Add To Cart');

  const rows = detailValues.map((d) => {
    const sku = (d?.part_number ?? '');
    const desc = (d?.part_description ?? d?.part_number ?? '');
    const priceRaw = formatPrice(d?.list_price ?? '--');

    const discontinued = d?.discontinued;
    const isQuote = (d?.requestQuote);

    const safe = sku.replace(/[^a-zA-Z0-9_-]/g, '');
    const rowHdrId = `row-${safe}-hdr`;
    const selectId = `qty-${safe}`;
    const selectIdMobile = `${selectId}-m`;
    const liveId = `${selectId}-status`;
    const liveIdMobile = `${selectIdMobile}-status`;
    const optionsHtml = Array.from({ length: qtyMax + 1 }, (_, i) => {
      const selected = (i === 0) ? ' selected' : '';
      return `<option value="${i}"${selected}>${i}</option>`;
    }).join('');

    if (discontinued) {
      const card = `
        <div class="products-table supporting-docs" role="table" aria-describedby="${captionId}">
          <div class="table-body">
            <div class="table-row row-disabled">
              <div class="first-section">
                <div class="top-section">
                  <p class='field-title'>Part Number</p>
                  <p class="field-description">${sku}</p>
                </div>
                <div class="bottom-section">
                  <p class='field-title'>Part Description</p>
                  <p class="field-description">${desc}</p>
                </div>
              </div>
              <div class="second-section">
                <div class="price">--</div>
              </div>
              <div class="top-section">
                <p class="field-description"><span class="warn">⚠</span> Discontinued</p>
              </div>
            </div>
          </div>
        </div>
      `;
      return `
        <tr class="row-disabled">
          <th scope="row" id="${rowHdrId}"><p class="panel-link">${sku}</p></th>
          <td headers="${rowHdrId} col-part-desc"><span class="warn">⚠</span> Discontinued</td>
          <td headers="${rowHdrId} col-price">--</td>
          <td headers="${rowHdrId} col-qty">--</td>
        </tr>
        ${card}
      `;
    }

    const priceHtml = isQuote ? `<a class="request-link" href="#">${requestQuoteLabel}</a>` : priceRaw;
    const tableRow = `
      <tr>
        <th scope="row" id="${rowHdrId}"><p class="panel-link">${sku}</p></th>
        <td headers="${rowHdrId} col-part-desc">${desc}</td>
        <td class="price" headers="${rowHdrId} col-price">${priceHtml}</td>
        <td headers="${rowHdrId} col-qty">
          <div class="${isQuote ? 'hidden' : ''}">
            <div class="qty-select">
              <label class="sr-only" for="${selectId}">Quantity for part number ${sku}</label>
              <select id="${selectId}" data-sku="${sku}">
                ${optionsHtml}
              </select>
              <button
                type="button"
                class="qty-inc"
                aria-label="Increase quantity for ${sku}"
                aria-controls="${selectId}"
              >
                <svg class="icon-plus" width="20" height="20" viewBox="0 0 24 24" aria-hidden="true">
                  <path d="M12 5v14M5 12h14" fill="none" stroke="currentColor" stroke-width="2"/>
                </svg>
              </button>
            </div>
            <span id="${liveId}" class="sr-only" role="status" aria-live="polite" aria-atomic="true"></span>
          </div>
        </td>
      </tr>
    `;

    const cardRow = `
      <div class="products-table supporting-docs" role="table" aria-describedby="${captionId}">
        <div class="table-body">
          <div class="table-row">
            <div class="first-section">
              <div class="top-section">
                <p class='field-title ${isQuote ? 'hidden' : ''}'>Part Number</p>
                <p class="field-description" id="${rowHdrId}-m">${sku}</p>
              </div>
              <div class="bottom-section">
                <p class='field-title ${isQuote ? 'hidden' : ''}'>Part Description</p>
                <p class="field-description">${desc}</p>
              </div>
            </div>
            <div class="second-section">
              <div class="price ${isQuote ? 'quote' : ''}">${priceHtml}</div>
              <div class="${isQuote ? 'hidden' : ''}">
                <div class="qty-select">
                  <label class="sr-only" for="${selectIdMobile}">Quantity for part number ${sku}</label>
                  <select id="${selectIdMobile}" data-sku="${sku}">
                    ${optionsHtml}
                  </select>
                  <button
                    type="button"
                    class="qty-inc"
                    aria-label="Increase quantity for ${sku}"
                    aria-controls="${selectIdMobile}"
                  >
                    <svg class="icon-plus" width="20" height="20" viewBox="0 0 24 24" aria-hidden="true">
                      <path d="M12 5v14M5 12h14" fill="none" stroke="currentColor" stroke-width="2" />
                    </svg>
                  </button>
                </div>
                <span id="${liveIdMobile}" class="sr-only" role="status" aria-live="polite" aria-atomic="true"></span>
              </div>
            </div>
          </div>
        </div>
      </div>
    `;

    return tableRow + cardRow;
  }).join('');

  return `
    <form class="products-form" novalidate>
      <table class="products-table supporting-docs" role="table" aria-describedby="${captionId}">
        <caption id="${captionId}" class="${captionClass}">${captionText}</caption>
        <thead>
          <tr>
            <th scope="col" id="col-part-number">Part Number</th>
            <th scope="col" id="col-part-desc">Part Description</th>
            <th scope="col" id="col-price" class="col-price">List Price</th>
            <th scope="col" id="col-qty" class="col-qty">Qty</th>
          </tr>
        </thead>
        <tbody>
          ${rows}
        </tbody>
      </table>

      <div class="products-cta">
        <button class="agt-button" type="submit" data-ag-button="addToCart" aria-label="${addToCart}">
          ${addToCart}
        </button>
      </div>
      <div class="added-to-cart">
        <div class="added-alert"><span>${addedToCartText}</span><img alt="${getPlaceholder('Close')}" src="/icons/close.svg"></div>
      </div>
    </form>
  `;
}

function isInternalUrl(href) {
  try {
    const url = new URL(href, window.location.href);
    const host = url.hostname.toLowerCase();
    return isCDN(host, true);
  } catch {
    return false;
  }
}

async function loadProductDescriptions(...partNumbers) {
  if (!partNumbers || partNumbers.length === 0) {
    return {};
  }

  // TODO: Extract into global library when finalized

  const { country, language } = getLocale();
  const locale = `${language}_${country}`;

  const query = `query {
  getProducts(ids: ${JSON.stringify(partNumbers)}, locale: "${locale}") {
    status
    httpStatusCode
    data {
      id
      productName
      productDescription
    }
    error {
      errorCode
      errorDescription
    }
  }
}`;

  try {
    const config = await loadEnvConfig();
    const { productDetailsEndpoint } = config;
    const response = await fetch(productDetailsEndpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ query }),
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const result = await response.json();

    if (result?.data?.getProducts?.status !== 'SUCCESS') {
      // eslint-disable-next-line no-console
      console.error('PCC API returned error:', result?.data?.getProducts?.error);
      return {};
    }

    const products = result?.data?.getProducts?.data || [];
    const descriptionsMap = {};

    products.forEach((product) => {
      if (product.id && product.productDescription) {
        try {
          const parsedDescription = JSON.parse(product.productDescription);
          const partNumberDescription = parsedDescription.PartNumberDescription || product.productName;
          descriptionsMap[product.id] = partNumberDescription;
        } catch (error) {
          // eslint-disable-next-line no-console
          console.error(`Failed to parse product description for ${product.id}:`, error);
          descriptionsMap[product.id] = product.productName;
        }
      }
    });

    return descriptionsMap;
  } catch (error) {
    // eslint-disable-next-line no-console
    console.error('Error fetching product descriptions:', error);
    return {};
  }
}

async function loadParts(supportingPanel, ecPartNumbers) {
  const partsArray = (ecPartNumbers || '').split(';').filter(Boolean);

  if (partsArray.length === 0) {
    supportingPanel.innerHTML = '';
    return;
  }

  const inventoryResponse = await fetchProductInventory(partsArray);
  const inventories = inventoryResponse || {};

  const productDescriptions = new Map();

  const descriptionsObject = await loadProductDescriptions(...partsArray);
  Object.entries(descriptionsObject).forEach(([partNumber, description]) => {
    productDescriptions.set(partNumber, description);
  });

  const enrichedInventories = partsArray.map((sku) => {
    const inventoryData = inventories[sku] || {};

    return {
      part_number: sku,
      part_description: productDescriptions.get(sku) || inventoryData.partDescription || sku,
      list_price: inventoryData.listPrice || '--',
      discontinued: !!(inventoryData.discontinued || inventoryData.obsoleteProduct),
    };
  });

  const formHtml = renderSupportingProductsTable(enrichedInventories, { srOnly: true, qtyMax: 10 });
  supportingPanel.innerHTML = formHtml;

  loadFormEvents(supportingPanel.closest('.compendiumcard'));

  const addBtn = supportingPanel.closest('.block').querySelector('.products-cta .agt-button');
  addBtn.style.visibility = 'visible';
}

export default async function decorate(block) {
  const result = JSON.parse(block.dataset.result);
  const {
    title,
    clickableuri,
    publicationMetadata,
    moreDocuments,
    quickView,
    supportingDocuments,
    objecttype,
    description,
  } = result.raw;

  const ecPartNumbers = result.raw.ec_part_numbers ?? result.raw.ec_related_part_number;

  let subtitle = [description].find((text) => text && text.trim() !== '') || '';
  subtitle = stripHtml(subtitle);
  const link = clickableuri;

  const uid = `rm-${Math.random().toString(36).slice(2, 8)}`;
  const btnId = `${uid}-btn`;

  let additionalMainClass = '';
  switch (objecttype) {
    case 'video':
    case 'Video':
      additionalMainClass = 'video';
      break;
    default:
      additionalMainClass = '';
  }

  const subtitleHTML = subtitle !== '' ? `<p class="pub-subtitle" id="${uid}-subtitle">${subtitle}</p>` : '';

  const metadata = renderPublicationMetaHTML(publicationMetadata, objecttype);

  const timeHTML = '';

  const hasPanels = Boolean(moreDocuments?.show)
    || Boolean(quickView?.show)
    || Boolean(supportingDocuments?.show);

  const hasLink = typeof link === 'string' && link.trim().length > 0;
  let isInternal = hasLink && isInternalUrl(link);
  let isExternal = hasLink && !isInternal;

  if (isInternal && typeof objecttype === 'string' && objecttype.startsWith('Community')) {
    isInternal = false;
    isExternal = true;
  }

  const ariaLabel = isExternal
    ? `${title} ${getPlaceholder('opens a new tab')}`
    : title;

  const titleHTML = hasLink
    ? `
        <a href="${link}" class="pub-ext"
          ${isExternal ? 'target="_blank"' : ''}>
          <h3 id="pub-title" class="pub-title" aria-label="${ariaLabel}">
            ${title}
            ${isExternal ? `
              <svg width="16" height="17" viewBox="0 0 16 17" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M4.66634 4.79199H11.333M11.333 4.79199V11.4587M11.333 4.79199L4.66634 11.4587" stroke="#004773" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
              </svg>` : ''}
          </h3>
        </a>
      `
    : `<h3 id="pub-title" class="pub-title" aria-label="${ariaLabel}">${title}</h3>`;

  const controlsHTML = hasPanels ? `
    <div class="pub-controls" aria-label="Publication sections">
      <button type="button" class="ctrl" data-toggle="more-docs" aria-controls="panel-more-docs" aria-expanded="false" ${moreDocuments?.show === true ? '' : 'hidden'}>
        <span>${getPlaceholder('More Documents')}</span>
        <svg class="chev" width="14" height="14" viewBox="0 0 24 24" aria-hidden="true">
          <path d="M6 9l6 6 6-6" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
        </svg>
      </button>

      <button type="button" class="ctrl" data-toggle="quick-view" aria-controls="panel-quick-view" aria-expanded="false" ${quickView?.show === true ? '' : 'hidden'}>
        <span>${getPlaceholder('Quick View')}</span>
        <svg class="chev" width="14" height="14" viewBox="0 0 24 24" aria-hidden="true">
          <path d="M6 9l6 6 6-6" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
        </svg>
      </button>

      <button type="button" class="ctrl" data-toggle="supporting-products" aria-controls="panel-supporting-products" aria-expanded="false" ${supportingDocuments?.show === true ? '' : 'hidden'}>
        <span>${getPlaceholder('Supporting Products') ?? getPlaceholder('Supporting Documents')}</span>
        <svg class="chev" width="14" height="14" viewBox="0 0 24 24" aria-hidden="true">
          <path d="M6 9l6 6 6-6" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
        </svg>
      </button>
    </div>
  ` : '';

  const panelsHTML = hasPanels ? `
    <div class="pub-panels">
      <section class="section-panel" id="panel-more-docs" aria-label="${getPlaceholder('More Documents')}" hidden>
        <div class="panel-surface more-docs-panel">
          ${renderMoreDocumentsTable(moreDocuments?.detailValues ?? [], { srOnly: true }, uid)}
        </div>
      </section>

      <section class="section-panel" id="panel-quick-view" aria-label="${getPlaceholder('Quick View')}" hidden>
        <div class="panel-surface">
          ${renderQuickViewTable(quickView?.detailValues ?? [], { srOnly: true }, uid)}
        </div>
      </section>

      <section class="section-panel" id="panel-supporting-products" hidden aria-label="${getPlaceholder('Supporting Products')}">
        <div class="panel-surface supporting-surface">
          ${renderSupportingProductsTable(supportingDocuments?.detailValues ?? [], { srOnly: true, qtyMax: 10 })}
        </div>
      </section>
    </div>
  ` : '';

  block.append(html`
<div class="compendiumcard ${additionalMainClass}">
  <div class="pub-header" aria-labelledby="pub-title">
    ${titleHTML}
    ${subtitleHTML}
    ${timeHTML}
    ${metadata}
  </div>

  ${controlsHTML}
  ${panelsHTML}
</div>`);

  const btnSup = block.querySelector('button[data-toggle="supporting-products"]');

  if (btnSup) {
    btnSup.addEventListener('click', (e) => {
      const currentContainer = e.currentTarget.closest('.compendiumcard').querySelector('.pub-panels #panel-supporting-products .supporting-surface');

      loadParts(currentContainer, ecPartNumbers);
    });
  }

  const subtitleEl = block.querySelector(`#${uid}-subtitle`);
  const card = block.closest('.compendiumcard') || block.querySelector('.compendiumcard');
  const mq = window.matchMedia('(min-width: 768px)');
  const readMoreBtn = document.createElement('a');
  readMoreBtn.id = btnId;
  readMoreBtn.href = '#';
  readMoreBtn.className = 'pub-readmore';
  readMoreBtn.setAttribute('role', 'button');
  const moreText = getPlaceholder('Read more');
  const lessText = getPlaceholder('Read less');

  function updateReadMore() {
    if (!subtitleEl || !card) return;

    if (mq.matches) {
      card.classList.remove('is-subtitle-expanded');
      if (readMoreBtn.parentNode) readMoreBtn.parentNode.removeChild(readMoreBtn);
      return;
    }

    const wasExpanded = card.classList.contains('is-subtitle-expanded');
    if (wasExpanded) card.classList.remove('is-subtitle-expanded');

    const isOverflowing = subtitleEl.scrollHeight > subtitleEl.clientHeight + 1;

    if (wasExpanded) card.classList.add('is-subtitle-expanded');

    if (isOverflowing) {
      if (!readMoreBtn.parentNode) {
        subtitleEl.insertAdjacentElement('afterend', readMoreBtn);
      }
      if (!wasExpanded) readMoreBtn.textContent = moreText;
      readMoreBtn.style.display = '';
    } else {
      if (readMoreBtn.parentNode) readMoreBtn.parentNode.removeChild(readMoreBtn);
      card.classList.remove('is-subtitle-expanded');
    }
  }

  readMoreBtn.addEventListener('click', (e) => {
    e.preventDefault();
    if (!card) return;
    const expanded = card.classList.toggle('is-subtitle-expanded');
    readMoreBtn.textContent = expanded ? lessText : moreText;
  });

  updateReadMore();
  if (typeof mq.addEventListener === 'function') {
    mq.addEventListener('change', updateReadMore);
  }
}
