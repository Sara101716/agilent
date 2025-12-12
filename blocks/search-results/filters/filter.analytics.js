import { changeSearchAttempt, setSearchPerformedProps } from '../search-results.analytics.js';

export const trackFilterEvents = () => {
  changeSearchAttempt();
  setSearchPerformedProps({ userAction: 'filter', pageNumber: 1 });
};
