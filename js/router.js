import { el } from './utils/domHelpers.js';
import { createIcon } from './ui/components/icons.js';

/**
 * Minimal hash-based SPA router. Each route maps a path pattern (":id" params
 * supported) to a view module exposing `render(container, params)` and an
 * optional `destroy()` for cleanup. No history-stack bookkeeping beyond what
 * the browser already gives us via location.hash + history.back().
 */

const routes = [];
let els = null; // { header, main, bottomNavRoot, fabRoot }
let currentInstance = null;

export function registerRoute(pattern, view, meta = {}) {
  const keys = [];
  const regexStr = '^' + pattern.replace(/:[^/]+/g, (token) => {
    keys.push(token.slice(1));
    return '([^/]+)';
  }) + '$';
  routes.push({ regex: new RegExp(regexStr), keys, view, meta });
}

function matchPath(path) {
  for (const route of routes) {
    const m = path.match(route.regex);
    if (!m) continue;
    const params = {};
    route.keys.forEach((key, i) => {
      params[key] = decodeURIComponent(m[i + 1]);
    });
    return { route, params };
  }
  return null;
}

function renderHeader(meta) {
  const { header } = els;
  header.innerHTML = '';
  header.style.display = meta.chromeless ? 'none' : 'flex';
  if (meta.chromeless) return;

  if (meta.showBack) {
    header.appendChild(
      el('button', {
        class: 'app-header__back',
        'aria-label': 'Back',
        onclick: () => {
          if (meta.backTo) location.hash = meta.backTo;
          else history.back();
        },
      }, [createIcon('chevronLeft', { size: 22 })])
    );
  }

  header.appendChild(el('div', { class: 'app-header__title' }, [meta.title || 'BillApp']));
  header.appendChild(el('div', { class: 'app-header__actions', id: 'headerActions' }));
}

/** Views can call this after data loads to refine a static route title (e.g. "Invoice #123"). */
export function setHeaderTitle(title) {
  const titleEl = els.header.querySelector('.app-header__title');
  if (titleEl) titleEl.textContent = title;
}

export function getHeaderActionsEl() {
  return els.header.querySelector('#headerActions');
}

export function getFabRootEl() {
  return els.fabRoot;
}

export function navigate(hash) {
  location.hash = hash;
}

async function renderCurrent() {
  const path = (location.hash || '#/home').replace(/^#/, '') || '/home';
  const match = matchPath(path);

  if (!match) {
    location.hash = '#/home';
    return;
  }

  const { route, params } = match;

  if (currentInstance && typeof currentInstance.destroy === 'function') {
    currentInstance.destroy();
  }
  currentInstance = null;

  renderHeader(route.meta);

  els.main.innerHTML = '';
  els.fabRoot.innerHTML = '';
  const screen = el('div', { class: route.meta.chromeless ? 'screen screen--flush' : 'screen' });
  els.main.appendChild(screen);
  els.bottomNavRoot.style.display = route.meta.chromeless ? 'none' : '';
  els.fabRoot.style.display = route.meta.chromeless ? 'none' : '';

  currentInstance = (await route.view.render(screen, params)) || null;
}

export function initRouter(elements) {
  els = elements;
  window.addEventListener('hashchange', renderCurrent);
  renderCurrent();
}
