export function handleFormSubmit(event) {
  event.preventDefault();

  const selectedLi = event.target.querySelector(
    '.agt-dropdown__option[data-selected="true"]',
  );
  const link = selectedLi?.dataset.link;

  if (link) {
    const currentDomain = window.location.hostname;
    const linkUrl = new URL(link, window.location.href);

    if (linkUrl.hostname === currentDomain) {
      window.location.href = linkUrl.href;
    } else {
      window.open(linkUrl.href, '_blank');
    }
  }
}

export function setupCustomDropdown(form) {
  const dropdown = form.querySelector('.agt-dropdown');
  const selectedBtn = dropdown.querySelector('.agt-dropdown__selected');
  const selectedText = dropdown.querySelector('.agt-dropdown__selected-text');
  const list = dropdown.querySelector('.agt-dropdown__list');
  const options = Array.from(list.querySelectorAll('.agt-dropdown__option'));

  let currentIndex = 0;

  if (options.length) {
    options[0].setAttribute('data-selected', 'true');
  }

  const openDropdown = () => {
    list.hidden = false;
    selectedBtn.setAttribute('aria-expanded', 'true');
    options[currentIndex].focus();
  };

  const closeDropdown = () => {
    list.hidden = true;
    selectedBtn.setAttribute('aria-expanded', 'false');
  };

  const updateSelection = (index) => {
    options.forEach((o) => o.removeAttribute('data-selected'));
    options[index].setAttribute('data-selected', 'true');
    selectedText.textContent = options[index].textContent;
    currentIndex = index;
  };

  selectedBtn.addEventListener('click', () => {
    const expanded = selectedBtn.getAttribute('aria-expanded') === 'true';
    selectedBtn.setAttribute('aria-expanded', String(!expanded));
    list.hidden = expanded;
  });

  selectedBtn.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' || e.key === 'ArrowDown') {
      e.preventDefault();
      openDropdown();
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      openDropdown();
      currentIndex = (currentIndex - 1 + options.length) % options.length;
      options[currentIndex].focus();
    }
  });

  options.forEach((opt, index) => {
    opt.setAttribute('tabindex', '0');

    opt.addEventListener('click', () => {
      updateSelection(index);
      closeDropdown();
    });

    opt.addEventListener('keydown', (e) => {
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        currentIndex = (index + 1) % options.length;
        options[currentIndex].focus();
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        currentIndex = (index - 1 + options.length) % options.length;
        options[currentIndex].focus();
      } else if (e.key === 'Enter') {
        e.preventDefault();
        updateSelection(index);
        closeDropdown();
        selectedBtn.focus();
      } else if (e.key === 'Escape') {
        e.preventDefault();
        closeDropdown();
        selectedBtn.focus();
      }
    });
  });

  document.addEventListener('click', (e) => {
    if (!dropdown.contains(e.target)) {
      closeDropdown();
    }
  });
}

const form = document.querySelector('.agt__form');
if (form) {
  form.addEventListener('submit', handleFormSubmit);
  setupCustomDropdown(form);
}
