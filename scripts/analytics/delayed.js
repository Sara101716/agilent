import { pushToDataLayer } from '../aem.js';

const getLinkClickData = (link) => ({
  event: 'link-clicked',
  eventInfo: {
    type: 'link clicked',
  },
  xdm: {
    webInteraction: {
      name: link.textContent.trim(),
      type: '',
      region: '',
      content: {
        id: '',
        type: '',
        publicationNumber: '',
        publicationDate: '',
        format: '',
      },
    },
    component: {
      uniqueID: '',
      name: '',
      type: '',
      product: {
        id: '',
        name: '',
        price: '',
        tilePosition: '',
      },
    },
  },
});
const trackAllLinkClicks = () => {
  const links = document.querySelectorAll('a[href]:not([href^="#"]):not([href^="javascript:"]):not([data-no-track])');

  links.forEach((link) => {
    link.addEventListener('click', (event) => {
      const eventData = getLinkClickData(event.target);
      pushToDataLayer(eventData);
    });
  });
};

export default function registerDelayedAnalyticsEvents() {
  trackAllLinkClicks();
}
