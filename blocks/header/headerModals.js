import {
  getPlaceholder,
  loadEnvConfig,
  decorateIcons,
  handleMyaAnchors,
} from '../../scripts/aem.js';

export function showPageSpinner() {
  let spinner = document.querySelector('.loading-overlay');
  if (!spinner) {
    spinner = document.createElement('div');
    spinner.className = 'loading-overlay';
    const circle = document.createElement('div');
    circle.className = 'spinner-circle';
    spinner.appendChild(circle);
    document.body.appendChild(spinner);
  }
  spinner.classList.add('visible');
}

export function hidePageSpinner() {
  const spinner = document.querySelector('.spinner-circle');
  if (spinner) spinner.remove();
}

export async function buildPPSModalHtml() {
  document.getElementById('pps-modal')?.remove();
  const config = await loadEnvConfig();
  const ppsContractURL = `${config.ppsContractURL}`;
  const ppsmodalhtml = `
    <div class="modal pps-popup" id="pps-modal" tabindex="-1" role="dialog" aria-labelledby="myModalLabel" aria-hidden="false">
        <div class="modal-dialog">
            <div class="modal-content">
                <div class="modal-header">
                    <h3 class="modal-title">${getPlaceholder('PPSModalTitle')}</h3>
                    <div id="rememberClose" class="closePopupPPS alert-close close-btn" data-dismiss="modal" aria-hidden="true"></div>
                </div>
                <div class="modal-container">
                    <div id="content">
                        <div class="description">${getPlaceholder('PPSModalDescription')}</div>
                        <div class="ok-section">
                            <button type="button" data-dismiss="modal" class="brow-site close-btn">${getPlaceholder('PPSContinueCTALabel')}</button>
                            <a href=${ppsContractURL} class="agt-button goToPPS">${getPlaceholder('PPSCTALabel')}</a>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    </div>`;
  document.body.insertAdjacentHTML('beforeend', ppsmodalhtml);
  const closeButton = document.querySelector('.closePopupPPS');
  closeButton.classList.add('alert-close');
  closeButton.setAttribute('role', 'button');
  closeButton.setAttribute('aria-label', await getPlaceholder('close'));
  closeButton.setAttribute('tabindex', '0');
  const icon = document.createElement('span');
  icon.classList.add('icon', 'icon-close');
  closeButton.appendChild(icon);
  decorateIcons(closeButton);
  setTimeout(() => {
    const modal = document.getElementById('pps-modal');
    const closeBtns = modal?.querySelectorAll('.close-btn');
    if (closeBtns?.length) {
      closeBtns.forEach((btn) => {
        btn.addEventListener('click', () => {
          modal?.remove();
        });
      });
    }
  }, 50);
}

export function displayPPSModal() {
  buildPPSModalHtml();
  setTimeout(() => {
    const modal = document.getElementById('pps-modal');
    if (modal) modal.style.display = 'block';
  }, 500);
}

export async function buildMsModalHtml(
  stdata,
  OKTUID,
  cookieSoldTo,
  defaultSoldToId,
  setNewSoldTo,
) {
  if (document.getElementById('msold-modal')) {
    document.querySelector('.loading-overlay').classList.add('visible');
    document.getElementById('msold-modal').classList.add('show');
    return;
  }

  const soldToSeeAll = await getPlaceholder('SoldToSeeAll');
  const soldToDefaultLabel = await getPlaceholder('SoldToDefault');
  const soldToTitle = await getPlaceholder('SoldToTitle');
  const soldToDescription = await getPlaceholder('SoldToDescription');
  const soldToManageLocations = await getPlaceholder('SoldToManageLocations');
  const soldToDone = await getPlaceholder('SoldToDone');
  const manageLocationLink = (await loadEnvConfig()).manageLocationUrl;

  const seeAllHtml = stdata.soldToId.length > 3
    ? `<span class="ms-seeall"><a>${soldToSeeAll}</a></span>`
    : '';

  const radioListHtml = stdata.soldToId.map((item, q) => {
    const isDefault = item.id === stdata.defaultSoldTo;
    const hideClass = q >= 3 ? 'hide-item' : '';
    return `
      <li class="${isDefault ? 'default-list' : ''} ${hideClass}">
        ${isDefault ? `<div class="default-label">${soldToDefaultLabel}</div>` : ''}
        <input type="radio" id="soldto-${q}" name="soldList" value="${item.id}" ${isDefault ? 'checked' : ''}>
        <label for="soldto-${q}">
          ${getPlaceholder('SoldTo', item.id)}
          ${item.friendlyName ? ` - <span class="friendly-name">${item.friendlyName}</span>` : ''}
        </label>
      </li>
    `;
  }).join('');

  const msmodalhtml = `
    <div class="modal msold-popup" id="msold-modal">
      <div class="modal-dialog">
        <div class="modal-content soldToDialog">
          <div class="modal-header">
            <h3 class="modal-title">${soldToTitle}</h3>
            <div class="close-popup-mst alert-close" role="button" aria-label="close" tabindex="0"></div>
          </div>
          <form id="soldToForm">
            <div class="modal-body">
              <div class="description">${soldToDescription}</div>
              <div class="sold-to-list">
                <ul>
                  ${radioListHtml}
                </ul>
              </div>
            </div>
            <div class="modal-footer">
              <p>${seeAllHtml}<span class="manage-location"><a href="${manageLocationLink}">${soldToManageLocations}</a></span></p>
              <p class="soldto-submit-wrapper"><button type="submit" class="btn-stnd-medium doneBtn">${soldToDone}</button></p>
            </div>
          </form>
        </div>
      </div>
    </div>
  `;

  document.body.insertAdjacentHTML('beforeend', msmodalhtml);

  const closeButton = document.querySelector('.close-popup-mst');
  closeButton.classList.add('alert-close');
  closeButton.setAttribute('role', 'button');
  closeButton.setAttribute('aria-label', await getPlaceholder('close'));
  closeButton.setAttribute('tabindex', '0');
  const icon = document.createElement('span');
  icon.classList.add('icon', 'icon-close');
  closeButton.appendChild(icon);
  decorateIcons(closeButton);

  setTimeout(() => {
    const modal = document.getElementById('msold-modal');
    if (modal) {
      modal.classList.add('show');
    }

    const seeAllBtn = document.querySelector('.ms-seeall');
    if (seeAllBtn) {
      seeAllBtn.addEventListener('click', () => {
        document.querySelector('#soldToForm .modal-body').classList.add('show-all');
        document.querySelectorAll('.sold-to-list li').forEach((li) => {
          li.style.display = 'block';
        });
        seeAllBtn.style.display = 'none';
      });
    }

    closeButton.addEventListener('click', () => {
      modal.remove();
      document.querySelector('.loading-overlay').classList.remove('visible');
    });

    const form = document.getElementById('soldToForm');
    form.addEventListener('submit', (e) => {
      e.preventDefault();
      const selectedInput = form.querySelector("input[name='soldList']:checked");
      const defaultInput = form.querySelector('.default-list input');
      const selected = selectedInput ? selectedInput.value : defaultSoldToId;
      const defaultVal = defaultInput ? defaultInput.value : defaultSoldToId;
      if (selected === defaultVal) {
        modal.classList.remove('show');
        document.querySelector('.loading-overlay').classList.remove('visible');
      } else if (typeof setNewSoldTo === 'function') {
        setNewSoldTo(selected, OKTUID, defaultSoldToId);
      }
    });

    handleMyaAnchors(document);
  }, 50);
}
