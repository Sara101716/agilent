import {
  decorateIcons,
  getMetadata,
  getPlaceholder,
  html,
} from '../../scripts/aem.js';

export function controlVisibility(block, linkElem) {
  const backToTopMeta = getMetadata('back-to-top');
  const backtoTopDisabled = backToTopMeta && backToTopMeta.toLowerCase() === 'disabled';

  const mediaQueries = {
    desktop: window.matchMedia('(min-width: 1025px)'),
  };

  let isAppended = false;

  const handleMediaChange = () => {
    const shouldShow = mediaQueries.desktop.matches && !backtoTopDisabled;
    if (shouldShow && !isAppended) {
      block.appendChild(linkElem);
      isAppended = true;
    } else if (!shouldShow && isAppended) {
      if (block.contains(linkElem)) {
        block.removeChild(linkElem);
      }
      isAppended = false;
    }
  };

  Object.values(mediaQueries).forEach((mq) => {
    mq.addEventListener('change', handleMediaChange);
  });

  handleMediaChange();
}

export default function decorate(block) {
  block.classList.add('back-to-top', 'hidden');
  block.setAttribute('title', `${getPlaceholder('Back to Top')}`);

  const backToTopLink = html`
    <button aria-label="${getPlaceholder('Back to Top')}" class="back-to-top__link">
      <span class="icon icon-arrow-up"></span>
    </button>
  `;

  decorateIcons(backToTopLink);
  controlVisibility(block, backToTopLink);

  backToTopLink.addEventListener('click', (event) => {
    event.preventDefault();
    window.scrollTo({ top: 0, behavior: 'smooth' });
    const skipToContentElem = document.getElementsByClassName('skip-to-content')[0];
    if (skipToContentElem) {
      skipToContentElem.focus();
    }
  });

  const firstBlock = document.querySelector('main :first-child');
  const isDesktop = window.matchMedia('(min-width: 1025px)').matches;
  block.setAttribute('aria-hidden', 'true');
  backToTopLink.setAttribute('tabindex', '-1');
  backToTopLink.disabled = true;

  if (firstBlock && isDesktop) {
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          const topOutOfView = entry.boundingClientRect.top > 0;
          const fullyVisible = entry.intersectionRatio === 1;
          const shouldHide = topOutOfView || fullyVisible;
          block.classList.toggle('hidden', shouldHide);
          block.setAttribute('aria-hidden', String(shouldHide));
          if (shouldHide) {
            backToTopLink.setAttribute('tabindex', '-1');
            backToTopLink.disabled = true;
          } else {
            backToTopLink.removeAttribute('tabindex');
            backToTopLink.disabled = false;
          }
        });
      },
      { root: null, threshold: [0, 1] },
    );
    observer.observe(firstBlock);
  }

  return block;
}
