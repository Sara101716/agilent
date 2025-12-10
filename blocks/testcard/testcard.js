import { createOptimizedPicture } from '../../scripts/aem.js';

export default function decorate(block) {
  /* change to ul, li */
  const ul = document.createElement('ul');
  [...block.children].forEach((row) => {
     [...row.children].forEach((col) => {
    const li = document.createElement('li');
    while (row.firstElementChild) li.append(row.firstElementChild);

    ul.append(li);
    });
  });
 
  block.replaceChildren(ul);
} 
