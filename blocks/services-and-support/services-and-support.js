import { decorateIcons, prepareGetAssetPath } from '../../scripts/aem.js';
import loadVideoJS from '../video/video.js';
import { serviceFormTemplate } from '../../scripts/atoms/selectBoxDown.js';
import {
  handleFormSubmit,
  setupCustomDropdown,
} from '../../scripts/common/selectBoxHandler.js';

export default function decorate(services) {
  const serviceWrappers = services.querySelectorAll(':scope > div');

  serviceWrappers.forEach((div) => div.classList.add('service__content'));

  if (serviceWrappers.length > 0 && serviceWrappers.length < 4) {
    const columnOneContent = serviceWrappers[0];
    const columnTwoContent = serviceWrappers[1];
    const columnThreeContent = serviceWrappers[2];
    columnOneContent.classList.add('service__image-wrapper');
    columnTwoContent.classList.add('service__find-resource-wrapper');
    columnThreeContent.classList.add('service__cards-wrapper');

    const serviceCards = services.querySelectorAll(
      '.service__cards-wrapper > div',
    );
    serviceCards.forEach((div) => div.classList.add('service__cards'));

    const imageWrapper = columnOneContent.querySelector(
      ':scope > div p:has(picture, image, video)',
    );
    if (imageWrapper) {
      imageWrapper.classList.add('service__image-wrapper');
    }

    document.querySelectorAll('.icon.icon-qr-code').forEach((icon) => {
      const buttonWrapper = icon.closest('a');
      if (!buttonWrapper) return;
      const listWrapper = buttonWrapper.closest('li');
      if (!listWrapper) return;

      const pictureWrapper = listWrapper.querySelector('p:has(picture)');
      if (!pictureWrapper) return;
      pictureWrapper.classList.add('qr-img');
      const picture = pictureWrapper.querySelector('picture');
      if (!picture) return;
      if (!buttonWrapper.contains(pictureWrapper)) {
        const qrPictureWrapper = document.createElement('p');
        qrPictureWrapper.classList.add('qr-picture-wrapper');
        qrPictureWrapper.append(icon, pictureWrapper);
        const existingChevron = buttonWrapper.querySelector('.icon-chevron-right');
        if (existingChevron) {
          buttonWrapper.insertBefore(qrPictureWrapper, existingChevron);
        } else {
          buttonWrapper.appendChild(qrPictureWrapper);
        }
      }
      const finalPictureWrapper = buttonWrapper.querySelector('.qr-picture-wrapper p:has(picture)');
      if (finalPictureWrapper) {
        finalPictureWrapper.classList.add('hidden');
      }
      if (!buttonWrapper.querySelector('.icon-chevron-right')) {
        const chevronSpan = document.createElement('span');
        chevronSpan.className = 'icon icon-chevron-right';
        buttonWrapper.appendChild(chevronSpan);
        decorateIcons(chevronSpan);
      }

      icon.addEventListener('click', (event) => {
        event.stopPropagation();
        event.preventDefault();
        document.querySelectorAll('.icon.icon-qr-code').forEach((otherIcon) => {
          if (otherIcon !== icon) {
            const otherButtonWrapper = otherIcon.closest('a');
            if (!otherButtonWrapper) return;
            const otherQrWrapper = otherButtonWrapper.querySelector('.qr-picture-wrapper');
            if (!otherQrWrapper) return;
            const otherPictureWrapper = otherQrWrapper.querySelector('p:has(picture)');
            if (!otherPictureWrapper) return;
            otherPictureWrapper.classList.add('hidden');
          }
        });
        const qrWrapper = buttonWrapper.querySelector('.qr-picture-wrapper');
        if (qrWrapper) {
          const currentPictureWrapper = qrWrapper.querySelector('p:has(picture)');
          if (currentPictureWrapper) {
            const isVisible = !currentPictureWrapper.classList.contains('hidden');
            currentPictureWrapper.classList.toggle('hidden', isVisible);
          }
        }
      });

      const qrWrapper = buttonWrapper.querySelector('.qr-picture-wrapper');
      if (qrWrapper) {
        qrWrapper.addEventListener('mouseenter', () => {
          if (!window.matchMedia('(pointer: fine)').matches) return;
          const currentPictureWrapper = qrWrapper.querySelector('p:has(picture)');
          if (currentPictureWrapper && currentPictureWrapper.classList.contains('hidden')) {
            currentPictureWrapper.classList.remove('hidden');
          }
        });

        qrWrapper.addEventListener('mouseleave', () => {
          if (!window.matchMedia('(pointer: fine)').matches) return;
          const currentPictureWrapper = qrWrapper.querySelector('p:has(picture)');
          if (currentPictureWrapper && !currentPictureWrapper.classList.contains('hidden')) {
            currentPictureWrapper.classList.add('hidden');
          }
        });
      }
    });

    const buttonWrapper = services.querySelectorAll(
      ':scope > div p:has(a, button)',
    );

    if (buttonWrapper) {
      buttonWrapper.forEach((p) => p.classList.add('service__button-wrapper'));
    }
    const playContent = columnOneContent.querySelector(
      'blockquote + p > a, blockquote + p > video',
    );

    if (playContent && imageWrapper) {
      const video = imageWrapper.querySelector('video');
      const playButtonTitle = columnOneContent.querySelector('em');

      if (video) {
        const playPromise = video.play();
        if (playPromise !== undefined) {
          playPromise.catch((error) => {
            // eslint-disable-next-line no-console
            console.warn('Video autoplay was prevented:', error);
          });
        }
      }

      playContent.parentElement.classList.add('hidden');
      playContent.parentElement.setAttribute('aria-hidden', 'true');
      const transcriptElements = [];
      const transcriptLinks = [];

      const allTranscriptLinks = columnOneContent.querySelectorAll(
        'a[href$=".vtt"]',
      );

      allTranscriptLinks.forEach((link) => {
        const el = link.closest('p');
        if (el) {
          transcriptElements.push(el);
          transcriptLinks.push(link);
        }
      });

      transcriptElements.forEach((el) => {
        el.remove();
      });

      const transcripts = transcriptLinks.map((transcript) => {
        const langCode = transcript.getAttribute('title')?.toLowerCase();
        return {
          label: langCode?.toUpperCase() || 'en',
          src: transcript.innerHTML,
          srclang: langCode,
          kind: 'subtitles',
          title: langCode?.toUpperCase() || 'en',
        };
      });

      const playButtonHTML = '<a class="play" role=\'button\' href="#"><span class="icon icon-play-video"></span></a>';
      imageWrapper.insertAdjacentHTML('afterbegin', playButtonHTML);
      const playButton = imageWrapper.querySelector('.play');

      if (playButtonTitle && playButton) {
        const titleText = playButtonTitle.textContent || '';
        playButton.setAttribute('title', titleText);
        playButton.setAttribute('aria-label', titleText);
        playButtonTitle.remove();
      }

      decorateIcons(playButton);

      playButton.addEventListener('click', async (event) => {
        event.preventDefault();
        const getFullPath = await prepareGetAssetPath();
        playButton.remove();
        playContent.parentElement.classList.remove('hidden');
        playContent.parentElement.removeAttribute('aria-hidden');

        let href;
        let isMP4 = false;

        if (playContent.tagName.toLowerCase() === 'a') {
          href = playContent.getAttribute('href');
          const [, capturedUrn] = href.match(
            /(urn:aaid:aem:[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12})/,
          ) || [];

          if (capturedUrn) {
            href = `${getFullPath(`/media/${capturedUrn}/manifest.m3u8`)}`;
          }
        } else if (playContent.tagName.toLowerCase() === 'video') {
          const source = playContent.querySelector('source');
          href = source
            ? source.getAttribute('src')
            : playContent.getAttribute('src');
          isMP4 = href && href.endsWith('.mp4');
        }

        loadVideoJS(playContent.parentElement, {
          src: href,
          autoplay: true,
          controls: true,
          muted: true,
          playsinline: true,
          style: 'video--16-9',
          type: isMP4 ? 'video/mp4' : 'application/x-mpegURL',
          transcripts,
        });

        imageWrapper.remove();
      });
    }

    document
      .querySelectorAll('.service__find-resource-wrapper')
      .forEach((wrapper) => {
        // Check if form already exists in this wrapper
        if (wrapper.querySelector('form')) {
          return;
        }

        const ul = wrapper.querySelector('ul');
        if (!ul) return;

        const items = Array.from(ul.querySelectorAll('li')).map((li) => li.innerHTML.trim());
        const submitCtaElem = wrapper.querySelector('.button-container a');

        if (items.length > 0) {
          // TODO have a better way to decorateForm.
          // we would probably need a decorateForm helper class.
          const formHtml = serviceFormTemplate({ items }, submitCtaElem);
          if (formHtml) {
            const tempDiv = document.createElement('div');
            tempDiv.innerHTML = formHtml;
            const form = tempDiv.firstElementChild;
            if (form) {
              form.addEventListener('submit', handleFormSubmit);
              setupCustomDropdown(form);
              ul.replaceWith(form);
            }
          } else {
            ul.remove();
          }
        } else {
          ul.remove();
        }

        if (submitCtaElem) {
          const buttonContainer = submitCtaElem.closest('.button-container');
          if (buttonContainer) {
            buttonContainer.remove();
          }
        }
      });
  } else {
    // eslint-disable-next-line no-console
    console.warn(
      'Expected 1 to 3 service wrappers, found:',
      serviceWrappers.length,
    );
  }

  // Decorate all icons in the services block
  decorateIcons(services);
}
