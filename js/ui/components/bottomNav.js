import { el } from '../../utils/domHelpers.js';
import { createIcon } from './icons.js';

const ITEMS = [
  { id: 'home', label: 'Home', hash: '#/home' },
  { id: 'bills', label: 'Bills', hash: '#/bills' },
  { id: 'reports', label: 'Reports', hash: '#/reports' },
  { id: 'settings', label: 'Settings', hash: '#/settings' },
];

function activeIdFromHash(hash) {
  const path = (hash || '#/home').replace(/^#/, '');
  if (path.startsWith('/invoice')) return null;
  if (path.startsWith('/bills')) return 'bills';
  if (path.startsWith('/reports')) return 'reports';
  if (path.startsWith('/settings')) return 'settings';
  if (path.startsWith('/home') || path === '' || path === '/') return 'home';
  return null;
}

export function mountBottomNav(container) {
  const buttons = new Map();

  const nav = el(
    'nav',
    { class: 'bottom-nav', role: 'navigation', 'aria-label': 'Primary' },
    ITEMS.map((item) => {
      const btn = el(
        'button',
        {
          class: 'bottom-nav__item',
          type: 'button',
          onclick: () => {
            location.hash = item.hash;
          },
        },
        [createIcon(item.id), el('span', {}, [item.label])]
      );
      buttons.set(item.id, btn);
      return btn;
    })
  );

  container.innerHTML = '';
  container.appendChild(nav);

  function update() {
    const activeId = activeIdFromHash(location.hash);
    for (const [id, btn] of buttons) {
      btn.classList.toggle('is-active', id === activeId);
    }
    nav.style.display = activeId === null ? 'none' : 'flex';
  }

  window.addEventListener('hashchange', update);
  update();
}
