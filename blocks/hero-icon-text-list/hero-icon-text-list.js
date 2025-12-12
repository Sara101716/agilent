import { decorateButtons } from '../../scripts/aem.js';

function initHeroVideoToggle(blockEl) {
  const heroMediaContainer = blockEl.querySelector(':scope > div:first-child');
  if (!heroMediaContainer) return;

  const video = heroMediaContainer.querySelector('video');
  if (!video) return;

  const playPromise = video.play();
  if (playPromise !== undefined) {
    playPromise.catch(() => {
      video.muted = true;
      video.play();
    });
  }

  if (!heroMediaContainer.style.position) {
    heroMediaContainer.style.position = 'relative';
  }

  let btn = heroMediaContainer.querySelector('.hero-icon-text-list__video-toggle');
  if (!btn) {
    btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'hero-icon-text-list__video-toggle';
    const img = document.createElement('img');
    img.setAttribute('alt', '');
    img.setAttribute('aria-hidden', 'true');
    img.width = 44;
    img.height = 44;
    img.src = '/icons/pause.svg';
    btn.append(img);
    heroMediaContainer.append(btn);
  }

  const syncState = () => {
    const isPaused = video.paused;
    btn.classList.toggle('hero-icon-text-list__video-toggle--paused', isPaused);
    btn.setAttribute('aria-label', isPaused ? 'Play video' : 'Pause video');
  };

  syncState();

  btn.addEventListener('click', () => {
    if (video.paused) {
      video.play().catch(() => {
        video.muted = true;
        video.play().catch(() => {});
      });
    } else {
      video.pause();
    }
  });

  video.addEventListener('play', syncState);
  video.addEventListener('pause', syncState);
  video.addEventListener('ended', syncState);
  video.addEventListener('loadeddata', syncState);
}

export default async function decorate(blockEl) {
  const headingEl = blockEl.querySelector('h2');
  if (headingEl) {
    if (!headingEl.id) {
      headingEl.id = `hero-icon-text-list-heading-${Math.random().toString(36).slice(2, 8)}`;
    }
    blockEl.setAttribute('role', 'region');
    blockEl.setAttribute('aria-labelledby', headingEl.id);
  }
  const panelEls = blockEl.querySelectorAll(':scope > div:nth-child(n + 3)');
  if (panelEls.length) {
    const panelsHolderEl = document.createElement('div');
    panelsHolderEl.classList.add('hero-icon-text-list__panels');
    panelsHolderEl.setAttribute('role', 'group');
    panelsHolderEl.setAttribute('aria-label', 'Sustainability highlights');

    const panelsArr = Array.from(panelEls);
    const iconPanels = panelsArr.slice(0, -1);

    iconPanels.forEach((panelEl, i) => {
      panelEl.classList.add('hero-icon-text-list__panel');
      panelEl.setAttribute('role', 'group');
      panelEl.setAttribute('aria-label', `Highlight ${i + 1}`);
      const svgs = panelEl.querySelectorAll('svg');
      svgs.forEach((svg) => svg.setAttribute('aria-hidden', 'true'));
      panelsHolderEl.append(panelEl);
    });

    const lastEl = panelsArr[panelsArr.length - 1];
    if (lastEl) {
      lastEl.classList.add('hero-icon-text-list__cta');
      const link = lastEl.querySelector('a');
      if (link) {
        link.setAttribute('aria-describedby', headingEl ? headingEl.id : '');
      }
    }

    if (lastEl) {
      blockEl.insertBefore(panelsHolderEl, lastEl);
    } else {
      blockEl.append(panelsHolderEl);
    }
  }

  initHeroVideoToggle(blockEl);
  decorateButtons(blockEl);
}
