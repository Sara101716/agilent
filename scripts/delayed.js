// add delayed functionality here
import { initializeDataLayer } from './analytics/adobe-data-layer.js';
import { loadBlock, html } from './aem.js';

async function loadDelayedBlocks(blockName) {
  try {
    const main = document.querySelector('main');
    const block = html`<div class="${blockName}" data-block-name="${blockName}" data-block-status="initialized"></div>`;
    main.appendChild(block);
    await loadBlock(block);
  } catch (error) {
    // eslint-disable-next-line no-console
    console.error(`Error loading ${blockName} block:`, error);
  }
}

async function loadAllDelayedBlocks() {
  await loadDelayedBlocks('wechat-floatingbar');
  await loadDelayedBlocks('back-to-top');
}
loadAllDelayedBlocks();
// Initialize Adobe Data Layer in the delayed script
initializeDataLayer();
