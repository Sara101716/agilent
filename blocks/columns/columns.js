import { loadCSS, setBlockToOverflowViewportWidth } from '../../scripts/aem.js';

export default async function decorate(block) {
  const cols = [...block.firstElementChild.children];
  block.classList.add(`columns-${cols.length}-cols`);

  // setup image columns
  [...block.children].forEach((row) => {
    [...row.children].forEach((col) => {
      const pic = col.querySelector('picture');
      if (pic) {
        const picWrapper = pic.closest('div');
        if (picWrapper && picWrapper.children.length === 1) {
          // picture is only content in column
          picWrapper.classList.add('columns-img-col');
        }
      }
    });
  });

  const mobileQuery = window.matchMedia('(max-width: 768px)');
  if (mobileQuery) {
    const columnsXS = document.querySelector('.columns-xs');
    if (columnsXS) {
      columnsXS.setAttribute('aria-hidden', window.innerWidth <= 767);
    }
  }

  const columnCarousel = block.classList.contains('column-carousel');
  if (columnCarousel) {
    const { decorateColumnCarousel } = await import('./column-carousel.js');
    decorateColumnCarousel(block);
    loadCSS('/blocks/columns/column-carousel.css');
  }

  const isColumnTile = block.classList.contains('columns-tile');
  if (isColumnTile) {
    const { decorateColumnTiles } = await import('./columns-tile.js');
    decorateColumnTiles(block);
    loadCSS('/blocks/columns/columns-tile.css');
    setBlockToOverflowViewportWidth(block, { viewports: ['mobile'] });
  }
}
