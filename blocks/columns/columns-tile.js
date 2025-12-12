export function decorateColumnTiles(block) {
  // Define media query for tablet (which includes mobile breakpoints)
  const tabletQuery = window.matchMedia('(max-width: 1392px)');
  const lastCell = block.querySelector(':scope > div:last-child > div:last-child');
  const lastCellContent = lastCell.innerHTML;
  let viewAllLink = null;
  let originalViewAllLink = null;

  try {
    const headerSection = block.closest('.section');
    originalViewAllLink = headerSection.querySelector('.default-content-wrapper p:has(a)');
    if (originalViewAllLink) {
      viewAllLink = originalViewAllLink.cloneNode(true);
    }
  } catch (e) { /* empty */ }

  function handleViewportChange() {
    if (tabletQuery.matches) {
      // Update the last cell for mobile/tablet view
      lastCell.className = 'columns-tile-cta';
      lastCell.innerHTML = '';
      if (viewAllLink) {
        lastCell.appendChild(viewAllLink);
      }
    } else {
      lastCell.innerHTML = lastCellContent;
    }
  }

  handleViewportChange();

  // Add listener for viewport changes - only one needed
  tabletQuery.addEventListener('change', handleViewportChange);
}
