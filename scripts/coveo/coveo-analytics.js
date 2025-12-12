import { loadEnvConfig, getLocale } from '../aem.js';
import { getCoveoToken } from './utils.js';
import { createRelay } from './relay/relay.min.js';

const config = await loadEnvConfig();
const coveoEngineConfiguration = JSON.parse(config.coveoCommerceEngineConfiguration);
const locale = getLocale();

const relay = createRelay({
    token: await getCoveoToken(), 
    trackingId: getLocale().country === 'CN' ? 'agilentchina' : 'agilentglobal', 
    url: "https://" + coveoEngineConfiguration.configuration.organizationId + ".analytics.org.coveo.com/rest/organizations/" + coveoEngineConfiguration.configuration.organizationId + "/events/v1", 
});

/**
 * Generic event tracking function for Coveo analytics
 * @param {string} eventName - The event to emit (e.g., "ec.productClick")
 * @param {object} payload - Data for the event
 */
async function trackCoveoEvent(eventName, payload) {
  if (!eventName) {
    return;
  }

  try {
    relay.emit(eventName, payload || {});
  } catch (err) {
    console.error('Failed to emit event:', eventName, err);
  }
}

export {
  trackCoveoEvent,
};
