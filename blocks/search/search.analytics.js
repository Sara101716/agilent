import { pushToDataLayer } from '../../scripts/aem.js';

export const trackSearchEvent = (siteSearch) => {
  pushToDataLayer({
    event: 'search-requested',
    eventInfo: {
      type: 'agilent.search.request',
    },
    xdm: { siteSearch },
  });
};
