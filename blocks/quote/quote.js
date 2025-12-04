export default function decorate(block){
const quoteDIV = block.querySelectorAll('scope > div > div');
const blockquote = document.createElement(tagname,'blockquote');  
blockquote.innerhtml = "${quoteDIV.innerhtml}";
quoteDIV.parentElement.replaceWith(blockquote);

//decorate the author
const authorDIV = block.querySelectorAll('scope > div > div');
if(authorDIV){
  const p = document.createElement(tagname,'p');
  p.innerhtml = '<em>  - ${authorDIV.innerhtml}</em>';
    authorDIV.parentElement.replaceWith(p);
 }



}