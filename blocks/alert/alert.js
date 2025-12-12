import {
  decorateIcons, getPlaceholder, html,
  setBlockToFullViewportWidth,
} from '../../scripts/aem.js';

function getSessionKey(block) {
  const classes = Array.from(block.classList);
  const bannerClass = classes.find((className) => className.startsWith('banner-index-'));
  if (bannerClass) {
    const sessionId = bannerClass.replace('banner-index-', '');
    return `alert-${sessionId}`;
  }
  return null;
}

function isAlertActive(sessionKey) {
  const value = sessionStorage.getItem(sessionKey);
  return value === null || value === 'true';
}

function setAlertActive(sessionKey, isActive) {
  sessionStorage.setItem(sessionKey, isActive ? 'true' : 'false');
}

export default function decorate(block) {
  const sessionKey = getSessionKey(block);

  if (sessionKey && sessionStorage.getItem(sessionKey) === null) {
    setAlertActive(sessionKey, true);
  }

  if (sessionKey && !isAlertActive(sessionKey)) {
    block.parentElement.remove();
    return;
  }

  // Check if close button should be shown
  const hasNoClose = block.classList.contains('no-close');

  let closeButton = null;
  if (!hasNoClose) {
    closeButton = document.createElement('div');
    closeButton.classList.add('alert-close');
    closeButton.setAttribute('role', 'button');
    closeButton.setAttribute('aria-label', getPlaceholder('close'));
    closeButton.setAttribute('tabindex', '0');
    const icon = document.createElement('span');
    icon.classList.add('icon', 'icon-close');
    closeButton.appendChild(icon);
    decorateIcons(closeButton);

    closeButton.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      if (sessionKey) {
        setAlertActive(sessionKey, false);
      }
      block.classList.add('hidden');
      setTimeout(() => {
        if (block.classList.contains('hidden')) {
          block.remove();
        }
      }, 300);
    });

    closeButton.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        e.stopPropagation();
        closeButton.click();
      }
    });
  }
  block.setAttribute('role', 'region');
  block.setAttribute('aria-label', getPlaceholder('Promotional Banner'));

  // Only add click handler for alerts that have links and are not no-close
  if (!hasNoClose) {
    block.addEventListener('click', () => {
      const blockHref = block.querySelector('a');
      if (blockHref) {
        window.location.href = blockHref.href;
      }
    });
  }

  const existingChildren = [...block.children];
  block.innerHTML = '';

  const inner = html`<div class="alert-inner">${existingChildren}</div>`;
  if (closeButton) {
    inner.appendChild(closeButton);
  }
  block.appendChild(inner);
  decorateIcons(block);
  setBlockToFullViewportWidth(block);
}
