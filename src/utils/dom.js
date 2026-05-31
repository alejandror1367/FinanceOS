// utils/dom.js — helpers mínimos de DOM. Sin dependencias.

// Crea un elemento. attrs admite: class, html, text, dataset, on:{evt:fn}, y atributos sueltos.
export function el(tag, attrs = {}, children = []) {
  const node = document.createElement(tag);
  for (const [key, value] of Object.entries(attrs)) {
    if (value == null || value === false) continue;
    if (key === 'class') node.className = value;
    else if (key === 'html') node.innerHTML = value;
    else if (key === 'text') node.textContent = value;
    else if (key === 'dataset') Object.assign(node.dataset, value);
    else if (key === 'on') for (const [evt, fn] of Object.entries(value)) node.addEventListener(evt, fn);
    else if (key === 'style' && typeof value === 'object') Object.assign(node.style, value);
    else node.setAttribute(key, value === true ? '' : value);
  }
  const kids = Array.isArray(children) ? children : [children];
  for (const child of kids) {
    if (child == null || child === false) continue;
    node.append(child.nodeType ? child : document.createTextNode(String(child)));
  }
  return node;
}

// Reemplaza el contenido de un contenedor.
export function mount(container, ...nodes) {
  container.replaceChildren(...nodes.filter(Boolean));
  return container;
}

export const $ = (sel, root = document) => root.querySelector(sel);
export const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));
