/* eslint-disable camelcase */
import { html, getPlaceholder, isExternalURL } from '../../../scripts/aem.js';
import { getDateFormatEpochMs } from '../../../scripts/coveo/utils.js';

export default async function decorate(block) {
  const result = JSON.parse(block.dataset.result || '{}');

  const {
    objecttype,
    title,
    clickableuri,
    author,
    date,
    forum_body,
    forum_reply_author,
    forum_reply_body,
    forum_reply_date,
    forum_reply_type,
  } = result.raw;

  const hasLink = !!clickableuri;
  const publicationMetadataTextPlaceholder = getPlaceholder('Publication tags');
  const opensNewTabPH = hasLink ? getPlaceholder('opens a new tab') : '';
  const topRepliesPH = getPlaceholder(forum_reply_type);
  const beautifiedObjectType = (objecttype === 'Community - Question' || objecttype === 'Community - Discussion') ? 'Community Forum' : objecttype;
  const formatedDate = getDateFormatEpochMs(date);
  const formatedForumReplyDate = getDateFormatEpochMs(forum_reply_date);
  const titleBlock = hasLink
    ? html`
      <a href="${clickableuri}" class="${isExternalURL(clickableuri) ? 'pub-ext' : ''}" target="_blank" rel="noopener">
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
      <h3 id="pub-title" class="pub-title" aria-label="${title}">
        ${title}
      </h3>
    `;

  const opMeta = html`
    <div class="community__meta" role="group" aria-label="Original post meta">
      ${author ? html`<span class="community__author">${author}</span>` : ''}
      ${result.age ? html`<span class="community__age">(${result.age})</span>` : ''}
      ${result.opKudos ? html`<span class="community__kudos">${result.opKudos}</span>` : ''}
    </div>
  `;

  const forumBodyEl = forum_body ? html`<div class="community__body">${forum_body}</div>` : '';

  const opTimeEl = date ? html`<div class="community__timestamp">${formatedDate}</div>` : '';

  const postEl = html`
    <div class="community__post">
      ${opMeta}
      ${forumBodyEl}
      ${opTimeEl}
    </div>
  `;

  const repliesTitle = topRepliesPH ? html`<div class="community__section-title">${topRepliesPH}</div>` : '';

  const repliesList = forum_reply_type
    ? html`
      <div class="community__replies" role="list">   
          <div class="community__reply" role="listitem">
            <div class="community__meta" role="group" aria-label="Reply meta">
              ${forum_reply_author ? html`<span class="community__author">${forum_reply_author}</span>` : ''}
              ${result.age ? html`<span class="community__age">(${result.forum_reply_age})</span>` : ''}
              ${result.kudos ? html`<span class="community__kudos">${result.kudos}</span>` : ''}
            </div>
            ${forum_reply_body ? html`<div class="community__body">${forum_reply_body}</div>` : ''}
            ${forum_reply_date ? html`<div class="community__timestamp">${formatedForumReplyDate}</div>` : ''}
          </div>
      </div>
    `
    : '';

  const footer = html`
    <div class="community__footer pub-meta" role="group" aria-label="${publicationMetadataTextPlaceholder}">
      <div class="pub-meta__chips">
        <span class="chip">${getPlaceholder(beautifiedObjectType)}</span>
      </div>
    </div>
  `;

  block.append(html`
    <div class="community compendiumcard" data-init="true">
      <div class="pub-header" aria-labelledby="pub-title">
        ${titleBlock}
      </div>

      ${postEl}
      ${repliesTitle}
      ${repliesList}

      ${footer}
    </div>
  `);
}
