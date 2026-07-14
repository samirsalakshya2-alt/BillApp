import { el, mount } from '../../utils/domHelpers.js';
import { formField, textInput, numberInput } from '../components/formField.js';
import { makeAutocomplete } from '../components/autocomplete.js';
import { createIcon } from '../components/icons.js';
import { showToast } from '../components/toast.js';
import { confirmDialog } from '../components/modal.js';
import { isNonEmpty } from '../../utils/validators.js';
import { todayIso, formatAmount } from '../formatters.js';
import { uid } from '../../utils/uid.js';
import { navigate, getHeaderActionsEl } from '../../router.js';

import { getBanks, getDefaultBankForBusiness } from '../../services/businessService.js';
import { searchCustomers } from '../../services/customerService.js';
import { searchItems } from '../../services/itemService.js';
import {
  getNextInvoiceNumber,
  computeItemAmount,
  computeTotalAmount,
  formStateFromInvoice,
  getInvoiceById,
  QUANTITY_UNITS,
  DEFAULT_QUANTITY_UNIT,
} from '../../services/invoiceService.js';
import { amountToWords } from '../../services/numberToWords.js';
import { loadDraft, saveDraftDebounced, discardDraft } from '../../services/draftService.js';
import { setPendingInvoice, getPendingInvoice, clearPendingInvoice } from '../../services/pendingInvoiceStore.js';

function emptyItemRow() {
  return { rowId: uid('row'), itemId: null, name: '', hsn: '', bags: '', qty: '', unit: DEFAULT_QUANTITY_UNIT, rate: '' };
}

function emptyFormState({ invoiceNumber, defaultBankId }) {
  const today = todayIso();
  return {
    id: null,
    createdAt: null,
    invoiceNumber,
    invoiceDate: today,
    transportMode: '',
    vehicleNumber: '',
    dateOfSupply: today,
    customerId: null,
    customerNumber: '',
    customerName: '',
    customerAddress: '',
    customerGstin: '',
    customerState: '',
    customerStateCode: '',
    placeOfSupply: '',
    driverName: '',
    driverContact: '',
    brokerName: '',
    items: [emptyItemRow()],
    bankId: defaultBankId,
    remarks: '',
  };
}

function createItemRowEl(row, { onChange, onRemove, canRemove }) {
  const hsnInput = textInput({ value: row.hsn, placeholder: 'HSN' });
  const bagsInput = numberInput({ value: row.bags, placeholder: 'Bags', min: '0', step: 'any' });
  const qtyInput = numberInput({ value: row.qty, placeholder: 'Qty', min: '0', step: 'any' });
  const unitSelect = el(
    'select',
    { class: 'field__select' },
    QUANTITY_UNITS.map((unit) => el('option', { value: unit, selected: unit === row.unit }, [unit]))
  );
  const rateInput = numberInput({ value: row.rate, placeholder: 'Rate ₹', min: '0', step: 'any' });
  const amountEl = el('div', { class: 'u-font-semibold' }, [formatAmount(computeItemAmount(row.qty, row.rate))]);

  const { wrapper: nameWrapper, input: nameInput } = makeAutocomplete({
    inputProps: { value: row.name, placeholder: 'Item name' },
    fetchOptions: (q) => searchItems(q),
    renderOption: (item) => ({ title: item.name, subtitle: item.hsn ? `HSN ${item.hsn}` : '' }),
    onSelect: (item) => {
      row.itemId = item.id;
      row.name = item.name;
      row.hsn = item.hsn;
      nameInput.value = item.name;
      hsnInput.value = item.hsn;
      onChange();
    },
  });

  nameInput.addEventListener('input', () => {
    row.itemId = null;
    row.name = nameInput.value;
    onChange({ skipRerender: true });
  });
  hsnInput.addEventListener('input', () => {
    row.hsn = hsnInput.value;
    onChange({ skipRerender: true });
  });
  bagsInput.addEventListener('input', () => {
    row.bags = bagsInput.value;
    onChange({ skipRerender: true });
  });
  qtyInput.addEventListener('input', () => {
    row.qty = qtyInput.value;
    amountEl.textContent = formatAmount(computeItemAmount(row.qty, row.rate));
    onChange({ skipRerender: true });
  });
  unitSelect.addEventListener('change', () => {
    row.unit = unitSelect.value;
    onChange();
  });
  rateInput.addEventListener('input', () => {
    row.rate = rateInput.value;
    amountEl.textContent = formatAmount(computeItemAmount(row.qty, row.rate));
    onChange({ skipRerender: true });
  });

  return el('div', { class: 'card', style: 'position:relative;' }, [
    canRemove
      ? el('button', {
          class: 'btn btn--icon',
          type: 'button',
          style: 'position:absolute;top:8px;right:8px;color:var(--color-danger);background:transparent;',
          'aria-label': 'Remove item',
          onclick: onRemove,
        }, [createIcon('trash', { size: 18 })])
      : null,
    el('div', { class: 'form-grid', style: 'gap:12px;' }, [
      formField('Item', nameWrapper),
      el('div', { class: 'form-grid form-grid--2', style: 'gap:12px;grid-template-columns:1fr 1fr;' }, [
        formField('HSN', hsnInput),
        formField('Number of Bags', bagsInput),
      ]),
      el('div', { class: 'form-grid form-grid--2', style: 'gap:12px;grid-template-columns:1fr 1fr;' }, [
        formField('Quantity', qtyInput),
        formField('Quantity Unit', unitSelect),
      ]),
      el('div', { class: 'form-grid form-grid--2', style: 'gap:12px;grid-template-columns:1fr 1fr;' }, [
        formField('Rate (₹ per ' + (row.unit || DEFAULT_QUANTITY_UNIT) + ')', rateInput),
        el('div', { class: 'field' }, [el('label', { class: 'field__label' }, ['Amount']), amountEl]),
      ]),
    ]),
  ]);
}

