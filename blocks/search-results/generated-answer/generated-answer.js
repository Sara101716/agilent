import {
  html,
  getPlaceholder,
  isLoggedIn,
} from '../../../scripts/aem.js';
import {
  getContentController,
} from '../../../scripts/coveo/headless/index.js';

async function renderGeneratedAnswer(blockEl) {
  const blockConfig = JSON.parse(blockEl.dataset.blockConfig);
  const disclaimerLink = blockConfig.generatedAnswerDisclaimerLink;
  const { initGeneratedAnswer, activateGeneratedAnswer } = await getContentController();
  let answerEl;

  const audience = blockConfig.generatedAnswerAudience;
  let enabled = false;
  switch (audience) {
    case 'all':
      enabled = true;
      break;
    case 'internal': {
      const userObj = localStorage.getItem('userObj');
      if (userObj) {
        const userInfo = JSON.parse(userObj);
        if (userInfo?.email) {
          enabled = userInfo.email.includes('agilent.com');
        }
      }
      break;
    }
    case 'logged-in': {
      enabled = isLoggedIn();
      break;
    }
    default:
      break;
  }
  if (enabled) {
    initGeneratedAnswer();

    activateGeneratedAnswer(async (ga, finalAnswer, { citations }) => {
      const noAnswer = ga?.state?.cannotAnswer === true
        || !finalAnswer
        || finalAnswer.trim().length === 0;

      if (noAnswer) {
        blockEl.style.display = 'none';
        return;
      }

      const thumbsUpEl = html`<button aria-label="${getPlaceholder('Like')}"><img class="like-button" src="/icons/thumbsup.svg" title="${getPlaceholder('Like')}"></button>`;
      const thumbsDownEl = html`<button aria-label="${getPlaceholder('Dislike')}"><img class="like-button" src="/icons/thumbsdown.svg" title="${getPlaceholder('Dislike')}"></button>`;
      thumbsUpEl.addEventListener('click', () => {
        const isActive = thumbsUpEl.classList.contains('active');
        if (isActive) {
          thumbsUpEl.classList.remove('active');
        } else {
          ga.like();
          thumbsUpEl.classList.add('active');
          thumbsDownEl.classList.remove('active');
        }
      });

      thumbsDownEl.addEventListener('click', () => {
        const isActive = thumbsDownEl.classList.contains('active');
        if (isActive) {
          thumbsDownEl.classList.remove('active');
        } else {
          ga.dislike();
          thumbsDownEl.classList.add('active');
          thumbsUpEl.classList.remove('active');
        }
      });
      const announceEl = html`<span class="announce" role="status" aria-live="polite"></span>`;
      const copyButtonEl = html`<button aria-label="${getPlaceholder('Copy to clipboard')}"><img src="/icons/copy.svg" title="${getPlaceholder('Copy')}"></button>`;
      copyButtonEl.addEventListener('click', async () => {
        await navigator.clipboard.writeText(finalAnswer);
        announceEl.textContent = getPlaceholder('Copied');
        setTimeout(() => {
          announceEl.innerHTML = '';
        }, 500);
      });
      const regenButtonEl = html`<button aria-label="${getPlaceholder('Regenerate')}"><img src="/icons/regen.svg" title=${getPlaceholder('Regenerate')}></button>`;
      regenButtonEl.addEventListener('click', async () => {
        ga.retry();
      });
      const citationsContainerEl = html`<div class="citations-container"></div>`;
      citations.forEach((citation) => {
        const href = citation.clickUri || '#';
        const { title } = citation;
        citationsContainerEl.append(html`<a href="${href}">${title}</a>`);
      });
      const sourcesEl = html`
      <div class="sources"><a href="#" role="button">${getPlaceholder('Sources')} (${citations.length})</a></div>`;
      if (citations.length > 0) {
        const toggleCitations = (e) => {
          e.preventDefault();
          const expanded = citationsContainerEl.getAttribute('aria-expanded');
          if (!expanded) {
            citationsContainerEl.setAttribute('aria-expanded', true);
          } else {
            citationsContainerEl.removeAttribute('aria-expanded');
          }
        };
        sourcesEl.addEventListener('click', (e) => {
          toggleCitations(e);
        });
        sourcesEl.addEventListener('keydown', (e) => {
          if (e.key === ' ' || e.code === 'Space' || e.key === 'Spacebar') {
            toggleCitations(e);
          }
        });
      }

      const disclaimerEl = html`<div class="disclaimer"></div>`;
      if (disclaimerLink) {
        const resp = await fetch(`${disclaimerLink}.plain.html`);
        if (resp.ok) {
          const disclaimerText = await resp.text();
          disclaimerEl.append(html`${disclaimerText}`);
        }
      }

      answerEl = html`
    <div class="generated-answer compendiumcard">
      <div class="title-container"><h3 class="pub-title">${getPlaceholder('Generated answer for you')}</h3><div class="likes">${thumbsUpEl} ${thumbsDownEl}</div></div>
      <p class="pub-subtitle" aria-live="polite">
        ${finalAnswer}
      </p>
      <div class="chin">
        <div class="genai-controls">
          ${copyButtonEl}|
          ${regenButtonEl}|
          ${sourcesEl}
          ${announceEl}
        </div>
        ${disclaimerEl}
      </div>
      ${citationsContainerEl}
    </div>`;
      blockEl.innerHTML = '';
      blockEl.append(answerEl);
    });
  }
}

export default async function decorate(blockEl) {
  await renderGeneratedAnswer(blockEl);
}
