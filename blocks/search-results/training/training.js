import {
  html,
  getPlaceholder,
  parseCurrency,
  loadCSS,
  getLocale,
  decorateBlock,
  loadBlock,
} from '../../../scripts/aem.js';
import { stripHtml } from '../../../scripts/coveo/utils.js';
import { fetchProductInventory } from '../../../scripts/services/atg.api.js';

async function priceResponse(productPart) {
  const response = await fetchProductInventory(productPart);
  try {
    if (response[productPart] && (!response[productPart].errorMessage || response[productPart].errorMessage.trim() === '')) {
      return response[productPart].listPrice;
    }
  } catch (error) {
    console.error('Error fetching product inventory:', error);
  }
  return '';
}

export default async function decorate(block) {
  loadCSS('/blocks/search-results/compendium/compendium.css');
  const result = JSON.parse(block.dataset.result || '{}');
  const {
    title = '',
    raw: {
      ec_product_id: ecProductId,
      clickableuri: link,
      description,
      ec_esaleable: esaleable,
      ec_request_quote_country_modal_url: modalQuoteUrl,
      ec_request_quote_country_url: quoteCountryUrl,
    } = {},
  } = result;

  const courseId = result.courseId || ecProductId || '';

  const hasLink = !!link;
  const subtitle = description ? stripHtml(description) : '';

  const listPrice = await priceResponse(ecProductId);
  const publicationMetadataTextPlaceholder = getPlaceholder('Publication tags');
  const { country } = getLocale();

  let price = listPrice;
  if (['US', 'CA'].includes(country) && price) {
    price = price.replace(/USD|CAD/i, '').trim();
    price = `$${price}`;
  }

  const priceParts = parseCurrency(price);

  const requestQuoteUrl = modalQuoteUrl || quoteCountryUrl;

  let ctaBlock = null;

  if (listPrice && esaleable === 'Yes') {
    ctaBlock = html`
      <div
        class="add-to-cart"
        data-block-name="add-to-cart"
        buttonType="secondary"
        partnumber="${ecProductId}"
        title="${title}"
        data-block-status="initialized">
      </div>
    `;
  } else {
    ctaBlock = html`
      <div
        class="request-quote"
        data-block-name="request-quote"
        buttonType="secondary"
        requestQuoteUrl="${requestQuoteUrl || '/common/requestQuote.jsp'}"
        productId="${ecProductId}"
        title="${title}">
      </div>
    `;
  }

  const titleBlock = hasLink
    ? html`
      <a href="${link}" class="pub-ext" rel="noopener">
        <h3
          id="pub-title"
          class="pub-title"
          aria-label="${`${title}`.trim()}"
        >
          ${title}
        </h3>
      </a>
    `
    : html`
      <h3
        id="pub-title"
        class="pub-title"
        aria-label="${title}"
      >
        ${title}
      </h3>
    `;

  block.append(html`
    <div class="trainingcard compendiumcard">
      <div class="pub-header" aria-labelledby="pub-title">
        ${titleBlock}

        <div class="course-id">${courseId}</div>

        ${subtitle ? html`<p class="pub-subtitle">${subtitle}</p>` : ''}

        <div class="pub-meta" role="group" aria-label="${publicationMetadataTextPlaceholder}">
          <div class="pub-meta__chips">
            <span class="chip compendiumcard__chip--grey">${getPlaceholder('Training')}</span>
          </div>
        </div>
      </div>

      <div class="product-cta">
        ${price ? html`
          <div class="price" data-price="${price}">
            ${priceParts.currency}${priceParts.integer}<span class="cents">.${priceParts.cents}</span>
          </div>` : ''} ${ctaBlock ?? ''}
      </div>
    </div>
  `);

  if (ctaBlock) {
    decorateBlock(ctaBlock);
    await loadBlock(ctaBlock);
  }
}
