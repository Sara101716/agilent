import { jest } from '@jest/globals';
import { decorateColumnTiles } from '../../../blocks/columns/columns-tile.js';

describe('columns-tile', () => {
  describe('decorateColumnTiles', () => {
    let block;
    let headerSection;
    let mediaQueryList;
    let changeHandler;

    beforeEach(() => {
      // Set up DOM structure
      document.body.innerHTML = `
        <div class="section">
          <div class="default-content-wrapper">
            <p><a href="#">View All</a></p>
          </div>
          <div class="block">
            <div>
              <div>First cell content</div>
            </div>
            <div>
              <div>Last cell content</div>
            </div>
          </div>
        </div>
      `;

      headerSection = document.querySelector('.section');
      block = headerSection.querySelector('.block');

      // Mock matchMedia
      mediaQueryList = {
        matches: false,
        addEventListener: jest.fn((event, handler) => {
          changeHandler = handler;
        }),
      };

      window.matchMedia = jest.fn().mockImplementation(() => mediaQueryList);
    });

    afterEach(() => {
      document.body.innerHTML = '';
      jest.resetAllMocks();
    });

    test('should add event listener for viewport changes', () => {
      decorateColumnTiles(block);
      expect(mediaQueryList.addEventListener).toHaveBeenCalledWith('change', expect.any(Function));
    });

    test('should handle desktop viewport correctly', () => {
      mediaQueryList.matches = false;
      decorateColumnTiles(block);

      const lastCell = block.querySelector(':scope > div:last-child > div:last-child');
      expect(lastCell.innerHTML).toBe('Last cell content');
      expect(lastCell.className).toBe('');
    });

    test('should handle tablet/mobile viewport correctly', () => {
      mediaQueryList.matches = true;
      decorateColumnTiles(block);

      const lastCell = block.querySelector(':scope > div:last-child > div:last-child');
      expect(lastCell.className).toBe('columns-tile-cta');
      expect(lastCell.querySelector('a')).not.toBeNull();
    });

    test('should handle viewport change from desktop to mobile', () => {
      mediaQueryList.matches = false;
      decorateColumnTiles(block);

      const lastCell = block.querySelector(':scope > div:last-child > div:last-child');
      expect(lastCell.innerHTML).toBe('Last cell content');

      // Simulate viewport change
      mediaQueryList.matches = true;
      changeHandler();

      expect(lastCell.className).toBe('columns-tile-cta');
      expect(lastCell.querySelector('a')).not.toBeNull();
    });

    test('should handle viewport change from mobile to desktop', () => {
      mediaQueryList.matches = true;
      decorateColumnTiles(block);

      const lastCell = block.querySelector(':scope > div:last-child > div:last-child');
      expect(lastCell.className).toBe('columns-tile-cta');

      // Simulate viewport change
      mediaQueryList.matches = false;
      changeHandler();

      expect(lastCell.innerHTML).toBe('Last cell content');
    });

    test('should handle missing viewAllLink gracefully', () => {
      // Remove the viewAllLink element
      headerSection.querySelector('.default-content-wrapper').remove();

      mediaQueryList.matches = true;
      decorateColumnTiles(block);

      const lastCell = block.querySelector(':scope > div:last-child > div:last-child');
      expect(lastCell.className).toBe('columns-tile-cta');
      expect(lastCell.innerHTML).toBe('');
    });
  });
});
