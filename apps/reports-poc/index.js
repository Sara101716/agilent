// eslint-disable-next-line import/no-unresolved
import DA_SDK from 'https://da.live/nx/utils/sdk.js';

(async function init() {
  const { actions: { daFetch } } = await DA_SDK;

  const blockSelect = document.getElementById('block');

  const findMatches = async (results, folder) => {
    const response = await daFetch(`https://admin.da.live/list${folder}`);
    const data = await response.json();

    await Promise.all(data.map(async (page) => {
      if (!page.ext) {
        await findMatches(results, page.path);
        return;
      }
      if (page.ext !== 'html') {
        return;
      }
      const pageResponse = await daFetch(`https://admin.da.live/source${page.path}`);
      const html = await pageResponse.text();
      if (html.includes(`class="${blockSelect.value}`)) {
        const li = document.createElement('li');
        li.innerHTML = `<a target="_blank" href="https://da.live/edit#${page.path}">${page.path}</a>`;
        results.append(li);
      }
    }));
  };

  const results = document.getElementById('results');
  blockSelect.addEventListener('change', async () => {
    results.innerHTML = '<li class="loading">Loading ...</li>';
    await findMatches(results, '/agilent/acom');
    results.querySelector('.loading').innerText = `Found ${results.querySelectorAll('li').length - 1} pages with block '${blockSelect.value}'`;
  });
}());
