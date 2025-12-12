export default async function decorate(blockEl) {
  blockEl.closest('.unlockpersonalized-container').classList.add('hide', 'logged-in');
}
