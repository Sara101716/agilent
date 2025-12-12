import { getPlaceholder } from '../../scripts/aem.js';

const BUY_TABLE_COMLUMS = 'columns';
const BUY_TABLE_QTY = 'quantityText';

async function getData() {
  const url = '/drafts/vilash/data/product-data.json';
  try {
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`Response status: ${response.status}`);
    }
    const json = await response.json();

    return json;
  } catch (error) {
    // eslint-disable-next-line no-console
    console.error('failed to load data', error);
  }
  return null;
}

function findLabelTextFromConfig(config, keyText) {
  return config.find(({ key }) => key === keyText);
}

function getBuyTableHeader(configTexts) {
  const label = findLabelTextFromConfig(configTexts, BUY_TABLE_COMLUMS);
  const headerLabel = label ? label.label.split(',') : ['Part Number', 'Description', 'Unit'];

  return `
        <thead>
            <tr>
                <th> ${headerLabel[0]}</th>
                <th> ${headerLabel[1]}</th>
                <th> ${headerLabel[2]}</th>
                <th></th>
            </tr>
        </thead>
    `;
}

function getBuyTableRowItem(configTexts, partNumber, description, longDescription, unit, isEven = '') {
  const qtyLabel = findLabelTextFromConfig(configTexts, BUY_TABLE_QTY);
  const qtyPlaceholder = qtyLabel && qtyLabel.label ? qtyLabel.label : getPlaceholder('Quantity');
  return `
            <tr class=${isEven}>
                <td width="10%">${partNumber}</td>
                <td> ${description}</td>
                <td> ${unit}</td>
                <td width="10%">
                    <input name="1260022" 
                        placeholder="${qtyPlaceholder}"
                        class="form-control translate 1260022" 
                        type="text" 
                        fielddesc="${longDescription}"
                    />
                </td>
            </tr>
            <tr class="description">
                <td width="10%"></td>
                <td colspan="2"> 
                    ${longDescription}
                    <a class="seeMoreDetails" href="/store/productDetail.jsp?catalogId=${partNumber}">See More Details <i class="fa fa-angle-right"></i></a>
                </td>
                <td width="10%"></td>
            </tr>
    `;
}

function getBuyTableContent(productList, configTexts, limit = 12) {
  const tableContent = productList.slice(0, limit).reduce((content, item, index) => {
    const isEven = index % 2 === 0 ? 'even' : '';
    return `${content}${getBuyTableRowItem(
      configTexts,
      item.displayName,
      item.description,
      item.longDescription,
      item.unit,
      isEven,
    )}`;
  }, '');
  return `
        <div class="product-buy-table-summary">
            1 - ${limit} of ${productList.length} results
        </div>
        <table cellspacing="0" class="product-buy-table">
            ${getBuyTableHeader(configTexts)}
            <tbody>
                ${tableContent}
            </tbody>
        </table>
    `;
}

export default async function decorate(block) {
  const blockContent = block.querySelector(':scope > div');
  const configTexts = [...block.children].map((currentNode) => {
    const childNodes = [...currentNode.children];
    return {
      key: childNodes[0].innerText,
      label: childNodes[1].innerText,
    };
  });
  const { productList } = await getData();
  if (productList) {
    const content = getBuyTableContent(productList.data, configTexts);
    blockContent.parentElement.innerHTML = `<div>${content}</div>`;

    const rows = block.querySelectorAll('tbody > tr');
    [...rows].forEach((row) => {
      row.addEventListener('click', (e) => {
        const elem = e.target.parentElement;
        if (e.target !== elem) elem.classList.toggle('show');
      });
    });
  }
}
