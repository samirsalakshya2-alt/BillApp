import { getDraftInvoice, setDraftInvoice, clearDraftInvoice } from '../db/stores/settingsStore.js';
import { debounce } from '../utils/domHelpers.js';

/** The in-progress "New Bill" form state, autosaved so an unexpected app close doesn't lose it. */
export async function loadDraft() {
  return getDraftInvoice();
}

export const saveDraftDebounced = debounce((formState) => {
  setDraftInvoice({ ...formState, savedAt: new Date().toISOString() });
}, 500);

export async function discardDraft() {
  await clearDraftInvoice();
}