export async function render(container, params) {
  mount(container, el('div', { class: 'u-text-muted u-text-center', style: 'padding:48px 0;' }, ['Loading…']));

  const banks = await getBanks();
  const isEditing = !!params?.id;

  let state;
  let restoredFromDraft = false;

  if (isEditing) {
    const invoice = await getInvoiceById(params.id);
    state = formStateFromInvoice(invoice);
  } else {
    const pending = getPendingInvoice();
    if (pending) {
      // Came back from the (unsaved) preview via Back/Edit — resume exactly where we left off, no prompt.
      state = pending;
      clearPendingInvoice();
    }
    const draft = !state ? await loadDraft() : null;
    if (draft) {
      const restore = await confirmDialog({
        title: 'Restore unsaved bill?',
        message: `You have an unsaved bill from ${new Date(draft.savedAt).toLocaleString('en-IN')}. Restore it, or start a fresh bill?`,
        confirmLabel: 'Restore',
        cancelLabel: 'Start Fresh',
      });
      if (restore) {
        state = draft;
        restoredFromDraft = true;
      } else {
        await discardDraft();
      }
    }
    if (!state) {
      const defaultBank = await getDefaultBankForBusiness();
      const nextNumber = await getNextInvoiceNumber();
      state = emptyFormState({ invoiceNumber: nextNumber, defaultBankId: defaultBank?.id });
    }
  }

  if (restoredFromDraft) showToast('Restored your unsaved bill.', { type: 'success' });

  function autosave() {
    if (!isEditing) saveDraftDebounced(state);
  }

  // ---- Static-ish fields (created once; re-render would drop focus) ----
  const invoiceNumberInput = numberInput({ value: state.invoiceNumber, min: '1', step: '1' });
  const invoiceDateInput = el('input', { class: 'field__input', type: 'date', value: state.invoiceDate });
  const transportModeInput = textInput({ value: state.transportMode, placeholder: 'e.g. By Road', list: 'transportModes' });
  const vehicleNumberInput = textInput({ value: state.vehicleNumber, placeholder: 'e.g. JH01AB1234' });
  const dateOfSupplyInput = el('input', { class: 'field__input', type: 'date', value: state.dateOfSupply });
  const driverNameInput = textInput({ value: state.driverName });
  const driverContactInput = el('input', { class: 'field__input', type: 'tel', value: state.driverContact });
  const brokerNameInput = textInput({ value: state.brokerName });
  const remarksInput = el('textarea', { class: 'field__textarea' }, [state.remarks]);

  const customerNumberInput = textInput({ value: state.customerNumber });
  const customerAddressInput = textInput({ value: state.customerAddress });
  const customerGstinInput = textInput({ value: state.customerGstin });
  const customerStateInput = textInput({ value: state.customerState });
  const customerStateCodeInput = textInput({ value: state.customerStateCode });
  const placeOfSupplyInput = textInput({ value: state.placeOfSupply });

  const { wrapper: customerWrapper, input: customerNameInput } = makeAutocomplete({
    inputProps: { value: state.customerName, placeholder: 'Search by name or number…' },
    fetchOptions: (q) => searchCustomers(q),
    renderOption: (c) => ({ title: c.name, subtitle: c.customerNumber }),
    onSelect: (customer) => {
      state.customerId = customer.id;
      state.customerName = customer.name;
      state.customerNumber = customer.customerNumber || '';
      state.customerAddress = customer.address || '';
      state.customerGstin = customer.gstin || '';
      state.customerState = customer.state || '';
      state.customerStateCode = customer.stateCode || '';
      state.placeOfSupply = customer.placeOfSupply || '';
      customerNumberInput.value = state.customerNumber;
      customerAddressInput.value = state.customerAddress;
      customerGstinInput.value = state.customerGstin;
      customerStateInput.value = state.customerState;
      customerStateCodeInput.value = state.customerStateCode;
      placeOfSupplyInput.value = state.placeOfSupply;
      autosave();
    },
  });

  const bankSelect = el(
    'select',
    { class: 'field__select' },
    banks.map((bank) => el('option', { value: bank.id, selected: bank.id === state.bankId }, [
      `${bank.bankName} — ${bank.accountNumber}`,
    ]))
  );

  const totalEl = el('div', { class: 'u-font-bold', style: 'font-size:1.5rem;' }, [formatAmount(0)]);
  const wordsEl = el('div', { class: 'u-text-sm u-text-muted' }, ['']);

  function recomputeTotals() {
    const total = computeTotalAmount(state.items);
    totalEl.textContent = formatAmount(total);
    wordsEl.textContent = amountToWords(total);
  }

  // simple field bindings that don't need re-render
  invoiceNumberInput.addEventListener('input', () => { state.invoiceNumber = invoiceNumberInput.value; autosave(); });
  invoiceDateInput.addEventListener('input', () => { state.invoiceDate = invoiceDateInput.value; autosave(); });
  transportModeInput.addEventListener('input', () => { state.transportMode = transportModeInput.value; autosave(); });
  vehicleNumberInput.addEventListener('input', () => { state.vehicleNumber = vehicleNumberInput.value; autosave(); });
  dateOfSupplyInput.addEventListener('input', () => { state.dateOfSupply = dateOfSupplyInput.value; autosave(); });
  driverNameInput.addEventListener('input', () => { state.driverName = driverNameInput.value; autosave(); });
  driverContactInput.addEventListener('input', () => { state.driverContact = driverContactInput.value; autosave(); });
  brokerNameInput.addEventListener('input', () => { state.brokerName = brokerNameInput.value; autosave(); });
  remarksInput.addEventListener('input', () => { state.remarks = remarksInput.value; autosave(); });
  customerNameInput.addEventListener('input', () => { state.customerId = null; state.customerName = customerNameInput.value; autosave(); });
  customerNumberInput.addEventListener('input', () => { state.customerNumber = customerNumberInput.value; autosave(); });
  customerAddressInput.addEventListener('input', () => { state.customerAddress = customerAddressInput.value; autosave(); });
  customerGstinInput.addEventListener('input', () => { state.customerGstin = customerGstinInput.value; autosave(); });
  customerStateInput.addEventListener('input', () => { state.customerState = customerStateInput.value; autosave(); });
  customerStateCodeInput.addEventListener('input', () => { state.customerStateCode = customerStateCodeInput.value; autosave(); });
  placeOfSupplyInput.addEventListener('input', () => { state.placeOfSupply = placeOfSupplyInput.value; autosave(); });
  bankSelect.addEventListener('change', () => { state.bankId = bankSelect.value; autosave(); });

  const itemsRoot = el('div', { class: 'u-flex-col u-gap-3' });

  function renderItemRows() {
    itemsRoot.innerHTML = '';
    state.items.forEach((row) => {
      itemsRoot.appendChild(
        createItemRowEl(row, {
          canRemove: state.items.length > 1,
          onChange: (opts = {}) => {
            recomputeTotals();
            autosave();
            if (!opts.skipRerender) renderItemRows();
          },
          onRemove: () => {
            state.items = state.items.filter((r) => r.rowId !== row.rowId);
            renderItemRows();
            recomputeTotals();
            autosave();
          },
        })
      );
    });
  }

  renderItemRows();
  recomputeTotals();

  mount(container, [
    el('div', { class: 'u-flex-col u-gap-4' }, [
      el('div', { class: 'form-grid form-grid--2' }, [
        formField('Invoice Number', invoiceNumberInput),
        formField('Invoice Date', invoiceDateInput),
      ]),
      el('div', { class: 'form-grid form-grid--2' }, [
        formField('Transportation Mode', transportModeInput),
        formField('Vehicle Number', vehicleNumberInput),
      ]),
      el('div', { class: 'form-grid form-grid--2' }, [
        formField('Date of Supply', dateOfSupplyInput),
        formField('Broker Name', brokerNameInput),
      ]),
      el('div', { class: 'form-grid form-grid--2' }, [
        formField('Driver Name', driverNameInput),
        formField('Driver Contact', driverContactInput),
      ]),

      el('div', { class: 'u-font-semibold' }, ['Customer']),
      formField('Customer', customerWrapper),
      el('div', { class: 'form-grid form-grid--2' }, [
        formField('Customer Number', customerNumberInput),
        formField('State', customerStateInput),
      ]),
      el('div', { class: 'form-grid form-grid--2' }, [
        formField('GSTIN', customerGstinInput),
        formField('State Code', customerStateCodeInput),
      ]),
      formField('Address', customerAddressInput),
      formField('Place of Supply', placeOfSupplyInput),

      el('div', { class: 'u-flex u-items-center u-justify-between' }, [
        el('div', { class: 'u-font-semibold' }, ['Items']),
        el('button', {
          class: 'btn btn--outline btn--sm',
          type: 'button',
          onclick: () => {
            state.items.push(emptyItemRow());
            renderItemRows();
            recomputeTotals();
            autosave();
          },
        }, [createIcon('plus', { size: 16 }), 'Add Item']),
      ]),
      itemsRoot,

      formField('Bank for this invoice', bankSelect),
      formField('Remarks', remarksInput),

      el('div', { class: 'card u-flex-col u-gap-1' }, [
        el('div', { class: 'u-text-sm u-text-muted' }, ['Total Amount']),
        totalEl,
        wordsEl,
      ]),
    ]),
    el('datalist', { id: 'transportModes' }, ['By Road', 'By Rail', 'Self Pickup'].map((m) => el('option', { value: m }))),
  ]);

  const actionsEl = getHeaderActionsEl();
  if (actionsEl) {
    actionsEl.appendChild(
      el('button', { class: 'btn btn--sm', style: 'background:rgba(255,255,255,0.18);color:#fff;', type: 'button', onclick: onPreview }, ['Preview'])
    );
  }

  async function onPreview() {
    if (!isNonEmpty(state.customerName)) {
      showToast('Customer name is required.', { type: 'error' });
      return;
    }
    if (!isNonEmpty(state.invoiceDate)) {
      showToast('Invoice date is required.', { type: 'error' });
      return;
    }
    if (!state.bankId) {
      showToast('Select a bank for this invoice.', { type: 'error' });
      return;
    }
    const validItems = state.items.filter((row) => isNonEmpty(row.name) && Number(row.qty) > 0);
    if (!validItems.length) {
      showToast('Add at least one item with a name and quantity.', { type: 'error' });
      return;
    }
    const invoiceNumber = Number(state.invoiceNumber);
    if (!Number.isInteger(invoiceNumber) || invoiceNumber <= 0) {
      showToast('Invoice number must be a positive whole number.', { type: 'error' });
      return;
    }

    setPendingInvoice({ ...state, invoiceNumber, items: validItems });
    navigate('#/invoice/preview');
  }

  return { destroy: () => {} };
}
