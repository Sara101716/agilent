import {
  html,
  decorateIcons,
  getPlaceholder,
} from '../../scripts/aem.js';

export default async function decorate(blockEl) {
  blockEl.setAttribute('role', 'region');
  blockEl.setAttribute('aria-label', getPlaceholder('Promotion'));
  const pictureEl = blockEl.querySelector('p:has(img)');
  if (pictureEl) {
    pictureEl.classList.add('video-tn');
    const imgEl = pictureEl.querySelector('a');
    if (imgEl) {
      imgEl.alt = '';
    }
  }
  const blockBodyEl = blockEl.querySelector(':scope >div >div');
  const contentEls = blockEl.querySelectorAll(':scope >div >div >:not(p:has(img), .button-container)');
  const buttonEl = blockEl.querySelector('p:has(strong, em)');
  const contentContainerEl = html`<div class="content-container ${pictureEl ? 'thumbnail' : ''}"></div>`;
  const textContainerEl = html`<div class="text-container">${contentEls}</div>`;
  contentContainerEl.append(textContainerEl);
  if (buttonEl) {
    buttonEl.querySelector('a').classList.add('agt-button');
    contentContainerEl.append(html`<div class="button-container">${buttonEl.innerHTML}</div>`);
    buttonEl.remove();
  }
  blockBodyEl.append(contentContainerEl);

  blockEl.addEventListener('click', () => {
    const blockHref = blockEl.querySelector('a');
    if (blockHref) {
      window.location.href = blockHref.href;
    }
  });

  decorateIcons(blockEl);
}
