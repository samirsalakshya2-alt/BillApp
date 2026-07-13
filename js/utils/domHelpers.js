/** Small DOM helpers shared across views/components — kept dependency-free on purpose. */

export function qs(selector, root = document) {
  return root.querySelector(selector);
}

export function qsa(selector, root = document) {
  return Array.from(root.querySelectorAll(selector));
}

/**
 * Build a DOM element without a templating engine.
 * el('button', { class: 'btn', onclick: fn }, ['Save'])
 */
export function el(tag, attrs = {}, children = []) {
  const node = document.createElement(tag);

  for (const [key, value] of Object.entries(attrs || {})) {
    if (value == null || value === false) continue;
    if (key.startsWith('on') && typeof value === 'function') {
      node.addEventListener(key.slice(2).toLowerCase(), value);
    } else if (key === 'class') {
      node.className = value;
    } else if (key === 'dataset') {
      Object.assign(node.dataset, value);
    } else if (key in node) {
      // Some DOM properties (e.g. input.list, input.form) are getter-only —
      // fall back to setAttribute rather than throwing on those.
      try {
        node[key] = value;
      } catch {
        node.setAttribute(key, value);
      }
    } else {
      node.setAttribute(key, value);
    }
  }

  for (const child of [].concat(children)) {
    if (child == null || child === false) continue;
    node.appendChild(typeof child === 'string' ? document.createTextNode(child) : child);
  }

  return node;
}

/** Replace a container's contents with a single node or list of nodes. */
export function mount(container, content) {
  container.innerHTML = '';
  for (const node of [].concat(content)) {
    if (node == null) continue;
    container.appendChild(node);
  }
}

/** Escape untrusted text before inserting via innerHTML (invoice renderer, search highlights, etc). */
export function escapeHtml(str) {
  return String(str ?? '').replace(/[&<>"']/g, (ch) => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;',
  }[ch]));
}

/** Debounce a function by `wait` ms — used for search inputs and draft autosave. */
export function debounce(fn, wait = 300) {
  let timer;
  return (...args) => {
    clearTimeout(timer);
    timer = setTimeout(() => fn(...args), wait);
  };
}
