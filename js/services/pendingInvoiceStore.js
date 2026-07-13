/**
 * Transient (in-memory only) holder for the invoice currently being
 * previewed but not yet saved. Distinct from the persisted "draft" in
 * settingsStore: this only needs to survive an in-page hash navigation from
 * the form to the preview screen, never a reload — crash recovery is what
 * the draft is for.
 */
let pending = null;

export function setPendingInvoice(data) {
  pending = data;
}

export function getPendingInvoice() {
  return pending;
}

export function clearPendingInvoice() {
  pending = null;
}
