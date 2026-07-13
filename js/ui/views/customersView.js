import { el, mount } from '../../utils/domHelpers.js';
import { searchBar } from '../components/searchBar.js';
import { showModal, confirmDialog } from '../components/modal.js';
import { formField, textInput } from '../components/formField.js';
import { mountFab } from '../components/fab.js';
import { getFabRootEl } from '../../router.js';
import { showToast } from '../components/toast.js';
import { isNonEmpty, isValidGSTIN } from '../../utils/validators.js';
import { listCustomers, searchCustomers, saveCustomer, deleteCustomer } from '../../services/customerService.js';

function customerListItem(customer, onEdit) {
  return el('button', { class: 'list-item', type: 'button', onclick: () => onEdit(customer) }, [
    el('div', { class: 'list-item__body' }, [
      el('div', { class: 'list-item__title' }, [customer.name]),
      el('div', { class: 'list-item__subtitle' }, [
        [customer.customerNumber, customer.state].filter(Boolean).join(' · ') || 'No number / state on file',
      ]),
    ]),
  ]);
}

function emptyState(query) {
  return el('div', { class: 'empty-state' }, [
    el('div', {}, [query ? `No customers match "${query}".` : 'No customers yet.']),
    !query ? el('div', { class: 'u-text-sm' }, ['Tap + to add your first customer.']) : null,
  ]);
}

function openCustomerEditor(customer, { onSaved, onDeleted }) {
  const isNew = !customer;
  const c = customer || {};

  const numberInput = textInput({ value: c.customerNumber || '' });
  const nameInput = textInput({ value: c.name || '' });
  const addressInput = textInput({ value: c.address || '' });
  const gstinInput = textInput({ value: c.gstin || '' });
  const stateInput = textInput({ value: c.state || '' });
  const stateCodeInput = textInput({ value: c.stateCode || '' });
  const placeOfSupplyInput = textInput({ value: c.placeOfSupply || '' });

  const body = el('div', { class: 'form-grid' }, [
    formField('Customer Number', numberInput),
    formField('Customer Name', nameInput),
    formField('Address', addressInput),
    formField('GSTIN', gstinInput),
    formField('State', stateInput),
    formField('State Code', stateCodeInput),
    formField('Place of Supply', placeOfSupplyInput),
  ]);

  const actions = [
    { label: 'Cancel', variant: 'outline' },
    {
      label: 'Save',
      variant: 'primary',
      onClick: async () => {
        const fields = {
          id: c.id,
          createdAt: c.createdAt,
          customerNumber: numberInput.value,
          name: nameInput.value,
          address: addressInput.value,
          gstin: gstinInput.value,
          state: stateInput.value,
          stateCode: stateCodeInput.value,
          placeOfSupply: placeOfSupplyInput.value,
        };

        if (!isNonEmpty(fields.name)) {
          showToast('Customer name is required.', { type: 'error' });
          throw new Error('validation failed');
        }
        if (!isValidGSTIN(fields.gstin)) {
          showToast('GSTIN format looks invalid.', { type: 'error' });
          throw new Error('validation failed');
        }

        await saveCustomer(fields);
        showToast(isNew ? 'Customer added.' : 'Customer updated.', { type: 'success' });
        onSaved();
      },
    },
  ];

  if (!isNew) {
    actions.unshift({
      label: 'Delete',
      variant: 'danger',
      onClick: async () => {
        const confirmed = await confirmDialog({
          title: 'Delete customer?',
          message: `${c.name} will be permanently removed from the customer master. Existing bills are unaffected.`,
          confirmLabel: 'Delete',
          danger: true,
        });
        if (!confirmed) throw new Error('cancelled');
        await deleteCustomer(c.id);
        showToast('Customer deleted.', { type: 'success' });
        onDeleted();
      },
    });
  }

  showModal({ title: isNew ? 'New Customer' : 'Edit Customer', body, actions });
}

export async function render(container) {
  mount(container, el('div', { class: 'u-text-muted u-text-center', style: 'padding:48px 0;' }, ['Loading customers…']));

  let currentQuery = '';

  async function refresh() {
    const customers = currentQuery ? await searchCustomers(currentQuery) : await listCustomers();
    listRoot.innerHTML = '';
    if (!customers.length) {
      listRoot.appendChild(emptyState(currentQuery));
      return;
    }
    listRoot.appendChild(el('div', { class: 'list' }, customers.map((c) => customerListItem(c, (customer) => {
      openCustomerEditor(customer, { onSaved: refresh, onDeleted: refresh });
    }))));
  }

  const bar = searchBar({
    placeholder: 'Search by name or number…',
    onChange: (q) => {
      currentQuery = q;
      refresh();
    },
  });

  const listRoot = el('div', { class: 'u-mt-4' });

  mount(container, el('div', { class: 'u-flex-col' }, [bar, listRoot]));

  const removeFab = mountFab(getFabRootEl(), {
    label: 'Add Customer',
    onClick: () => openCustomerEditor(null, { onSaved: refresh, onDeleted: refresh }),
  });

  await refresh();

  return { destroy: removeFab };
}
