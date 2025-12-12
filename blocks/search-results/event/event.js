import { html, getPlaceholder, loadCSS } from '../../../scripts/aem.js';
import { stripHtml } from '../../../scripts/coveo/utils.js';

export default async function decorate(block) {
  loadCSS('/blocks/search-results/compendium/compendium.css');
  const result = JSON.parse(block.dataset.result || '{}');
  const {
    title = '',
    clickableuri,
    description = '',
    eventlocation = '',
    eventdate = '',
    objecttype = '',
  } = result.raw;

  let subtitle = [description].find((text) => text && text.trim() !== '') || '';
  subtitle = stripHtml(subtitle);
  const hasLink = !!clickableuri;
  const publicationMetadataTextPlaceholder = getPlaceholder('Publication tags');
  const locationPH = getPlaceholder('Location');
  const datePH = getPlaceholder('Date');
  const opensNewTabPH = hasLink ? getPlaceholder('opens a new tab') : '';
  const objectTypePH = getPlaceholder(objecttype);
  const titleBlock = hasLink
    ? html`
      <a href="${clickableuri}" class="pub-ext" target="_blank" rel="noopener">
        <h3
          id="pub-title"
          class="pub-title"
          aria-label="${`${title} ${opensNewTabPH}`.trim()}"
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
    <div class="eventcard compendiumcard" data-init="true">
      <div class="pub-header" aria-labelledby="pub-title">
        ${titleBlock}

        <div class="event-meta" role="group" aria-label="Event details">
          <div class="pair">
            <span class="k">${locationPH}</span>
            <span class="v">${eventlocation}</span>
          </div>
          <span class="sep" aria-hidden="true"></span>
          <div class="pair">
            <span class="k">${datePH}</span>
            <span class="v">${eventdate}</span>
          </div>
        </div>

        <p class="pub-subtitle">${subtitle}</p>

        <div class="pub-meta" role="group" aria-label="${publicationMetadataTextPlaceholder}">
          <div class="pub-meta__chips">
            <span class="chip compendiumcard__chip--grey">${objectTypePH}</span>
          </div>
        </div>
      </div>
    </div>
  `);
}
