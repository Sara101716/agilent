import { loadEnvConfig } from '../aem.js';

async function fetchRecentOrders() {
  const config = await loadEnvConfig();
  try {
    const response = await fetch(config.recentOrdersEndpoint || '/services/orders', {
      method: 'GET',
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const data = await response.json();
    return data;
  } catch (error) {
    // eslint-disable-next-line no-console
    console.error('Error fetching order data:', error);
    return null;
  }
}

export {
  fetchRecentOrders,
};
