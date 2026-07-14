import { renderInvoiceSheet } from '../ui/renderer/invoiceRenderer.js';

/**
 * Renders a *fresh*, untransformed copy of the invoice sheet off-screen and
 * rasterizes it with html2canvas, then embeds that image into an A4 jsPDF
 * document. Building a new node (rather than reusing whatever's on screen)
 * means the PDF is never affected by the preview's fit-to-viewport CSS scale.
 */
async function renderSheetOffscreen(vm) {
  const sheetEl = renderInvoiceSheet(vm);
  const host = document.createElement('div');
  host.style.position = 'fixed';
  host.style.left = '-10000px';
  host.style.top = '0';
  host.style.pointerEvents = 'none';
  host.appendChild(sheetEl);
  document.body.appendChild(host);

  const images = Array.from(sheetEl.querySelectorAll('img')).filter((img) => !img.complete);
  await Promise.all(images.map((img) => new Promise((resolve) => {
    img.addEventListener('load', resolve, { once: true });
    img.addEventListener('error', resolve, { once: true });
  })));

  return { sheetEl, cleanup: () => host.remove() };
}

/** Builds an A4 PDF Blob for the given invoice view model. */
export async function generateInvoicePdfBlob(vm) {
  if (!window.html2canvas || !window.jspdf) {
    throw new Error('PDF engine failed to load. Check your connection and reload the app.');
  }

  const { sheetEl, cleanup } = await renderSheetOffscreen(vm);
  try {
    const canvas = await window.html2canvas(sheetEl, {
      scale: 2,
      useCORS: true,
      backgroundColor: '#ffffff',
    });

    const imgData = canvas.toDataURL('image/jpeg', 0.95);
    const { jsPDF } = window.jspdf;
    const pdf = new jsPDF({ unit: 'mm', format: 'a4', orientation: 'portrait' });

    const pageWidth = pdf.internal.pageSize.getWidth();
    const pageHeight = pdf.internal.pageSize.getHeight();
    let imgWidth = pageWidth;
    let imgHeight = (canvas.height * imgWidth) / canvas.width;

    // The sheet is designed to fit one A4 page, but canvas pixel rounding can
    // push imgHeight a hair past pageHeight — scale down (never up) to fit
    // rather than spilling a near-blank second page.
    if (imgHeight > pageHeight) {
      imgWidth = (imgWidth * pageHeight) / imgHeight;
      imgHeight = pageHeight;
    }

    const x = (pageWidth - imgWidth) / 2;
    pdf.addImage(imgData, 'JPEG', x, 0, imgWidth, imgHeight);

    return pdf.output('blob');
  } finally {
    cleanup();
  }
}

export function invoicePdfFileName(vm) {
  const safeCustomer = (vm.customer.name || 'Customer').replace(/[^a-z0-9]+/gi, '-').replace(/(^-|-$)/g, '');
  return `Invoice-${vm.invoiceNumber}-${safeCustomer}.pdf`;
}
