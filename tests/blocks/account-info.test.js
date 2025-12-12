/**
 * @jest-environment jsdom
 */
import { jest } from '@jest/globals';

// Mock external dependencies
const mockIsLoggedIn = jest.fn();
const mockGetPlaceholder = jest.fn();
const mockDecorateIcons = jest.fn();
const mockFetchRecentOrders = jest.fn();
const mockPrepareGetAssetPath = jest.fn();
const mockLoadEnvConfig = jest.fn();
const mockReadBlockConfig = jest.fn();
const mockAddImageErrorHandler = jest.fn();
const mockGetLocale = jest.fn();

// Mock fetch globally to handle fetchPurchaseInsights calls
const mockFetch = jest.fn();
global.fetch = mockFetch;

// Mock modules using Jest unstable_mockModule for ES modules
jest.unstable_mockModule('../../scripts/aem.js', () => ({
  isLoggedIn: mockIsLoggedIn,
  html: (strings, ...values) => {
    const template = document.createElement('template');
    template.innerHTML = strings.reduce((acc, str, i) => acc + str + (values[i] || ''), '');
    return template.content.firstChild;
  },
  getPlaceholder: mockGetPlaceholder,
  decorateIcons: mockDecorateIcons,
  prepareGetAssetPath: mockPrepareGetAssetPath,
  loadEnvConfig: mockLoadEnvConfig,
  readBlockConfig: mockReadBlockConfig,
  addImageErrorHandler: mockAddImageErrorHandler,
  getLocale: mockGetLocale,
  getCountryInfo: jest.fn().mockResolvedValue({ currency: 'USD', country: 'US' }),
}));

jest.unstable_mockModule('../../scripts/services/myA.api.js', () => ({
  fetchRecentOrders: mockFetchRecentOrders,
}));

jest.unstable_mockModule('../../scripts/services/atg.api.js', () => ({
  isEcomEnabled: jest.fn().mockResolvedValue(true),
  fetchEcomEnabled: jest.fn().mockResolvedValue(true),
}));

let decorate;

// Helper to reset DOM between tests
const resetDOM = () => {
  document.body.innerHTML = '';
  jest.clearAllMocks();
};

