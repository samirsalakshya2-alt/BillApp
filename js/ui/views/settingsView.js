import { el, mount } from '../../utils/domHelpers.js';
import { showModal } from '../components/modal.js';
import { formField, numberInput } from '../components/formField.js';
import { createIcon } from '../components/icons.js';
import { showToast } from '../components/toast.js';
import { navigate } from '../../router.js';
import { getBusiness } from '../../services/businessService.js';
import { getNextInvoiceNumber, setInvoiceCounterOverride } from '../../services/invoiceService.js';

function openInvoiceCounterEditor(currentNext, onSaved) {
  const input = numberInput({ value: currentNext, min: '1', step: '1' });
  const body = el('div', { class: 'form-grid' }, [
    formField('Next invoice number', input, { hint: 'Existing invoice numbers already saved are never reused.' }),
  ]);

  showModal({
    title: 'Change invoice numbering',
    body,
    actions: [
      { label: 'Cancel', variant: 'outline' },
      {
        label: 'Save',
        variant: 'primary',
        onClick: async () => {
          try {
            await setInvoiceCounterOverride(Number(input.value));
            showToast('Invoice numbering updated.', { type: 'success' });
            onSaved();
          } catch (err) {
            showToast(err.message, { type: 'error' });
          }
        },
      },
    ],
  });
}

function settingsTile(icon, title, subtitle, onClick) {
  return el('button', { class: 'nav-tile', type: 'button', onclick: onClick }, [
    el('div', { class: 'nav-tile__icon' }, [createIcon(icon, { size: 22 })]),
    el('div', { class: 'nav-tile__body' }, [
      el('div', { class: 'nav-tile__title' }, [title]),
      el('div', { class: 'nav-tile__subtitle' }, [subtitle]),
    ]),
  ]);
}

export async function render(container) {
  mount(container, el('div', { class: 'u-text-muted u-text-center', style: 'padding:48px 0;' }, ['Loading settings…']));

  const business = await getBusiness();
  const nextNumber = await getNextInvoiceNumber();

  function draw(currentNext) {
    mount(container, [
      el('div', { class: 'u-flex-col u-gap-4' }, [
        el('div', { class: 'card u-flex u-items-center u-justify-between' }, [
          el('div', {}, [
            el('div', { class: 'u-text-sm u-text-muted' }, ['Next invoice number']),
            el('div', { class: 'u-font-bold', style: 'font-size:1.4rem;' }, [String(currentNext)]),
          ]),
          el('button', {
            class: 'btn btn--outline btn--sm',
            type: 'button',
            onclick: () => openInvoiceCounterEditor(currentNext, async () => {
              draw(await getNextInvoiceNumber());
            }),
          }, ['Change']),
        ]),

        settingsTile('backup', 'Backup', 'Export your data to a file', () => navigate('#/backup')),
        settingsTile('backup', 'Restore', 'Import or restore from a backup file', () => navigate('#/backup')),

        el('div', { class: 'card u-text-sm u-text-muted u-flex-col u-gap-1' }, [
          el('div', { class: 'u-font-semibold u-text-muted' }, ['About']),
          el('div', {}, [business.name]),
          el('div', {}, [business.addressLines.join(', ')]),
          el('div', {}, ['BillApp v1.0 — offline billing, installed on this device']),
        ]),
      ]),
    ]);
  }

  draw(nextNumber);
}
