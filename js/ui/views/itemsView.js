import { el, mount } from '../../utils/domHelpers.js';
import { searchBar } from '../components/searchBar.js';
import { showModal, confirmDialog } from '../components/modal.js';
import { formField, textInput } from '../components/formField.js';
import { mountFab } from '../components/fab.js';
import { getFabRootEl } from '../../router.js';
import { showToast } from '../components/toast.js';
import { isNonEmpty } from '../../utils/validators.js';
import { listItems, searchItems, saveItem, deleteItem, DEFAULT_ITEM_UNIT } from '../../services/itemService.js';
import { QUANTITY_UNITS } from '../../services/invoiceService.js';

function itemListItem(item, onEdit) {
  return el('button', { class: 'list-item', type: 'button', onclick: () => onEdit(item) }, [
    el('div', { class: 'list-item__body' }, [
      el('div', { class: 'list-item__title' }, [item.name]),
      el('div', { class: 'list-item__subtitle' }, [
        [item.hsn ? `HSN ${item.hsn}` : null, item.unit || DEFAULT_ITEM_UNIT].filter(Boolean).join(' · '),
      ]),
    ]),
  ]);
}

function emptyState(query) {
  return el('div', { class: 'empty-state' }, [
    el('div', {}, [query ? `No items match "${query}".` : 'No items yet.']),
    !query ? el('div', { class: 'u-text-sm' }, ['Items are also added automatically the first time you bill them.']) : null,
  ]);
}

function openItemEditor(item, { onSaved, onDeleted }) {
  const isNew = !item;
  const it = item || {};

  const nameInput = textInput({ value: it.name || '' });
  const hsnInput = textInput({ value: it.hsn || '' });
  const unit = it.unit || DEFAULT_ITEM_UNIT;
  const unitSelect = el(
    'select',
    { class: 'field__select' },
    QUANTITY_UNITS.map((u) => el('option', { value: u, selected: u === unit }, [u]))
  );

  const body = el('div', { class: 'form-grid' }, [
    formField('Item Name', nameInput),
    formField('HSN', hsnInput),
    formField('Default Unit', unitSelect),
  ]);

  const actions = [
    { label: 'Cancel', variant: 'outline' },
    {
      label: 'Save',
      variant: 'primary',
      onClick: async () => {
        const fields = { id: it.id, name: nameInput.value, hsn: hsnInput.value, unit: unitSelect.value };
        if (!isNonEmpty(fields.name)) {
          showToast('Item name is required.', { type: 'error' });
          throw new Error('validation failed');
        }
        try {
          await saveItem(fields);
        } catch (err) {
          showToast(err.message, { type: 'error' });
          throw err;
        }
        showToast(isNew ? 'Item added.' : 'Item updated.', { type: 'success' });
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
          title: 'Delete item?',
          message: `${it.name} will be removed from the item master. Existing bills are unaffected.`,
          confirmLabel: 'Delete',
          danger: true,
        });
        if (!confirmed) throw new Error('cancelled');
        await deleteItem(it.id);
        showToast('Item deleted.', { type: 'success' });
        onDeleted();
      },
    });
  }

  showModal({ title: isNew ? 'New Item' : 'Edit Item', body, actions });
}

export async function render(container) {
  mount(container, el('div', { class: 'u-text-muted u-text-center', style: 'padding:48px 0;' }, ['Loading items…']));

  let currentQuery = '';

  async function refresh() {
    const items = currentQuery ? await searchItems(currentQuery) : await listItems();
    listRoot.innerHTML = '';
    if (!items.length) {
      listRoot.appendChild(emptyState(currentQuery));
      return;
    }
    listRoot.appendChild(el('div', { class: 'list' }, items.map((item) => itemListItem(item, (it) => {
      openItemEditor(it, { onSaved: refresh, onDeleted: refresh });
    }))));
  }

  const bar = searchBar({
    placeholder: 'Search by item name or HSN…',
    onChange: (q) => {
      currentQuery = q;
      refresh();
    },
  });

  const listRoot = el('div', { class: 'u-mt-4' });

  mount(container, el('div', { class: 'u-flex-col' }, [bar, listRoot]));

  const removeFab = mountFab(getFabRootEl(), {
    label: 'Add Item',
    onClick: () => openItemEditor(null, { onSaved: refresh, onDeleted: refresh }),
  });

  await refresh();

  return { destroy: removeFab };
}