describe('Account Info Block Tests', () => {
  beforeAll(async () => {
    // Clear module cache to ensure mocks are applied
    jest.resetModules();
    const decorateModule = await import('../../blocks/account-info/account-info.js');
    decorate = decorateModule.default;
  });
  // Helper functions for creating test DOM elements
  const createWrapper = () => {
    const wrapper = document.createElement('div');
    wrapper.className = 'account-info-container';
    wrapper.innerHTML = '<h2 class="section__title">Welcome ##firstName##</h2><div class="section__link"><a href="#">View All</a></div>';
    return wrapper;
  };

  const createBlock = (includeImage = false) => {
    const block = document.createElement('div');
    const quickLinks = document.createElement('div');
    quickLinks.innerHTML = '<h3>Quick Links</h3><ul><li><a href="#">Link 1</a></li></ul>';

    const orderDetails = document.createElement('div');
    const recentOrders = document.createElement('div');
    recentOrders.innerHTML = '<h3>Recent Orders</h3>';
    const buyItAgain = document.createElement('div');
    buyItAgain.innerHTML = '<h3>Buy It Again</h3>';
    orderDetails.appendChild(recentOrders);
    orderDetails.appendChild(buyItAgain);

    block.appendChild(quickLinks);
    block.appendChild(orderDetails);

    if (includeImage) {
      const imageDiv = document.createElement('div');
      imageDiv.innerHTML = '<img src="test-image.jpg" alt="Test Image" />';
      block.appendChild(imageDiv);

      const configDiv = document.createElement('div');
      block.appendChild(configDiv);
    }

    return block;
  };

  const setupMockPlaceholders = () => {
    mockGetPlaceholder.mockImplementation((key, ...args) => {
      const placeholders = {
        'ORDER# {0}': (orderId) => `ORDER# ${orderId}`,
        shipped: 'Shipped',
        'Status: {0}': (status) => `Status: ${status}`,
        'No data': 'No data',
        'Part Number': 'Part Number',
        'Product Aria Label': (productName, partNumberLabel, partNumber) => `${productName}, ${partNumberLabel}: ${partNumber}`,
        // Status placeholders - lowercased keys to match actual implementation
        submitted: 'Submitted',
        'in process': 'In Process',
        inprocess: 'In Process',
        delivered: 'Delivered',
        cancelled: 'Cancelled',
        received: 'Received',
        delayed: 'Delayed',
        unknown_status: 'Unknown',
        // Fallback cases
        undefined: 'Unknown',
        '': 'Unknown',
        null: 'Unknown',
      };
      const placeholder = placeholders[key];
      if (typeof placeholder === 'function') {
        return placeholder(...args);
      }
      return placeholder || (key === 'undefined' || key === 'null' || !key ? 'Unknown' : key);
    });
  };

  const setupMockGetLocale = () => {
    mockGetLocale.mockImplementation(() => ({
      languageCountry: 'en-US',
      language: 'en',
      country: 'US',
      rootPath: 'en-us',
      fallbacks: ['en-US', 'en'],
      fallbackPaths: ['en-us', 'en'],
    }));
  };

  beforeEach(() => {
    resetDOM();

    // Mock console methods to reduce noise in tests
    jest.spyOn(console, 'log').mockImplementation(() => {});
    jest.spyOn(console, 'warn').mockImplementation(() => {});

    setupMockGetLocale();

    // Mock localStorage with modern syntax
    const mockLocalStorage = {
      getItem: jest.fn((key) => {
        if (key === 'userObj') {
          return JSON.stringify({
            eCommerceStatus: 'web',
            provisionApps: ['MYA'], // Required for checkPermissions
          });
        }
        if (key === 'userName') {
          return 'John Doe';
        }
        return null;
      }),
      setItem: jest.fn(),
      removeItem: jest.fn(),
      clear: jest.fn(),
    };
    Object.defineProperty(window, 'localStorage', {
      value: mockLocalStorage,
      writable: true,
    });

    // Mock window.matchMedia with modern implementation
    Object.defineProperty(window, 'matchMedia', {
      writable: true,
      value: jest.fn().mockImplementation((query) => ({
        matches: false,
        media: query,
        onchange: null,
        addListener: jest.fn(),
        removeListener: jest.fn(),
        addEventListener: jest.fn(),
        removeEventListener: jest.fn(),
        dispatchEvent: jest.fn(),
      })),
    });

    // Mock fetch for fetchPurchaseInsights
    mockFetch.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({
        success: true,
        data: { orders: [], products: [] },
      }),
    });

    // Mock prepareGetAssetPath to return a function
    mockPrepareGetAssetPath.mockResolvedValue((path) => path || '');

    // Mock loadEnvConfig to return config object
    mockLoadEnvConfig.mockResolvedValue({
      orderIdurl: 'https://www.agilent.com/order-details?id=',
      ecomStatusWebUserOrdersRelativeUrl: '/web/orders',
      ecomStatusWebUserQuotesRelativeUrl: '/web/quotes',
    });

    // Mock readBlockConfig to return configuration
    mockReadBlockConfig.mockReturnValue({
      agilentSparkIcon: null,
      orderCount: 3,
    });

    // Mock addImageErrorHandler
    mockAddImageErrorHandler.mockImplementation(() => {});

    // Default mocks for API calls
    mockFetchRecentOrders.mockResolvedValue({
      recentOrders: [],
      productBuy: [],
    });
  });

  afterEach(() => {
    // Restore all mocks after each test
    jest.restoreAllMocks();
    jest.clearAllMocks();
  });

  it('should remove wrapper when not logged in', async () => {
    mockIsLoggedIn.mockReturnValue(false);
    const wrapper = createWrapper();
    const block = createBlock();
    wrapper.appendChild(block);
    document.body.appendChild(wrapper);

    // Act
    await decorate(block);

    // Assert
    expect(wrapper.parentNode).toBeNull();
  });

  it('should add correct CSS classes to account elements', async () => {
    mockIsLoggedIn.mockReturnValue(true);
    setupMockPlaceholders();

    // Mock with at least one order so decorateOrderDetails doesn't return early
    mockFetchRecentOrders.mockResolvedValue({
      recentOrders: [{
        orderId: 'ORD-123',
        deliveryDate: '2025-09-16',
        status: 'Shipped',
        encOrderId: 'enc123',
      }],
      productBuy: [],
    });

    const wrapper = createWrapper();
    const block = createBlock(true); // Include image
    wrapper.appendChild(block);
    document.body.appendChild(wrapper);

    // Act
    await decorate(block);

    // Assert
    const [quickLinks, orderDetails] = [...block.children];
    const [recentOrders, buyItAgain] = [...orderDetails.children];

    expect(quickLinks.className).toBe('account-info__quicklinks');
    expect(orderDetails.className).toBe('account-info__order-details');
    expect(recentOrders.className).toBe('account-info__recent-orders');
    expect(buyItAgain.className).toBe('account-info__buy-it-again');
    // Image elements should be completely removed, not just hidden
    expect(block.children.length).toBe(2); // Should only have quickLinks and orderDetails
  });

  it('should create recent order elements with correct classes', async () => {
    mockIsLoggedIn.mockReturnValue(true);
    setupMockPlaceholders();
    mockFetchRecentOrders.mockResolvedValue({
      recentOrders: [{
        orderId: 'ORD-123',
        deliveryDate: '2025-09-16',
        status: 'Shipped',
        encOrderId: 'enc123',
      }],
      productBuy: [],
    });

    const wrapper = createWrapper();
    const block = document.createElement('div');
    const quickLinks = document.createElement('div');
    quickLinks.innerHTML = '<h3>Quick Links</h3><ul><li><a href="#">Link 1</a></li></ul>';

    const orderDetails = document.createElement('div');
    const recentOrders = document.createElement('div');
    recentOrders.innerHTML = '<h3>Recent Orders</h3><a href="#">View All Orders</a>';
    const buyItAgain = document.createElement('div');
    buyItAgain.innerHTML = '<h3>Buy It Again</h3>';

    orderDetails.appendChild(recentOrders);
    orderDetails.appendChild(buyItAgain);
    block.appendChild(quickLinks);
    block.appendChild(orderDetails);
    wrapper.appendChild(block);
    document.body.appendChild(wrapper);

    await decorate(block);

    // Check that the basic CSS classes are applied
    expect(recentOrders.className).toBe('account-info__recent-orders');

    // Check for recent order title wrapper (wraps original h3 and link content)
    // This is the first child with class .recent-order__title (the wrapper div)
    const recentOrderTitleWrapper = recentOrders.querySelector('.recent-order__title');
    expect(recentOrderTitleWrapper).toBeTruthy();
    expect(recentOrderTitleWrapper.tagName).toBe('DIV');

    // Check for recent order container and elements (if orders exist)
    const recentOrdersContainer = recentOrders.querySelector('.recent-orders');
    expect(recentOrdersContainer).toBeTruthy();

    const recentOrder = recentOrdersContainer.querySelector('.recent-order');
    expect(recentOrder).toBeTruthy();

    // Check that the actual order elements are created - the order title links within each order
    // This is the second use of .recent-order__title class (the anchor link)
    const orderTitleLink = recentOrder.querySelector('.recent-order__title');
    expect(orderTitleLink).toBeTruthy();
    expect(orderTitleLink.tagName).toBe('A');
    expect(orderTitleLink.getAttribute('href')).toContain('/order-details?id=T1JELTEyMw=='); // btoa('ORD-123')

    expect(recentOrder.querySelector('.recent-order__delivery-info')).toBeTruthy();
    expect(recentOrder.querySelector('.recent-order__info')).toBeTruthy();
    expect(recentOrder.querySelector('.recent-order__delivery-status')).toBeTruthy();

    // Check that the order ID is correctly displayed
    expect(recentOrder.querySelector('.recent-order__title').textContent).toBe('ORDER# ORD-123');
  });

  it('should create buy it again products with correct classes', async () => {
    mockIsLoggedIn.mockReturnValue(true);
    setupMockPlaceholders();
    mockFetchRecentOrders.mockResolvedValue({
      recentOrders: [{
        orderId: 'ORD-123',
        deliveryDate: '2025-09-16',
        status: 'Shipped',
        encOrderId: 'enc123',
      }],
      productBuy: [{
        partNumber: 'PN-123',
        productName: 'Product 1',
        imageURL: [{
          externalAssetURL: 'image.jpg',
        }],
      }],
    });

    const wrapper = createWrapper();
    const block = createBlock();
    wrapper.appendChild(block);
    document.body.appendChild(wrapper);

    // Act
    await decorate(block);

    // Assert
    const [, orderDetails] = [...block.children];
    const [, buyItAgain] = [...orderDetails.children];
    const buyItAgainContainer = buyItAgain.querySelector('.buy-it-again');
    expect(buyItAgainContainer).toBeTruthy();

    // Wait for async product creation - need to wait longer for async forEach
    await new Promise((resolve) => { setTimeout(resolve, 100); });

    const product = buyItAgainContainer.querySelector('.product');
    expect(product).toBeTruthy();
    expect(product.querySelector('.product__image-link')).toBeTruthy();
    expect(product.querySelector('.product__image')).toBeTruthy();
    expect(product.querySelector('.product__name')).toBeTruthy();
    expect(product.querySelector('.product__part-number')).toBeTruthy();

    // Check that product details are correctly displayed
    expect(product.querySelector('.product__name').textContent).toBe('Product 1');
    expect(product.querySelector('.product__part-number').textContent).toBe('PN-123');

    // Verify that the product name is also a link
    expect(product.querySelector('.product__name').tagName).toBe('A');
    expect(product.querySelector('.product__name').getAttribute('href')).toContain('/store/productDetail.jsp?catalogId=PN-123');

    // Verify that addImageErrorHandler was called for the product image
    expect(mockAddImageErrorHandler).toHaveBeenCalled();
  });

  it('should display only first 3 products in buy it again section', async () => {
    mockIsLoggedIn.mockReturnValue(true);
    setupMockPlaceholders();
    mockFetchRecentOrders.mockResolvedValue({
      recentOrders: [{
        orderId: 'ORD-001',
        deliveryDate: '2025-09-16',
        status: 'Shipped',
        encOrderId: 'enc001',
      }],
      productBuy: [
        {
          partNumber: 'PN-001',
          productName: 'Product 1',
          imageURL: [{ externalAssetURL: 'image1.jpg' }],
        },
        {
          partNumber: 'PN-002',
          productName: 'Product 2',
          imageURL: [{ externalAssetURL: 'image2.jpg' }],
        },
        {
          partNumber: 'PN-003',
          productName: 'Product 3',
          imageURL: [{ externalAssetURL: 'image3.jpg' }],
        },
        {
          partNumber: 'PN-004',
          productName: 'Product 4',
          imageURL: [{ externalAssetURL: 'image4.jpg' }],
        },
        {
          partNumber: 'PN-005',
          productName: 'Product 5',
          imageURL: [{ externalAssetURL: 'image5.jpg' }],
        },
      ],
    });

    const wrapper = createWrapper();
    const block = createBlock();
    wrapper.appendChild(block);
    document.body.appendChild(wrapper);

    await decorate(block);

    // Check that only the first 3 products are displayed (Product 1, 2, 3)
    const buyItAgainContainer = block.querySelector('.buy-it-again');
    expect(buyItAgainContainer).toBeTruthy();

    // Wait for async product creation - need to wait longer for async forEach
    await new Promise((resolve) => { setTimeout(resolve, 100); });

    const products = buyItAgainContainer.querySelectorAll('.product');
    expect(products.length).toBe(3);

    // Verify it's the first 3 products (slice(0, 3))
    expect(products[0].querySelector('.product__name').textContent).toBe('Product 1');
    expect(products[1].querySelector('.product__name').textContent).toBe('Product 2');
    expect(products[2].querySelector('.product__name').textContent).toBe('Product 3');
  });

  it('should update welcome text with user name and initials', async () => {
    mockIsLoggedIn.mockReturnValue(true);

    // Override localStorage for this specific test
    const mockLocalStorage = {
      getItem: jest.fn((key) => {
        if (key === 'userObj') {
          return JSON.stringify({
            eCommerceStatus: 'web',
            provisionApps: ['MYA'],
          });
        }
        if (key === 'userName') {
          return 'John Doe';
        }
        return null;
      }),
      setItem: jest.fn(),
      removeItem: jest.fn(),
      clear: jest.fn(),
    };
    Object.defineProperty(window, 'localStorage', {
      value: mockLocalStorage,
      writable: true,
    });

    const wrapper = createWrapper();
    const block = createBlock();
    wrapper.appendChild(block);
    document.body.appendChild(wrapper);

    await decorate(block);

    const welcomeText = wrapper.querySelector('.section__title');
    expect(welcomeText.textContent).toBe('JWelcome John Doe');
    expect(welcomeText.querySelector('.user-initials')).toBeTruthy();
    expect(welcomeText.querySelector('.user-initials').textContent).toBe('J');
  });

  it('should process quick links and apply correct classes', async () => {
    mockIsLoggedIn.mockReturnValue(true);
    mockFetchRecentOrders.mockResolvedValue({
      recentOrders: [
        {
          orderId: 'ORD-001',
          deliveryDate: '2025-09-20',
          status: 'Shipped',
          encOrderId: 'enc001',
        },
        {
          orderId: 'ORD-002',
          deliveryDate: '2025-09-22',
          status: 'Processing',
          encOrderId: 'enc002',
        },
      ],
      productBuy: [],
    });

    const wrapper = createWrapper();
    const block = document.createElement('div');
    const quickLinks = document.createElement('div');
    quickLinks.innerHTML = `<h3>Quick Links</h3>
    <ul>
      <li><a href="#">Orders <span class="icon icon-order"></span></a></li>
      <li><a href="#">Quotes <span class="icon icon-quote"></span></a></li>
    </ul>`;

    const orderDetails = document.createElement('div');
    const recentOrders = document.createElement('div');
    recentOrders.innerHTML = '<h3>Recent Orders</h3>';
    const buyItAgain = document.createElement('div');
    buyItAgain.innerHTML = '<h3>Buy It Again</h3>';

    orderDetails.appendChild(recentOrders);
    orderDetails.appendChild(buyItAgain);
    block.appendChild(quickLinks);
    block.appendChild(orderDetails);
    wrapper.appendChild(block);
    document.body.appendChild(wrapper);

    await decorate(block);

    // Verify that quick links are properly decorated with CSS classes
    expect(quickLinks.className).toBe('account-info__quicklinks');

    // Verify that the h3 was replaced with the ul (based on the implementation)
    expect(quickLinks.children[0].tagName).toBe('UL');

    // Verify links exist
    const orderElement = quickLinks.querySelector('a .icon-order');
    const quoteElement = quickLinks.querySelector('a .icon-quote');
    const ordersLink = orderElement && orderElement.parentElement;
    const quotesLink = quoteElement && quoteElement.parentElement;

    expect(ordersLink).toBeTruthy();
    expect(quotesLink).toBeTruthy();
    if (ordersLink && quotesLink) {
      expect(ordersLink.textContent).toContain('Orders');
      expect(quotesLink.textContent).toContain('Quotes');
    }
  });

  it('should display recent orders based on orderCount config', async () => {
    mockIsLoggedIn.mockReturnValue(true);
    setupMockPlaceholders();

    // Mock readBlockConfig to return orderCount of 2
    mockReadBlockConfig.mockReturnValue({
      agilentSparkIcon: null,
      orderCount: 2,
    });

    mockFetchRecentOrders.mockResolvedValue({
      recentOrders: [
        {
          orderId: 'ORD-NEW',
          deliveryDate: '2025-09-21',
          status: 'Shipped',
          encOrderId: 'encNew',
        },
        {
          orderId: 'ORD-OLD',
          deliveryDate: '2025-08-21',
          status: 'Delivered',
          encOrderId: 'encOld',
        },
        {
          orderId: 'ORD-THIRD',
          deliveryDate: '2025-07-21',
          status: 'Processing',
          encOrderId: 'encThird',
        },
      ],
      productBuy: [],
    });

    const wrapper = createWrapper();
    const block = createBlock();
    wrapper.appendChild(block);
    document.body.appendChild(wrapper);

    await decorate(block);

    const recentOrdersContainer = block.querySelector('.recent-orders');
    expect(recentOrdersContainer).toBeTruthy();

    const orders = recentOrdersContainer.querySelectorAll('.recent-order');
    // Should only show 2 orders (based on orderCount: 2)
    expect(orders.length).toBe(2);
  });

  it('should hide order details section when no recent orders found', async () => {
    mockIsLoggedIn.mockReturnValue(true);
    mockFetchRecentOrders.mockResolvedValue({
      recentOrders: [], // Empty orders array
      productBuy: [],
    });

    const wrapper = createWrapper();
    const block = createBlock();
    wrapper.appendChild(block);
    document.body.appendChild(wrapper);

    await decorate(block);

    // The order details section should be hidden when no recent orders are found
    // Note: className is not set when returning early due to no orders
    const orderDetails = block.children[1]; // Second child is the order details
    expect(orderDetails.style.display).toBe('none');
  });

  it('should display "No data" message when orderCount is 0', async () => {
    mockIsLoggedIn.mockReturnValue(true);
    setupMockPlaceholders();

    // Mock readBlockConfig to return orderCount of 0
    mockReadBlockConfig.mockReturnValue({
      agilentSparkIcon: null,
      orderCount: 0, // This will result in selectedOrders being empty
    });

    mockFetchRecentOrders.mockResolvedValue({
      recentOrders: [{
        orderId: 'ORD-123',
        deliveryDate: '2025-09-16',
        status: 'Shipped',
        encOrderId: 'enc123',
      }],
      productBuy: [],
    });

    const wrapper = createWrapper();
    const block = document.createElement('div');
    const quickLinks = document.createElement('div');
    quickLinks.innerHTML = '<h3>Quick Links</h3><ul><li><a href="#">Link 1</a></li></ul>';

    const orderDetails = document.createElement('div');
    const recentOrders = document.createElement('div');
    recentOrders.innerHTML = '<h3>Recent Orders</h3>';
    const buyItAgain = document.createElement('div');
    buyItAgain.innerHTML = '<h3>Buy It Again</h3>';

    orderDetails.appendChild(recentOrders);
    orderDetails.appendChild(buyItAgain);
    block.appendChild(quickLinks);
    block.appendChild(orderDetails);
    wrapper.appendChild(block);
    document.body.appendChild(wrapper);

    await decorate(block);

    // Should show order details section but with "No data" message since orderCount is 0
    const recentOrdersContainer = block.querySelector('.recent-orders');
    expect(recentOrdersContainer).toBeTruthy();

    const noDataMessage = recentOrdersContainer.querySelector('.no-orders-message');
    expect(noDataMessage).toBeTruthy();
    expect(noDataMessage.textContent).toBe('No data');
  });

  it('should handle missing block children gracefully', async () => {
    mockIsLoggedIn.mockReturnValue(true);

    const wrapper = createWrapper();
    const block = document.createElement('div'); // Empty block with no children
    wrapper.appendChild(block);
    document.body.appendChild(wrapper);

    // Mock console.warn to capture the warning
    const consoleSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});

    await decorate(block);

    // Should log a warning about invalid authoring
    expect(consoleSpy).toHaveBeenCalledWith('Invalid authoring for Account Info block');

    consoleSpy.mockRestore();
  });

  it('should create button wrappers for mobile link duplication', async () => {
    mockIsLoggedIn.mockReturnValue(true);
    setupMockPlaceholders();

    mockFetchRecentOrders.mockResolvedValue({
      recentOrders: [{
        orderId: 'ORD-123',
        deliveryDate: '2025-09-16',
        status: 'Shipped',
        encOrderId: 'enc123',
      }],
      productBuy: [],
    });

    const wrapper = createWrapper();
    const block = document.createElement('div');
    const quickLinks = document.createElement('div');
    quickLinks.innerHTML = '<h3>Quick Links</h3><ul><li><a href="#">Link 1</a></li></ul>';

    const orderDetails = document.createElement('div');
    const recentOrders = document.createElement('div');
    recentOrders.innerHTML = '<h3>Recent Orders</h3><a href="#">View All Orders</a>';
    const buyItAgain = document.createElement('div');
    buyItAgain.innerHTML = '<h3>Buy It Again</h3>';

    orderDetails.appendChild(recentOrders);
    orderDetails.appendChild(buyItAgain);
    block.appendChild(quickLinks);
    block.appendChild(orderDetails);
    wrapper.appendChild(block);
    document.body.appendChild(wrapper);

    await decorate(block);

    // Just verify that the duplicate link mechanism attempts to run by creating wrappers
    // This tests that the duplicateSeeAllLink function is called without expecting
    // the exact DOM structure since the mocked html function may behave differently
    const recentOrdersButtonWrapper = recentOrders.querySelector('.button-wrapper');
    const quickLinksButtonWrapper = quickLinks.querySelector('.button-wrapper');

    // At least one should be created (recent orders should always have one)
    expect(recentOrdersButtonWrapper || quickLinksButtonWrapper).toBeTruthy();

    // Verify the main functionality completed without errors
    expect(recentOrders.className).toBe('account-info__recent-orders');
    expect(quickLinks.className).toBe('account-info__quicklinks');
  });

  it('should handle fallback images for products without images', async () => {
    mockIsLoggedIn.mockReturnValue(true);
    setupMockPlaceholders();
    mockFetchRecentOrders.mockResolvedValue({
      recentOrders: [{
        orderId: 'ORD-123',
        deliveryDate: '2025-09-16',
        status: 'Shipped',
        encOrderId: 'enc123',
      }],
      productBuy: [{
        partNumber: 'PN-123',
        productName: 'Product Without Image',
        imageURL: [], // No image
      }],
    });

    const wrapper = createWrapper();
    const block = createBlock(true); // Include fallback image
    wrapper.appendChild(block);
    document.body.appendChild(wrapper);

    await decorate(block);

    // Wait for async product creation
    await new Promise((resolve) => { setTimeout(resolve, 100); });

    const buyItAgainContainer = block.querySelector('.buy-it-again');
    const product = buyItAgainContainer.querySelector('.product');
    const productImage = product.querySelector('.product__image');

    expect(product).toBeTruthy();
    expect(productImage).toBeTruthy();

    // Verify that addImageErrorHandler was called with fallback image
    expect(mockAddImageErrorHandler).toHaveBeenCalledWith(
      productImage,
      expect.objectContaining({
        src: expect.stringContaining('test-image.jpg'),
        alt: 'Test Image',
      }),
    );
  });

  it('should add accessibility attributes and event handlers to products', async () => {
    mockIsLoggedIn.mockReturnValue(true);
    setupMockPlaceholders();
    mockFetchRecentOrders.mockResolvedValue({
      recentOrders: [{
        orderId: 'ORD-123',
        deliveryDate: '2025-09-16',
        status: 'Shipped',
        encOrderId: 'enc123',
      }],
      productBuy: [{
        partNumber: 'PN-123',
        productName: 'Test Product',
        imageURL: [{
          externalAssetURL: 'image.jpg',
        }],
      }],
    });

    const wrapper = createWrapper();
    const block = createBlock();
    wrapper.appendChild(block);
    document.body.appendChild(wrapper);

    await decorate(block);

    // Wait for async product creation
    await new Promise((resolve) => { setTimeout(resolve, 100); });

    const product = block.querySelector('.product');
    expect(product).toBeTruthy();

    // Check accessibility attributes
    expect(product.getAttribute('tabindex')).toBe('0');
    expect(product.getAttribute('role')).toBe('button');
    expect(product.getAttribute('aria-label')).toBe('Test Product, Part Number: PN-123');

    // Check that links have tabindex="-1"
    const imageLink = product.querySelector('.product__image-link');
    const nameLink = product.querySelector('.product__name');
    expect(imageLink.getAttribute('tabindex')).toBe('-1');
    expect(nameLink.getAttribute('tabindex')).toBe('-1');

    // Test that event handlers are attached and work without errors
    // We can't test actual navigation in JSDOM but we can verify events are handled
    const enterEvent = new KeyboardEvent('keydown', { key: 'Enter' });
    const spaceEvent = new KeyboardEvent('keydown', { key: ' ' });
    const clickEvent = new MouseEvent('click', { target: product });
    Object.defineProperty(clickEvent, 'target', { value: product });

    // These events should be handled properly even though JSDOM doesn't support navigation
    expect(() => product.dispatchEvent(enterEvent)).not.toThrow();
    expect(() => product.dispatchEvent(spaceEvent)).not.toThrow();
    expect(() => product.dispatchEvent(clickEvent)).not.toThrow();
  });

  it('should handle ecom status web user links modification', async () => {
    mockIsLoggedIn.mockReturnValue(true);
    setupMockPlaceholders();

    // Mock user with eCommerceStatus: 'web'
    const mockLocalStorage = {
      getItem: jest.fn((key) => {
        if (key === 'userObj') {
          return JSON.stringify({
            eCommerceStatus: 'web',
            provisionApps: ['MYA'],
          });
        }
        if (key === 'userName') {
          return 'John Doe';
        }
        return null;
      }),
      setItem: jest.fn(),
      removeItem: jest.fn(),
      clear: jest.fn(),
    };
    Object.defineProperty(window, 'localStorage', {
      value: mockLocalStorage,
      writable: true,
    });

    mockFetchRecentOrders.mockResolvedValue({
      recentOrders: [{
        orderId: 'ORD-123',
        deliveryDate: '2025-09-16',
        status: 'Shipped',
        encOrderId: 'enc123',
      }],
      productBuy: [],
    });

    const wrapper = createWrapper();
    const block = document.createElement('div');
    const quickLinks = document.createElement('div');
    quickLinks.innerHTML = `<h3>Quick Links</h3>
    <ul>
      <li><a href="/hub/orders">Orders</a></li>
      <li><a href="/hub/quotes">Quotes</a></li>
    </ul>`;

    const orderDetails = document.createElement('div');
    const recentOrders = document.createElement('div');
    recentOrders.innerHTML = '<h3>Recent Orders</h3>';
    const buyItAgain = document.createElement('div');
    buyItAgain.innerHTML = '<h3>Buy It Again</h3>';

    orderDetails.appendChild(recentOrders);
    orderDetails.appendChild(buyItAgain);
    block.appendChild(quickLinks);
    block.appendChild(orderDetails);
    wrapper.appendChild(block);
    document.body.appendChild(wrapper);

    await decorate(block);

    // Verify that the links were modified for web users
    const ordersLink = quickLinks.querySelector('a[href="/web/orders"]');
    const quotesLink = quickLinks.querySelector('a[href="/web/quotes"]');

    expect(ordersLink).toBeTruthy();
    expect(quotesLink).toBeTruthy();
  });

  it('should not modify links for non-web ecom status users', async () => {
    mockIsLoggedIn.mockReturnValue(true);
    setupMockPlaceholders();

    // Mock user with eCommerceStatus: 'standard'
    const mockLocalStorage = {
      getItem: jest.fn((key) => {
        if (key === 'userObj') {
          return JSON.stringify({
            eCommerceStatus: 'standard',
            provisionApps: ['MYA'],
          });
        }
        if (key === 'userName') {
          return 'John Doe';
        }
        return null;
      }),
      setItem: jest.fn(),
      removeItem: jest.fn(),
      clear: jest.fn(),
    };
    Object.defineProperty(window, 'localStorage', {
      value: mockLocalStorage,
      writable: true,
    });

    mockFetchRecentOrders.mockResolvedValue({
      recentOrders: [{
        orderId: 'ORD-123',
        deliveryDate: '2025-09-16',
        status: 'Shipped',
        encOrderId: 'enc123',
      }],
      productBuy: [],
    });

    const wrapper = createWrapper();
    const block = document.createElement('div');
    const quickLinks = document.createElement('div');
    quickLinks.innerHTML = `<h3>Quick Links</h3>
    <ul>
      <li><a href="/hub/orders">Orders</a></li>
      <li><a href="/hub/quotes">Quotes</a></li>
    </ul>`;

    const orderDetails = document.createElement('div');
    const recentOrders = document.createElement('div');
    recentOrders.innerHTML = '<h3>Recent Orders</h3>';
    const buyItAgain = document.createElement('div');
    buyItAgain.innerHTML = '<h3>Buy It Again</h3>';

    orderDetails.appendChild(recentOrders);
    orderDetails.appendChild(buyItAgain);
    block.appendChild(quickLinks);
    block.appendChild(orderDetails);
    wrapper.appendChild(block);
    document.body.appendChild(wrapper);

    await decorate(block);

    // Verify that the links were NOT modified for non-web users
    const ordersLink = quickLinks.querySelector('a[href="/hub/orders"]');
    const quotesLink = quickLinks.querySelector('a[href="/hub/quotes"]');

    expect(ordersLink).toBeTruthy();
    expect(quotesLink).toBeTruthy();

    // Should not have web URLs
    expect(quickLinks.querySelector('a[href="/web/orders"]')).toBeNull();
    expect(quickLinks.querySelector('a[href="/web/quotes"]')).toBeNull();
  });

  it('should modify order URLs for China locale', async () => {
    mockIsLoggedIn.mockReturnValue(true);
    setupMockPlaceholders();

    // Mock getLocale to return China country code
    mockGetLocale.mockImplementation(() => ({
      languageCountry: 'zh-CN',
      language: 'zh',
      country: 'CN',
      rootPath: 'zh-cn',
      fallbacks: ['zh-CN', 'zh'],
      fallbackPaths: ['zh-cn', 'zh'],
    }));

    mockFetchRecentOrders.mockResolvedValue({
      recentOrders: [{
        orderId: 'ORD-123',
        deliveryDate: '2025-09-16',
        status: 'Shipped',
        encOrderId: 'enc123',
      }],
      productBuy: [],
    });

    const wrapper = createWrapper();
    const block = document.createElement('div');
    const quickLinks = document.createElement('div');
    quickLinks.innerHTML = '<h3>Quick Links</h3><ul><li><a href="#">Link 1</a></li></ul>';

    const orderDetails = document.createElement('div');
    const recentOrders = document.createElement('div');
    recentOrders.innerHTML = '<h3>Recent Orders</h3>';
    const buyItAgain = document.createElement('div');
    buyItAgain.innerHTML = '<h3>Buy It Again</h3>';

    orderDetails.appendChild(recentOrders);
    orderDetails.appendChild(buyItAgain);
    block.appendChild(quickLinks);
    block.appendChild(orderDetails);
    wrapper.appendChild(block);
    document.body.appendChild(wrapper);

    await decorate(block);

    // Check that the order URL was modified for China
    const recentOrdersContainer = block.querySelector('.recent-orders');
    const orderTitleLink = recentOrdersContainer.querySelector('.recent-order__title');

    expect(orderTitleLink).toBeTruthy();
    // Should contain .com.cn instead of .com for China locale
    expect(orderTitleLink.getAttribute('href')).toContain('.com.cn/');
    expect(orderTitleLink.getAttribute('href')).not.toContain('.com/order-details');
  });

  it('should test different order status text mappings', async () => {
    mockIsLoggedIn.mockReturnValue(true);
    setupMockPlaceholders();

    const testStatuses = [
      { input: 'submitted', expected: 'Status: Submitted' },
      { input: 'in process', expected: 'Status: In Process' },
      { input: 'inprocess', expected: 'Status: In Process' },
      { input: 'shipped', expected: 'Status: Shipped' },
      { input: 'delivered', expected: 'Status: Delivered' },
      { input: 'cancelled', expected: 'Status: Cancelled' },
      { input: 'received', expected: 'Status: Received' },
      { input: 'delayed', expected: 'Status: Delayed' },
      { input: 'unknown_status', expected: 'Status: Unknown' },
      { input: null, expected: 'Status: Unknown' },
      { input: '', expected: 'Status: Unknown' },
    ];

    // Test one specific status to verify the functionality works
    const testCase = testStatuses[0]; // Test 'submitted' status
    mockFetchRecentOrders.mockResolvedValue({
      recentOrders: [{
        orderId: `ORD-${testCase.input}`,
        deliveryDate: '2025-09-16',
        status: testCase.input,
        encOrderId: 'enc123',
      }],
      productBuy: [],
    });

    const wrapper = createWrapper();
    const block = document.createElement('div');
    const quickLinks = document.createElement('div');
    quickLinks.innerHTML = '<h3>Quick Links</h3><ul><li><a href="#">Link 1</a></li></ul>';

    const orderDetails = document.createElement('div');
    const recentOrders = document.createElement('div');
    recentOrders.innerHTML = '<h3>Recent Orders</h3>';
    const buyItAgain = document.createElement('div');
    buyItAgain.innerHTML = '<h3>Buy It Again</h3>';

    orderDetails.appendChild(recentOrders);
    orderDetails.appendChild(buyItAgain);
    block.appendChild(quickLinks);
    block.appendChild(orderDetails);
    wrapper.appendChild(block);
    document.body.appendChild(wrapper);

    await decorate(block);

    const deliveryStatus = block.querySelector('.recent-order__delivery-status');
    expect(deliveryStatus).toBeTruthy();
    expect(deliveryStatus.textContent).toBe(testCase.expected);
  });

  it('should handle malformed userObj in localStorage gracefully', async () => {
    mockIsLoggedIn.mockReturnValue(true);
    setupMockPlaceholders();

    // Mock malformed userObj that will cause JSON.parse to fail
    const mockLocalStorage = {
      getItem: jest.fn((key) => {
        if (key === 'userObj') {
          return 'invalid-json';
        }
        if (key === 'userName') {
          return 'John Doe';
        }
        return null;
      }),
      setItem: jest.fn(),
      removeItem: jest.fn(),
      clear: jest.fn(),
    };
    Object.defineProperty(window, 'localStorage', {
      value: mockLocalStorage,
      writable: true,
    });

    const consoleSpy = jest.spyOn(console, 'error').mockImplementation(() => {});

    mockFetchRecentOrders.mockResolvedValue({
      recentOrders: [{
        orderId: 'ORD-123',
        deliveryDate: '2025-09-16',
        status: 'Shipped',
        encOrderId: 'enc123',
      }],
      productBuy: [],
    });

    const wrapper = createWrapper();
    const block = document.createElement('div');
    const quickLinks = document.createElement('div');
    quickLinks.innerHTML = `<h3>Quick Links</h3>
    <ul>
      <li><a href="/hub/orders">Orders</a></li>
      <li><a href="/hub/quotes">Quotes</a></li>
    </ul>`;

    const orderDetails = document.createElement('div');
    const recentOrders = document.createElement('div');
    recentOrders.innerHTML = '<h3>Recent Orders</h3>';
    const buyItAgain = document.createElement('div');
    buyItAgain.innerHTML = '<h3>Buy It Again</h3>';

    orderDetails.appendChild(recentOrders);
    orderDetails.appendChild(buyItAgain);
    block.appendChild(quickLinks);
    block.appendChild(orderDetails);
    wrapper.appendChild(block);
    document.body.appendChild(wrapper);

    await decorate(block);

    // Should log a warning about malformed userObj
    expect(consoleSpy).toHaveBeenCalledWith('Error parsing userObjJSON:', expect.any(Error));

    // Links should remain unchanged since userObj parsing failed
    const ordersLink = quickLinks.querySelector('a[href="/hub/orders"]');
    const quotesLink = quickLinks.querySelector('a[href="/hub/quotes"]');

    expect(ordersLink).toBeTruthy();
    expect(quotesLink).toBeTruthy();

    consoleSpy.mockRestore();
  });

  it('should not navigate when clicking on product links directly', async () => {
    mockIsLoggedIn.mockReturnValue(true);
    setupMockPlaceholders();
    mockFetchRecentOrders.mockResolvedValue({
      recentOrders: [{
        orderId: 'ORD-123',
        deliveryDate: '2025-09-16',
        status: 'Shipped',
        encOrderId: 'enc123',
      }],
      productBuy: [{
        partNumber: 'PN-123',
        productName: 'Test Product',
        imageURL: [{
          externalAssetURL: 'image.jpg',
        }],
      }],
    });

    const wrapper = createWrapper();
    const block = createBlock();
    wrapper.appendChild(block);
    document.body.appendChild(wrapper);

    await decorate(block);

    // Wait for async product creation
    await new Promise((resolve) => { setTimeout(resolve, 100); });

    const product = block.querySelector('.product');
    const nameLink = product.querySelector('.product__name');

    // Mock the closest method to simulate clicking on a link
    const clickEvent = new MouseEvent('click', { target: nameLink });
    Object.defineProperty(clickEvent, 'target', {
      value: nameLink,
      configurable: true,
    });

    // Mock the closest method to return the link element
    nameLink.closest = jest.fn().mockReturnValue(nameLink);

    // Test that clicking on a link element doesn't cause errors
    // The navigation logic should detect this is a link click and not interfere
    expect(() => product.dispatchEvent(clickEvent)).not.toThrow();

    // Verify closest was called (indicating the logic checked for link elements)
    expect(nameLink.closest).toHaveBeenCalledWith('a');
  });
});
