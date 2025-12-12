import {
  html,
  getPlaceholder,
  toCamelCase,
  loadIcon,
} from '../../../scripts/aem.js';
import {
  getCommerceController,
} from '../../../scripts/coveo/headless/commerce/index.js';
import {
  getContentController,
} from '../../../scripts/coveo/headless/index.js';

function buildSortOptions(sort, block, availableSorts, checkIcon, isActive) {
  const idx = Math.random().toString(36).substring(2, 9);
  const sel = block.querySelector('select');

  const wrap = document.createElement('div');
  wrap.className = 'cselect';
  wrap.style.minWidth = getComputedStyle(sel).minWidth;

  const btn = document.createElement('button');
  btn.type = 'button';
  btn.className = 'cselect__button';
  btn.id = `cselect-btn-${idx}`;
  btn.setAttribute('aria-controls', `cselect-list-${idx}`);
  btn.setAttribute('role', 'combobox');
  btn.setAttribute('aria-haspopup', 'listbox');
  btn.setAttribute('aria-expanded', 'false');
  wrap.appendChild(btn);

  const list = document.createElement('ul');
  list.className = 'cselect__list';
  list.id = `cselect-list-${idx}`;
  list.setAttribute('role', 'listbox');
  list.setAttribute('tabindex', '-1');

  const getOptions = () => list.querySelectorAll('.cselect__option');

  let activeIndex = -1;
  const setActiveIndex = (i) => {
    const opts = getOptions();
    const target = opts[i];
    if (!target) return;
    opts.forEach((el, iidxx) => {
      if (iidxx === i) {
        el.classList.add('active');
        list.setAttribute('aria-activedescendant', target.id);
      } else {
        el.classList.remove('active');
      }
    });
    activeIndex = i;
  };

  const labelEl = document.querySelector(`label[for="${sel.id}"]`) || sel.closest('label');
  let labelText = '';
  if (labelEl) {
    const clone = labelEl.cloneNode(true);
    clone.querySelector('select')?.remove();
    labelText = (clone.textContent || '').trim();
  }

  if (!labelText) labelText = getPlaceholder('Select');

  const updateAriaLabel = () => {
    const current = btn.textContent.trim();
    btn.removeAttribute('aria-labelledby');
    btn.setAttribute('aria-label', `${labelText}, ${getPlaceholder('Option Selected')} '${current}'`);
  };

  let onDocDown;

  const close = () => {
    btn.setAttribute('aria-expanded', 'false');
    document.removeEventListener('mousedown', onDocDown);
    window.removeEventListener('blur', close);
  };

  onDocDown = (e) => {
    if (!wrap.contains(e.target)) close();
  };

  const commitIndex = (i, { closeList = false, silent = false } = {}) => {
    const opts = getOptions();
    const target = opts[i];
    if (!target) return;
    opts.forEach((el, idxx) => {
      if (idxx === i) {
        el.setAttribute('aria-selected', 'true');
        activeIndex = i;
      } else {
        el.removeAttribute('aria-selected');
      }
      list.setAttribute('aria-activedescendant', target.id);
    });

    const text = (() => {
      const clone = target.cloneNode(true);
      clone.querySelectorAll('span').forEach((span) => span.remove());
      return clone.textContent.trim();
    })();

    btn.textContent = text;
    updateAriaLabel();
    sel.selectedIndex = i;
    if (!silent) {
      sort.sortBy(sel.selectedOptions?.[0]?.criterion);
    }
    setActiveIndex(i);

    if (closeList) {
      close();
      if (!silent) {
        btn.focus();
      }
    }
  };

  availableSorts.forEach((criterion, i) => {
    const criterionName = `${criterion.field || criterion.by}${criterion.order ? `+${criterion.order.toLowerCase()}` : ''}`;
    const label = getPlaceholder(`Sort by ${criterionName.replace('+', ' ')}`);
    const opt = html`<option>${label}</option>`;
    opt.criterion = criterion;
    sel.append(opt);

    const checkmark = html`<span class="menu-check" aria-hidden="true">${checkIcon}</span>`;

    const li = document.createElement('li');
    li.className = 'cselect__option';
    li.setAttribute('role', 'option');
    li.id = `cselect-option-${idx}-${i}`;
    li.setAttribute('data-index', i);
    li.setAttribute('aria-label', label);
    li.textContent = opt.text;
    li.append(checkmark);

    li.addEventListener('click', () => commitIndex(i, { closeList: true }));
    list.addEventListener('keydown', (e) => {
      const items = Array.from(list.children);
      const lastIndex = items.length - 1;
      const currentIndex = Number.isInteger(activeIndex) ? activeIndex : sel.selectedIndex;
      const fallbackIndex = Math.min(Math.max(currentIndex ?? 0, 0), lastIndex);
      const activeOption = [...getOptions()].find((option) => option.classList.contains('active'));
      let index;

      switch (e.key) {
        case 'ArrowDown':
          e.preventDefault();
          index = Math.min(lastIndex, fallbackIndex + 1);
          setActiveIndex(index);
          break;

        case 'ArrowUp':
          e.preventDefault();
          index = Math.max(0, fallbackIndex - 1);
          setActiveIndex(index);
          break;

        case 'Home':
          e.preventDefault();
          setActiveIndex(0);
          break;

        case 'End':
          e.preventDefault();
          setActiveIndex(lastIndex);
          break;

        case 'Enter':
        case ' ':
          e.preventDefault();
          activeOption.click();
          break;

        case 'Escape':
          e.preventDefault();
          setActiveIndex(sel.selectedIndex >= 0 ? sel.selectedIndex : 0);
          close();
          btn.focus();
          break;

        case 'Tab':
          setActiveIndex(sel.selectedIndex >= 0 ? sel.selectedIndex : 0);
          close();
          break;

        default:
          break;
      }
    });
    list.appendChild(li);
  });
  wrap.appendChild(list);

  setActiveIndex(activeIndex);

  sel.parentNode.insertBefore(wrap, sel);
  sel.tabIndex = -1;
  sel.setAttribute('aria-hidden', 'true');

  sel.addEventListener('focus', (e) => { e.preventDefault(); btn.focus(); });
  sel.addEventListener('mousedown', (e) => {
    e.preventDefault();
    btn.click();
  });

  const label = block.querySelector(`label[for="${sel.id}"]`) || sel.closest('label');
  if (label) {
    label.addEventListener('click', (e) => {
      if (!wrap.contains(e.target)) {
        e.preventDefault();
        btn.focus();
      }
    });
    if (label.id) {
      btn.setAttribute('aria-labelledby', label.id);
    } else {
      const txt = (label.textContent || '').trim();
      if (txt) btn.setAttribute('aria-label', txt);
    }
  }

  updateAriaLabel();

  if (sel.disabled) wrap.classList.add('is-disabled');

  function open() {
    if (sel.disabled) return;
    btn.setAttribute('aria-expanded', 'true');

    setActiveIndex(sel.selectedIndex >= 0 ? sel.selectedIndex : activeIndex);

    document.addEventListener('mousedown', onDocDown);
    window.addEventListener('blur', close);
  }

  btn.addEventListener('click', () => {
    const expanded = btn.getAttribute('aria-expanded') === 'true';
    if (expanded) {
      close();
    } else {
      open();
    }
  });

  btn.addEventListener('keydown', (e) => {
    const expanded = btn.getAttribute('aria-expanded') === 'true';
    if ([' ', 'Enter', 'ArrowDown', 'ArrowUp'].includes(e.key)) {
      e.preventDefault();
      if (!expanded) {
        open();
        const cur = list.querySelector('[aria-selected="true"]');
        (cur || list.firstElementChild)?.focus?.();
      }
    }
  });

  btn.addEventListener('transitionend', () => {
    if (btn.getAttribute('aria-expanded') === 'true') list.focus();
  });

  const silentUpdate = () => {
    if (!isActive()) {
      return;
    }
    const currentSortIndex = [...sel.options]
      .findIndex((option) => sort.isSortedBy(option.criterion));
    commitIndex(currentSortIndex, { silent: true });
  };
  commitIndex(0, { silent: true });
  sort.subscribe(silentUpdate);
}

export default async function decorate(block) {
  const blockConfig = JSON.parse(block.dataset.config);
  const tabId = block.closest('[data-tab-content]').dataset.tabContent;
  const {
    sort,
    getAvailableSorts,
    tabManager = false,
  } = tabId === 'products'
    ? await getCommerceController() : await getContentController();

  if (blockConfig.sort === 'disabled') {
    block.remove();
    return;
  }

  const checkIcon = await loadIcon('check');

  block.innerHTML = `
    <label class="sort-by-label" for="sort-by"><span>${getPlaceholder('Sort By')}</span>
      <select class="sort-by" name="sort-by"></select>
    </label>
  `;

  buildSortOptions(
    sort,
    block,
    getAvailableSorts(blockConfig),
    checkIcon,
    () => !tabManager || toCamelCase(tabManager.state.activeTab) === tabId,
  );
}
