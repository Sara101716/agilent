import { getMetadata, decorateIcons } from '../../scripts/aem.js';

const truncateQuery = (query) => {
  const isDesktop = window.matchMedia('(min-width: 1025px)');
  if (!isDesktop.matches) {
    const words = query.split(' ');
    if (words.length > 5) {
      const firstThreeWords = words.slice(0, 3).join(' '); // Take the first three words
      const lastWord = words[words.length - 1]; // Take the last word
      const span = document.createElement('span');
      span.classList.add('breadcrumb__tooltip');
      span.setAttribute('data-title', query);
      span.textContent = `${firstThreeWords} ... ${lastWord}`;
      return span.outerHTML;
    }
  }

  if (query.length > 100) {
    const cutoffIndex = query.lastIndexOf(' ', 100);
    const safeIndex = cutoffIndex > -1 ? cutoffIndex : 100;
    const truncatedPart = query.slice(0, safeIndex).trim();
    const remainingPart = query.slice(safeIndex).trim();
    const tooltipContent = remainingPart.split(' ').slice(0, -1).join(' ').trim();
    const truncated = `${truncatedPart} ... ${query.split(' ').pop()}`;
    const span = document.createElement('span');
    span.classList.add('breadcrumb__tooltip');
    span.setAttribute('data-title', tooltipContent);
    span.textContent = truncated;
    return span.outerHTML;
  }

  const cleaned = query.replace(/\+/g, ' ');
  return cleaned.charAt(0).toUpperCase() + cleaned.slice(1);
};

const createBreadcrumbItem = (name, link = null, isActive = false) => {
  const li = document.createElement('li');
  li.classList.add('breadcrumb__item');
  if (isActive) {
    li.classList.add('active');
    li.setAttribute('aria-current', 'page');
    li.textContent = name.replace(/<[^>]*>/g, '');
  } else {
    const a = document.createElement('a');
    a.href = link || '#';
    a.textContent = name;
    li.appendChild(a);
  }
  return li;
};

// Simple event emitter for search query updates
const searchQueryEmitter = {
  listeners: [],
  subscribe(listener) {
    this.listeners.push(listener);
    return () => {
      const index = this.listeners.indexOf(listener);
      if (index > -1) {
        this.listeners.splice(index, 1);
      }
    };
  },
  emit(query) {
    this.listeners.forEach((listener) => listener(query));
  },
};
window.searchQueryEmitter = searchQueryEmitter;

export const updateBreadcrumbQuery = (ol, searchQuery, suggestionClicked) => {
  // Remove existing search query item if it exists
  const existingQueryItem = ol.querySelector('.breadcrumb__item.search-query');
  if (existingQueryItem) {
    existingQueryItem.remove();
  }

  if (searchQuery) {
    const truncatedQuery = truncateQuery(searchQuery);
    const queryItem = createBreadcrumbItem(truncatedQuery, null, true);
    // Only to run when the suggestion is clicked from search
    if (suggestionClicked) {
      ol.querySelector('.breadcrumb__item:last-child').remove();
    }
    ol.appendChild(queryItem);
  } else {
    const lastItem = ol.querySelector('.breadcrumb__item:last-child');
    if (lastItem) {
      const textNode = document.createTextNode(lastItem.textContent);
      lastItem.innerHTML = '';
      lastItem.appendChild(textNode);
      lastItem.classList.add('active');
      lastItem.setAttribute('aria-current', 'page');
    }
  }
};

const decorateSearchQuery = (ol) => {
  // Initial setup with current URL query
  const searchQuery = new URLSearchParams(window.location.search).get('q');
  updateBreadcrumbQuery(ol, searchQuery);

  searchQueryEmitter.subscribe((newQuery) => {
    updateBreadcrumbQuery(ol, newQuery);
  });
};

const addBreadcrumbIcons = (ol) => {
  const items = ol.querySelectorAll('.breadcrumb__item');
  items.forEach((item, index) => {
    if (index < items.length - 1) {
      const icon = document.createElement('span');
      icon.classList.add('icon', 'icon-chevron-right');
      item.appendChild(icon);
    }
  });
  decorateIcons(ol);
};

export default async function decorateBreadcrumb(container) {
  container.innerHTML = '';

  const rawMetadata = getMetadata('breadcrumb');

  if (!rawMetadata) {
    return;
  }

  const metadata = JSON.parse(rawMetadata);

  const nav = document.createElement('nav');
  nav.setAttribute('aria-label', 'breadcrumb');

  const ol = document.createElement('ol');
  ol.classList.add('breadcrumb__list');

  metadata.forEach((item) => {
    const breadcrumbItem = createBreadcrumbItem(item.name, item.link);
    ol.appendChild(breadcrumbItem);
  });

  decorateSearchQuery(ol);
  addBreadcrumbIcons(ol);

  nav.appendChild(ol);
  container.appendChild(nav);
}
