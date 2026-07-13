import { el, mount } from '../../utils/domHelpers.js';
import { searchBar } from '../components/searchBar.js';
import { formField } from '../components/formField.js';
import { formatAmount, formatDateDisplay, todayIso } from '../formatters.js';
import { navigate } from '../../router.js';
import {
  getTodaysBills,
  getMonthlyBills,
  getCustomerWiseSales,
  getItemWiseSales,
} from '../../services/reportService.js';

const TABS = [
  { id: 'today', label: "Today's Bills" },
  { id: 'monthly', label: 'Monthly Bills' },
  { id: 'customer', label: 'Customer-wise' },
  { id: 'item', label: 'Item-wise' },
];

function statRow(count, total, countLabel = 'Bills') {
  return el('div', { class: 'nav-grid' }, [
    el('div', { class: 'stat-card' }, [
      el('div', { class: 'stat-card__value' }, [String(count)]),
      el('div', { class: 'stat-card__label' }, [countLabel]),
    ]),
    el('div', { class: 'stat-card' }, [
      el('div', { class: 'stat-card__value' }, [formatAmount(total)]),
      el('div', { class: 'stat-card__label' }, ['Total Amount']),
    ]),
  ]);
}

function billsList(invoices) {
  if (!invoices.length) {
    return el('div', { class: 'empty-state' }, ['No bills in this range.']);
  }
  return el('div', { class: 'list' }, invoices.map((invoice) => el('div', {
    class: 'list-item', style: 'cursor:pointer;', role: 'button', tabindex: '0',
    onclick: () => navigate(`#/invoice/${invoice.id}/preview`),
  }, [
    el('div', { class: 'list-item__body' }, [
      el('div', { class: 'list-item__title' }, [`#${invoice.invoiceNumber} — ${invoice.customerSnapshot?.name || 'Unknown customer'}`]),
      el('div', { class: 'list-item__subtitle' }, [formatDateDisplay(invoice.invoiceDate)]),
    ]),
    el('div', { class: 'list-item__meta' }, [formatAmount(invoice.totalAmount)]),
  ])));
}

async function renderTodayTab() {
  const { invoices, total, count } = await getTodaysBills();
  return el('div', { class: 'u-flex-col u-gap-3' }, [statRow(count, total), billsList(invoices)]);
}

async function renderMonthlyTab() {
  const monthInput = el('input', { class: 'field__input', type: 'month', value: todayIso().slice(0, 7) });
  const resultsRoot = el('div', { class: 'u-mt-3' });

  async function refresh() {
    const { invoices, total, count } = await getMonthlyBills(monthInput.value);
    mount(resultsRoot, el('div', { class: 'u-flex-col u-gap-3' }, [statRow(count, total), billsList(invoices)]));
  }

  monthInput.addEventListener('change', refresh);
  await refresh();

  return el('div', { class: 'u-flex-col u-gap-3' }, [formField('Month', monthInput), resultsRoot]);
}

async function renderCustomerTab() {
  const all = await getCustomerWiseSales();
  const resultsRoot = el('div', {});

  function draw(list) {
    if (!list.length) {
      mount(resultsRoot, el('div', { class: 'empty-state' }, ['No sales recorded yet.']));
      return;
    }
    mount(resultsRoot, el('div', { class: 'list' }, list.map((c) => el('div', { class: 'list-item' }, [
      el('div', { class: 'list-item__body' }, [
        el('div', { class: 'list-item__title' }, [c.name]),
        el('div', { class: 'list-item__subtitle' }, [`${c.billCount} bill${c.billCount === 1 ? '' : 's'}`]),
      ]),
      el('div', { class: 'list-item__meta' }, [formatAmount(c.total)]),
    ]))));
  }

  const bar = searchBar({
    placeholder: 'Search customer…',
    onChange: (q) => draw(q ? all.filter((c) => c.name.toLowerCase().includes(q.toLowerCase())) : all),
  });

  draw(all);
  return el('div', { class: 'u-flex-col u-gap-3' }, [bar, resultsRoot]);
}

async function renderItemTab() {
  const all = await getItemWiseSales();
  const resultsRoot = el('div', {});

  function draw(list) {
    if (!list.length) {
      mount(resultsRoot, el('div', { class: 'empty-state' }, ['No sales recorded yet.']));
      return;
    }
    mount(resultsRoot, el('div', { class: 'list' }, list.map((it) => el('div', { class: 'list-item' }, [
      el('div', { class: 'list-item__body' }, [
        el('div', { class: 'list-item__title' }, [it.name]),
        el('div', { class: 'list-item__subtitle' }, [`Qty ${it.qty} · ${it.billCount} bill${it.billCount === 1 ? '' : 's'}`]),
      ]),
      el('div', { class: 'list-item__meta' }, [formatAmount(it.total)]),
    ]))));
  }

  const bar = searchBar({
    placeholder: 'Search item…',
    onChange: (q) => draw(q ? all.filter((it) => it.name.toLowerCase().includes(q.toLowerCase())) : all),
  });

  draw(all);
  return el('div', { class: 'u-flex-col u-gap-3' }, [bar, resultsRoot]);
}

const TAB_RENDERERS = {
  today: renderTodayTab,
  monthly: renderMonthlyTab,
  customer: renderCustomerTab,
  item: renderItemTab,
};

export async function render(container) {
  let activeTab = 'today';
  const tabsRoot = el('div', { class: 'u-flex u-gap-2', style: 'overflow-x:auto;padding-bottom:4px;' });
  const contentRoot = el('div', { class: 'u-mt-4' });

  function drawTabs() {
    tabsRoot.innerHTML = '';
    for (const tab of TABS) {
      tabsRoot.appendChild(el('button', {
        class: `btn btn--sm ${activeTab === tab.id ? 'btn--primary' : 'btn--outline'}`,
        type: 'button',
        style: 'flex-shrink:0;',
        onclick: () => {
          activeTab = tab.id;
          drawTabs();
          drawContent();
        },
      }, [tab.label]));
    }
  }

  async function drawContent() {
    mount(contentRoot, el('div', { class: 'u-text-muted u-text-center', style: 'padding:32px 0;' }, ['Loading…']));
    const node = await TAB_RENDERERS[activeTab]();
    mount(contentRoot, node);
  }

  drawTabs();
  mount(container, el('div', {}, [tabsRoot, contentRoot]));
  await drawContent();
}
