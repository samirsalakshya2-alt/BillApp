import { el, mount } from '../../utils/domHelpers.js';
import { createIcon } from '../components/icons.js';
import { mountFab } from '../components/fab.js';
import { getFabRootEl, navigate } from '../../router.js';

const MENU = [
  { icon: 'bills', title: 'Bills', subtitle: 'Search & manage saved bills', hash: '#/bills' },
  { icon: 'customers', title: 'Customers', subtitle: 'Customer master', hash: '#/customers' },
  { icon: 'items', title: 'Items', subtitle: 'Item master', hash: '#/items' },
  { icon: 'reports', title: 'Reports', subtitle: "Today's, monthly & customer-wise", hash: '#/reports' },
  { icon: 'settings', title: 'Settings', subtitle: 'Banks & invoice numbering', hash: '#/settings' },
  { icon: 'backup', title: 'Backup', subtitle: 'Export, import & restore', hash: '#/backup' },
];

function navTile(item) {
  return el('button', { class: 'nav-tile', type: 'button', onclick: () => navigate(item.hash) }, [
    el('div', { class: 'nav-tile__icon' }, [createIcon(item.icon, { size: 24 })]),
    el('div', { class: 'nav-tile__body' }, [
      el('div', { class: 'nav-tile__title' }, [item.title]),
      el('div', { class: 'nav-tile__subtitle' }, [item.subtitle]),
    ]),
  ]);
}

export function render(container) {
  const newBillTile = el('button', {
    class: 'nav-tile',
    type: 'button',
    style: 'background:var(--color-primary);color:#fff;',
    onclick: () => navigate('#/invoice/new'),
  }, [
    el('div', { class: 'nav-tile__icon', style: 'background:rgba(255,255,255,0.15);color:#fff;' }, [createIcon('plus', { size: 24 })]),
    el('div', { class: 'nav-tile__body' }, [
      el('div', { class: 'nav-tile__title' }, ['New Bill']),
      el('div', { class: 'nav-tile__subtitle', style: 'color:rgba(255,255,255,0.75);' }, ['Create a new invoice']),
    ]),
  ]);

  mount(container, [
    el('div', { class: 'u-flex-col u-gap-4' }, [
      newBillTile,
      el('div', { class: 'nav-grid' }, MENU.map(navTile)),
    ]),
  ]);

  const removeFab = mountFab(getFabRootEl(), { onClick: () => navigate('#/invoice/new') });
  return { destroy: removeFab };
}
