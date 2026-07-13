import { el, mount } from '../../utils/domHelpers.js';
import { createIcon } from '../components/icons.js';
import { showToast } from '../components/toast.js';
import { navigate } from '../../router.js';

import { getBusiness, getBankById } from '../../services/businessService.js';

import { renderInvoiceSheet } from '../renderer/invoiceRenderer.js';
import { viewModelFromFormState, viewModelFromInvoice } from '../../services/invoiceViewModel.js';
import { saveInvoiceFromForm, getInvoiceById } from '../../services/invoiceService.js';
import { getPendingInvoice, clearPendingInvoice } from '../../services/pendingInvoiceStore.js';
import { discardDraft } from '../../services/draftService.js';
import { generateInvoicePdfBlob, invoicePdfFileName } from '../../services/pdfService.js';
import { shareOrDownloadPdf, downloadBlob } from '../../services/shareService.js';

const TOOLBAR_HIDE_MS = 3200;
const HINT_FADE_MS = 2400;

export async function render(container, params) {
  const hint = el('div', { class: 'preview-hint' }, ['Tap anywhere to show controls']);
  const scaleWrapper = el('div', { class: 'preview-viewport__scale-wrapper' });
  const toolbar = el('div', { class: 'preview-toolbar' });
  const viewport = el('div', { class: 'preview-viewport' }, [scaleWrapper, hint, toolbar]);

  mount(container, viewport);

  let mode = null; // 'pending' | 'saved'
  let currentInvoiceId = params?.id || null;
  let pendingFormState = null;
  let currentVm = null;
  let hideTimer = null;
  let hintTimer = null;
  let pdfBusy = false;
  let pdfBlobPromise = null;

  async function getPdfBlob() {
    const cached = pdfBlobPromise ? await pdfBlobPromise : null;
    return cached || generateInvoicePdfBlob(currentVm);
  }

  function revealToolbar() {
    toolbar.classList.add('is-visible');
    clearTimeout(hideTimer);
    hideTimer = setTimeout(() => toolbar.classList.remove('is-visible'), TOOLBAR_HIDE_MS);
  }

  function scaleSheet(sheetEl) {
    const naturalWidth = sheetEl.offsetWidth;
    const naturalHeight = sheetEl.offsetHeight;
    const available = Math.min(window.innerWidth - 24, 900);
    const scale = Math.min(1, available / naturalWidth);
    sheetEl.style.transformOrigin = 'top left';
    sheetEl.style.transform = `scale(${scale})`;
    scaleWrapper.style.width = `${naturalWidth * scale}px`;
    scaleWrapper.style.height = `${naturalHeight * scale}px`;
  }

  function onResize() {
    const sheetEl = scaleWrapper.querySelector('.invoice-sheet');
    if (sheetEl) scaleSheet(sheetEl);
  }

  function drawSheet(vm) {
    currentVm = vm;
    scaleWrapper.innerHTML = '';
    const sheetEl = renderInvoiceSheet(vm);
    scaleWrapper.appendChild(sheetEl);
    requestAnimationFrame(() => scaleSheet(sheetEl));
    // Kick off PDF rendering now (not on tap): navigator.share() only works
    // within a short window of real user-gesture activity, and html2canvas
    // takes long enough that awaiting it fresh on every tap risks losing
    // that window. Pre-warming means the common "Save, then Share" tap
    // usually finds this already resolved.
    pdfBlobPromise = generateInvoicePdfBlob(vm).catch((err) => {
      console.error('PDF pre-render failed:', err);
      return null;
    });
  }

  function onBack() {
    history.back();
  }

  function onEdit() {
    if (mode === 'saved') navigate(`#/invoice/${currentInvoiceId}/edit`);
    else history.back();
  }

  /** Persists the pending invoice and switches this screen into "saved" mode. Idempotent once saved. */
  async function persistPending() {
    if (mode !== 'pending') return;
    const saved = await saveInvoiceFromForm(pendingFormState);
    clearPendingInvoice();
    await discardDraft();
    currentInvoiceId = saved.id;
    history.replaceState(null, '', `#/invoice/${saved.id}/preview`);
    await load();
  }

  async function onSave() {
    try {
      await persistPending();
      showToast('Bill saved.', { type: 'success' });
    } catch (err) {
      console.error(err);
      showToast('Could not save the bill. Please try again.', { type: 'error' });
    }
  }

  function onPrint() {
    window.print();
  }

  /** Printing/sharing/exporting an unsaved bill records it first — that's the moment a bill is actually issued. */
  async function ensureSavedThen(action) {
    if (pdfBusy) return;
    pdfBusy = true;
    try {
      await persistPending();
      await action();
    } catch (err) {
      console.error(err);
      showToast('Something went wrong. Please try again.', { type: 'error' });
    } finally {
      pdfBusy = false;
    }
  }

  function onShare() {
    ensureSavedThen(async () => {
      const blob = await getPdfBlob();
      const result = await shareOrDownloadPdf(blob, invoicePdfFileName(currentVm));
      if (result === 'downloaded') {
        showToast('Sharing isn’t supported here — PDF downloaded instead.', { type: 'warning' });
      }
    });
  }

  function onDownloadPdf() {
    ensureSavedThen(async () => {
      const blob = await getPdfBlob();
      downloadBlob(blob, invoicePdfFileName(currentVm));
      showToast('PDF downloaded.', { type: 'success' });
    });
  }

  function drawToolbar() {
    toolbar.innerHTML = '';
    const buttons = [
      { icon: 'chevronLeft', label: 'Back', onClick: onBack },
      { icon: 'edit', label: 'Edit', onClick: onEdit },
      mode === 'pending' ? { icon: 'save', label: 'Save', onClick: onSave } : null,
      { icon: 'printer', label: 'Print', onClick: onPrint },
      { icon: 'share', label: 'Share', onClick: onShare },
      { icon: 'download', label: 'Download', onClick: onDownloadPdf },
    ].filter(Boolean);

    for (const b of buttons) {
      toolbar.appendChild(
        el('button', { class: 'preview-toolbar__btn', type: 'button', onclick: b.onClick }, [
          createIcon(b.icon, { size: 22 }),
          el('span', {}, [b.label]),
        ])
      );
    }
  }

  async function load() {
    const business = await getBusiness();

    if (currentInvoiceId) {
      const invoice = await getInvoiceById(currentInvoiceId);
      if (!invoice) {
        showToast('That bill could not be found.', { type: 'error' });
        navigate('#/bills');
        return;
      }
      mode = 'saved';
      drawSheet(viewModelFromInvoice(invoice, { business }));
    } else {
      const pending = getPendingInvoice();
      if (!pending) {
        navigate('#/invoice/new');
        return;
      }
      mode = 'pending';
      pendingFormState = pending;
      const bank = await getBankById(pending.bankId);
      drawSheet(viewModelFromFormState(pending, { business, bank }));
    }

    drawToolbar();
  }

  await load();

  viewport.addEventListener('click', revealToolbar);
  window.addEventListener('resize', onResize);
  hintTimer = setTimeout(() => {
    hint.style.opacity = '0';
  }, HINT_FADE_MS);

  return {
    destroy() {
      clearTimeout(hideTimer);
      clearTimeout(hintTimer);
      window.removeEventListener('resize', onResize);
    },
  };
}
