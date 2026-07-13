import { el, mount } from '../../utils/domHelpers.js';
import { searchBar } from '../components/searchBar.js';
import { showModal, confirmDialog } from '../components/modal.js';
import { createIcon } from '../components/icons.js';
import { showToast } from '../components/toast.js';
import { formatAmount, formatDateDisplay, todayIso } from '../formatters.js';
import { uid } from '../../utils/uid.js';
import { navigate, getFabRootEl } from '../../router.js';
import { mountFab } from '../components/fab.js';

import {
  listInvoices,
  searchInvoices,
  deleteInvoice,
  formStateFromInvoice,
  getNextInvoiceNumber,
} from '../../services/invoiceService.js';
import { setPendingInvoice } from '../../services/pendingInvoiceStore.js';

function billListItem(invoice, { onOpen, onMore }) {
  return el('div', { class: 'list-item', style: 'cursor:pointer;', role: 'button', tabindex: '0', onclick: onOpen }, [
    el('div', { class: 'list-item__body' }, [
      el('div', { class: 'list-item__title' }, [`#${invoice.invoiceNumber} — ${invoice.customerSnapshot?.name || 'Unknown customer'}`]),
      el('div', { class: 'list-item__subtitle' }, [
        [formatDateDisplay(invoice.invoiceDate), invoice.vehicleNumber].filter(Boolean).join(' · '),
      ]),
    ]),
    el('div', { class: 'list-item__meta' }, [formatAmount(invoice.totalAmount)]),
    el('button', {
      class: 'btn btn--icon',
      type: 'button',
      style: 'color:var(--color-text-muted);background:transparent;',
      'aria-label': 'More actions',
      onclick: (e) => {
        e.stopPropagation();
        onMore();
      },
    }, [createIcon('moreVertical', { size: 18 })]),
  ]);
}

function emptyState(query) {
  return el('div', { class: 'empty-state' }, [
    el('div', {}, [query ? `No bills match "${query}".` : 'No bills yet.']),
    !query ? el('div', { class: 'u-text-sm' }, ['Tap New Bill from Home to create your first one.']) : null,
  ]);
}

async function openActionSheet(invoice, { onChanged }) {
  const close = showModal({
    title: `Bill #${invoice.invoiceNumber}`,
    body: el('div', { class: 'u-flex-col u-gap-2' }, [
      el('button', { class: 'btn btn--outline btn--block', type: 'button', onclick: () => {
        close();
        navigate(`#/invoice/${invoice.id}/preview`);
      } }, [createIcon('eye', { size: 18 }), ' View / Preview']),
      el('button', { class: 'btn btn--outline btn--block', type: 'button', onclick: () => {
        close();
        navigate(`#/invoice/${invoice.id}/edit`);
      } }, [createIcon('edit', { size: 18 }), ' Edit']),
      el('button', { class: 'btn btn--outline btn--block', type: 'button', onclick: async () => {
        close();
        await duplicateInvoice(invoice);
      } }, [createIcon('copy', { size: 18 }), ' Duplicate']),
      el('button', { class: 'btn btn--danger btn--block', type: 'button', onclick: async () => {
        close();
        const confirmed = await confirmDialog({
          title: 'Delete this bill?',
          message: `Bill #${invoice.invoiceNumber} for ${invoice.customerSnapshot?.name || 'this customer'} will be permanently deleted.`,
          confirmLabel: 'Delete',
          danger: true,
        });
        if (!confirmed) return;
        await deleteInvoice(invoice.id);
        showToast('Bill deleted.', { type: 'success' });
        onChanged();
      } }, [createIcon('trash', { size: 18 }), ' Delete']),
    ]),
    actions: [{ label: 'Close', variant: 'outline' }],
  });
}

async function duplicateInvoice(invoice) {
  const base = formStateFromInvoice(invoice);
  const today = todayIso();
  const nextNumber = await getNextInvoiceNumber();
  setPendingInvoice({
    ...base,
    id: null,
    createdAt: null,
    invoiceNumber: nextNumber,
    invoiceDate: today,
    dateOfSupply: today,
    items: base.items.map((row) => ({ ...row, rowId: uid('row') })),
  });
  navigate('#/invoice/new');
}

export async function render(container) {
  mount(container, el('div', { class: 'u-text-muted u-text-center', style: 'padding:48px 0;' }, ['Loading bills…']));

  let currentQuery = '';

  async function refresh() {
    const invoices = currentQuery ? await searchInvoices(currentQuery) : await listInvoices();
    listRoot.innerHTML = '';
    if (!invoices.length) {
      listRoot.appendChild(emptyState(currentQuery));
      return;
    }
    listRoot.appendChild(el('div', { class: 'list' }, invoices.map((invoice) => billListItem(invoice, {
      onOpen: () => navigate(`#/invoice/${invoice.id}/preview`),
      onMore: () => openActionSheet(invoice, { onChanged: refresh }),
    }))));
  }

  const bar = searchBar({
    placeholder: 'Search invoice #, customer, vehicle, driver, broker…',
    onChange: (q) => {
      currentQuery = q;
      refresh();
    },
  });

  const listRoot = el('div', { class: 'u-mt-4' });

  mount(container, el('div', { class: 'u-flex-col' }, [bar, listRoot]));

  const removeFab = mountFab(getFabRootEl(), { label: 'New Bill', onClick: () => navigate('#/invoice/new') });

  await refresh();

  return { destroy: removeFab };
}
