export default function decorate(block) {
  // Create a new heading element
const h1 = document.createElement('h3');
 h1.textContent = 'Hello World!';
 
  // Append the new element to the block
  block.append(h1);
}