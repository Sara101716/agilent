export default async function decorate(blockEl) {
  const sections = Array.from(blockEl.children);
  const [icon, title, tips, categories, documents] = sections;

  icon?.classList.add('null-results__icon');
  title?.classList.add('null-results__title');
  tips?.classList.add('null-results__tips');
  categories?.classList.add('null-results__categories');
  documents?.classList.add('null-results__documents');

  title?.setAttribute('role', 'alert');
  if (title) {
    const html = title.innerHTML;
    let updated = html.replace(/“[^”]*”/, (match) => {
      if (match.includes('null-results__keywordline')) return match;
      return `<span class="null-results__keywordline">${match}</span>`;
    });

    if (updated === html) {
      updated = html.replace(/"[^"]*"/, (match) => {
        if (match.includes('null-results__keywordline')) return match;
        return `<span class="null-results__keywordline">${match}</span>`;
      });
    }

    if (updated !== html) {
      title.innerHTML = updated;
    }

    const urlParams = new URLSearchParams(window.location.search);
    const q = urlParams.get('q');
    if (q) {
      const kwEl = title.querySelector('.null-results__keywordline');
      if (kwEl) {
        kwEl.textContent = kwEl.textContent.replace('{keyword}', q);
      }
    }
  }

  const enhanceGroupAccessibility = (container, sectionClass) => {
    if (!container) return;

    const h2 = container.querySelector('h2');
    const list = container.querySelector('ul');
    if (!h2 || !list) return;

    const sectionTitle = h2.textContent.trim();
    const headingId = h2.id || `${sectionClass}-title`;

    h2.id = headingId;

    container.setAttribute('role', 'region');
    container.setAttribute('aria-labelledby', headingId);

    list.setAttribute('role', 'group');
    list.setAttribute('aria-label', sectionTitle);

    list.classList.add('nr-chiplist');
  };

  enhanceGroupAccessibility(categories, 'null-results__categories');
  enhanceGroupAccessibility(documents, 'null-results__documents');
}
