export function serviceFormTemplate(serviceFormContent, submitButtonEl = null) {
  const seen = new Set();
  const dropdownItems = [];

  serviceFormContent.items.forEach((item) => {
    const tempDiv = document.createElement('div');
    tempDiv.innerHTML = item;

    const paragraphs = tempDiv.querySelectorAll('p');
    paragraphs.forEach((p) => {
      if (p.textContent.toLowerCase().includes('submit')) {
        p.remove();
      }
    });

    const textContent = tempDiv.textContent.toLowerCase();
    if (!textContent.includes('hide')) {
      dropdownItems.push(tempDiv.innerHTML);
    }
  });

  if (dropdownItems.length === 0) return '';

  const optionsData = dropdownItems
    .map((item) => {
      const tempDiv = document.createElement('div');
      tempDiv.innerHTML = item;
      const a = tempDiv.querySelector('a');
      let text;
      let link;
      let isSubmitButton = false;

      if (a) {
        text = a.textContent.trim();
        link = a.href;
      } else {
        text = tempDiv.textContent.trim();
        link = '';

        if (text.toLowerCase().includes('submit') || text.toLowerCase().includes('submit')) {
          isSubmitButton = true;
        }
      }

      if (seen.has(text)) return null;
      seen.add(text);
      return { text, link, isSubmitButton };
    })
    .filter(Boolean);

  return `
    <form class="agt__form agt-input_wrapper agt-input_wrapper">
      <div class="agt-form__container">
        <div class="agt-dropdown">
          <div class="agt-dropdown__selected agt-input agt-input--large agt__form-select" role="combobox" aria-labelledby="find-resources" tabindex="0" aria-haspopup="listbox" aria-expanded="false">
            <span class="agt-dropdown__selected-text">${
  optionsData[0]?.text
}</span>
            <span class="icon icon-chevron-right">
              <svg width="7" height="12" viewBox="0 0 7 13" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
                <path d="M1 11.3125L6 6.3125L1 1.3125" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"></path>
              </svg>
            </span>
          </div>
          <ul class="agt-dropdown__list" role="listbox" tabindex="-1" hidden aria-label="Resource Dropdown">
            ${optionsData
    .map(
      (opt, idx) => {
        if (opt.isSubmitButton) return '';
        return `
                  <li class="agt-dropdown__option" role="option" data-link="${opt.link}" data-index="${idx}">${opt.text}</li>`;
      },
    )
    .join('')}
          </ul>
        </div> 
      </div>
      <button type="submit" class="${submitButtonEl ? submitButtonEl.className : 'agt-button'}">
        ${submitButtonEl ? submitButtonEl.textContent : ''}
      </button>
    </form>
  `;
}
