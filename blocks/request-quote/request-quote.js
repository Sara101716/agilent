import {
  getPlaceholder,
} from '../../scripts/aem.js';

const injectRfqModalHTML = (block) => {
  if (!block.querySelector('#search-eloqua-modal')) {
    const modalWrapper = document.createElement('div');
    modalWrapper.innerHTML = `
      <div class="rfq-modal-overlay" id="rfq-modal-overlay" hidden></div>
      <div class="rfq-modal" id="search-eloqua-modal" role="dialog" aria-modal="true" hidden>
        <div class="rfq-modal-content">
          <div class="rfq-modal-header">
            <h4 class="rfq-modal-title">${getPlaceholder('Request Quote')}</h4>
            <button class="rfq-modal-close" aria-label="Close">&times;</button>
          </div>
          <div class="rfq-modal-body">
            <iframe id="rfq-iframe" name="rfq-iframe" src="" frameborder="0"></iframe>
          </div>
        </div>
      </div>
    `;
    block.appendChild(modalWrapper);
  }
};

const closeModal = (block) => {
  const modal = block.querySelector('#search-eloqua-modal');
  const overlay = block.querySelector('#rfq-modal-overlay');
  if (modal) modal.setAttribute('hidden', true);
  if (overlay) overlay.setAttribute('hidden', true);
  block.style.overflow = '';
};

const bindRfqModalTriggers = (block) => {
  block.addEventListener('click', (e) => {
    const trigger = e.target.closest('.rfq-modal-trigger');
    if (trigger) {
      e.preventDefault();
      const dataURL = trigger.getAttribute('data-eloqua-url');
      if (!dataURL) return;

      const modal = block.querySelector('#search-eloqua-modal');
      const overlay = block.querySelector('#rfq-modal-overlay');
      const iframe = block.querySelector('#rfq-iframe');

      iframe.src = '';
      iframe.setAttribute('aria-busy', 'true');

      iframe.onload = () => {
        iframe.removeAttribute('aria-busy');
      };

      iframe.src = dataURL;

      modal.removeAttribute('hidden');
      overlay.removeAttribute('hidden');
      block.style.overflow = 'hidden';
    }
  });

  block.addEventListener('click', (e) => {
    if (
      e.target.matches('.rfq-modal-close')
      || e.target.matches('#rfq-modal-overlay')
    ) {
      closeModal(block);
    }
  });

  block.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      closeModal(block);
    }
  });
};

const setupRfqModal = (block) => {
  injectRfqModalHTML(block);
  bindRfqModalTriggers(block);
};

export default async function decorate(block) {
  const requestQuoteUrl = block.getAttribute('requestQuoteUrl') || '';
  const productId = block.getAttribute('productId') || '';

  if (requestQuoteUrl.includes('explore.agilent.com')) {
    block.innerHTML = `<a class="agt-button agt-button--secondary rfq-modal-trigger"
          href="javascript:void(0);"
          data-eloqua-url="${requestQuoteUrl}"
          data-ag-button="requestQuote">
          ${getPlaceholder('Request Quote')}
        </a>`;
  } else if (requestQuoteUrl.includes('requestQuote.jsp')) {
    const partNumber = productId;
    const qty = '1';
    const desc = productId;

    const uniqueId = `quoteForm-${partNumber}-${Math.random().toString(36).substr(2, 9)}`;

    block.innerHTML = `
      <a 
        href="#" 
        class="agt-button agt-button--secondary"
        data-ag-button="requestQuote"
        data-form-id="${uniqueId}"
      >
        ${getPlaceholder('Request Quote')}
      </a>

      <form 
        id="${uniqueId}" 
        action="${requestQuoteUrl}" 
        method="POST" 
        style="display:none;"
      >
        <input type="hidden" name="partNumber" value="${partNumber}">
        <input type="hidden" name="${partNumber}Qty" value="${qty}">
        <input type="hidden" name="${partNumber}Desc" value="${desc}">
      </form>
    `;

    // Attach a click listener to this block's link
    const link = block.querySelector('[data-ag-button="requestQuote"]');
    if (link) {
      link.addEventListener('click', (event) => {
        event.preventDefault();
        const formId = link.getAttribute('data-form-id');
        const form = document.getElementById(formId);
        if (form) form.submit();
      });
    }
  } else {
    block.innerHTML = `<a class="agt-button agt-button--secondary"
        href="${requestQuoteUrl}"
        data-ag-button="requestQuote">
        ${getPlaceholder('Request Quote')}
      </a>
    `;
  }
  setupRfqModal(block);
}
