import { getPlaceholder, setBlockToOverflowViewportWidth, decorateLabel } from '../../scripts/aem.js';

export default async function decorate(blockEl) {
  let panelsHolderEl = blockEl.querySelector(':scope > .greatscience__panels');
  if (!panelsHolderEl) {
    const rawPanels = blockEl.querySelectorAll(':scope > div:nth-child(n + 1)');
    panelsHolderEl = document.createElement('div');
    panelsHolderEl.classList.add('greatscience__panels');
    rawPanels.forEach((panelEl, i) => {
      panelsHolderEl.append(panelEl);
      if (i < 3) {
        panelEl.classList.add('greatscience__panel');
      } else {
        panelEl.remove();
      }
    });
    blockEl.append(panelsHolderEl);
  }

  const panels = Array.from(panelsHolderEl.querySelectorAll(':scope > .greatscience__panel'));

  panels.forEach((panel) => {
    const parts = panel.querySelectorAll(':scope > div');
    const body = parts[1] || panel.appendChild(document.createElement('div'));
    body.classList.add('greatscience__panel-body');

    const labels = body.querySelector(':scope > ul');
    if (labels) {
      labels.classList.add('greatscience__labels');
      labels.querySelectorAll(':scope > li').forEach((li) => li.classList.add('greatscience__label'));
    }

    const paras = Array.from(body.querySelectorAll(':scope > p'));
    const titleP = paras.find((p) => !p.classList.contains('greatscience__readmore') && !p.querySelector('picture'));
    if (titleP) titleP.classList.add('greatscience__title');

    const readMoreP = paras.find((p) => p.querySelector('a.agt-link') && !p.querySelector('picture'));
    if (readMoreP) readMoreP.classList.add('greatscience__readmore');
  });

  const greatScienceContainer = blockEl.closest('.greatscience-container');
  if (greatScienceContainer && panels.length > 0) {
    panels.forEach((article) => {
      const headline = article.querySelector('.greatscience__title')?.textContent?.trim() || '';
      const url = article.querySelector('.greatscience__readmore a.agt-link')?.getAttribute('href') || '';
      const imageUrl = article.querySelector('picture img')?.getAttribute('src') || '';

      const publisherName = getPlaceholder('Agilent Technologies');
      const publisherLogo = document.querySelector('header .site-header__logo img')?.getAttribute('src') || '/icons/header/icon-agilent-spark-2x.webp';

      const articleSchema = {
        '@context': 'https://schema.org',
        '@type': 'NewsArticle',
        headline,
        url,
        image: imageUrl ? [imageUrl] : [],
        publisher: {
          '@type': 'Organization',
          name: publisherName,
          logo: {
            '@type': 'ImageObject',
            url: publisherLogo,
          },
        },
      };

      const scriptEl = document.createElement('script');
      scriptEl.type = 'application/ld+json';
      scriptEl.textContent = JSON.stringify(articleSchema, null, 2);
      greatScienceContainer.insertAdjacentElement('afterbegin', scriptEl);
    });
  }

  function ensureOverlay(panel) {
    const existingOverlay = panel.querySelector(':scope > a.greatscience__overlay');
    if (existingOverlay) return;

    const readMoreLink = panel.querySelector('.greatscience__readmore a.agt-link');
    if (readMoreLink) {
      const href = readMoreLink.getAttribute('href');
      if (href && href.trim() !== '') {
        const overlay = document.createElement('a');
        overlay.classList.add('greatscience__overlay');
        overlay.href = href;
        const linkText = readMoreLink.textContent;
        const ariaLabel = (linkText && linkText.trim()) ? linkText.trim() : 'Read more';
        overlay.setAttribute('aria-label', ariaLabel);
        overlay.tabIndex = 0;
        panel.prepend(overlay);
        panel.setAttribute('role', 'link');
        panel.setAttribute('tabindex', '0');
        panel.dataset.href = href;
        panel.classList.remove('greatscience__panel--overlay-disabled');
      }
    }
  }

  function removeOverlay(panel) {
    panel.querySelectorAll(':scope > a.greatscience__overlay').forEach((a) => a.remove());
    panel.removeAttribute('role');
    panel.removeAttribute('tabindex');
    delete panel.dataset.href;
    panel.classList.add('greatscience__panel--overlay-disabled');
  }

  panels.forEach((panel) => ensureOverlay(panel));
  panels.forEach((panel) => {
    const body = panel.querySelector(':scope > .greatscience__panel-body');
    if (!body) return;

    const children = Array.from(body.children);
    const qrPicP = children.find((el) => el.tagName === 'P' && el.querySelector('picture'));
    if (!qrPicP) return;

    const qrTextP = (qrPicP.nextElementSibling
      && qrPicP.nextElementSibling.tagName === 'P'
      && !qrPicP.nextElementSibling.classList.contains('greatscience__readmore')
      && !qrPicP.nextElementSibling.querySelector('picture'))
      ? qrPicP.nextElementSibling
      : null;

    const qrExtraP = (qrTextP
      && qrTextP.nextElementSibling
      && qrTextP.nextElementSibling.tagName === 'P'
      && !qrTextP.nextElementSibling.classList.contains('greatscience__readmore')
      && !qrTextP.nextElementSibling.querySelector('picture')
      && !qrTextP.nextElementSibling.querySelector('a'))
      ? qrTextP.nextElementSibling
      : null;

    const startIdx = children.indexOf(qrPicP);
    const qrButtonP = children
      .slice(startIdx + 1)
      .find((el) => el.classList?.contains?.('greatscience__readmore')
        || (el.tagName === 'P' && el.querySelector('a') && !el.querySelector('picture')));

    const row = document.createElement('div');
    row.className = 'greatscience__qr-row';

    const imgWrap = document.createElement('div');
    imgWrap.className = 'greatscience__qr-img';
    const qrPicClone = qrPicP.querySelector('picture')?.cloneNode(true);
    if (qrPicClone) imgWrap.append(qrPicClone);
    row.append(imgWrap);

    const content = document.createElement('div');
    content.className = 'greatscience__qr-content';

    if (qrTextP) {
      const t = document.createElement('p');
      t.className = 'greatscience__qr-text';
      t.textContent = qrTextP.textContent.trim();
      content.append(t);
    }
    if (qrExtraP) {
      const extra = document.createElement('p');
      extra.className = 'greatscience__qr-text';
      extra.textContent = qrExtraP.textContent.trim();
      content.append(extra);
    }

    let hasQrLink = false;
    if (qrButtonP) {
      const a = qrButtonP.querySelector('a');
      if (a) {
        const linkP = document.createElement('p');
        linkP.className = 'greatscience__qr-link';
        linkP.append(a.cloneNode(true));
        content.append(linkP);
        hasQrLink = true;

        const srcLinkP = a.closest('p');
        if (srcLinkP && srcLinkP.isConnected) srcLinkP.remove();
      }
    }

    row.append(content);

    const readMoreP = body.querySelector(':scope > .greatscience__readmore');
    const titleP = body.querySelector(':scope > .greatscience__title');
    if (readMoreP && readMoreP.isConnected) {
      readMoreP.insertAdjacentElement('afterend', row);
    } else if (titleP) {
      titleP.insertAdjacentElement('afterend', row);
    } else {
      body.append(row);
    }

    if (qrPicP && qrPicP.isConnected) qrPicP.remove();
    if (qrTextP && qrTextP.isConnected) qrTextP.remove();
    if (qrExtraP && qrExtraP.isConnected) qrExtraP.remove();

    panel.classList.add('greatscience__panel--has-qr');
    if (hasQrLink) {
      panel.dataset.qrLinkBelow = 'true';
    }
  });

  if (panels.some((p) => p.classList.contains('greatscience__panel--has-qr'))) {
    panelsHolderEl.classList.add('greatscience__panels--has-qr');
  }

  const isTablet = () => window.matchMedia('(min-width: 768px) and (max-width: 1024px)').matches;
  const isDesktop = () => window.matchMedia('(min-width: 1025px)').matches;

  function anyCardHasQrLink() {
    return panels.some((p) => p.dataset.qrLinkBelow === 'true');
  }

  function applyOverlayPolicy() {
    if ((isTablet() || isDesktop()) && anyCardHasQrLink()) {
      panels.forEach((p) => removeOverlay(p));
    } else {
      panels.forEach((p) => ensureOverlay(p));
    }
  }

  applyOverlayPolicy();

  window.addEventListener('resize', applyOverlayPolicy);

  function clearActive() { panels.forEach((p) => p.classList.remove('greatscience__panel--active')); }
  function collapseAll() {
    panelsHolderEl.classList.remove('greatscience__panels--expanded-all');
    clearActive();
  }

  panels.forEach((panel) => {
    panel.addEventListener('mouseenter', () => {
      if (!isDesktop()) return;
      panelsHolderEl.classList.add('greatscience__panels--expanded-all');
      clearActive();
      panel.classList.add('greatscience__panel--active');
    });
    panel.addEventListener('focusin', () => {
      if (!isDesktop()) return;
      panelsHolderEl.classList.add('greatscience__panels--expanded-all');
      clearActive();
      panel.classList.add('greatscience__panel--active');
    });
  });

  panelsHolderEl.addEventListener('mouseleave', () => { if (isDesktop()) collapseAll(); });
  window.addEventListener('resize', () => { if (!isDesktop()) collapseAll(); });

  setBlockToOverflowViewportWidth(blockEl, { viewports: ['mobile', 'tablet'] });

  decorateLabel(blockEl);
}
