/** Triggers a browser download of a Blob — the universal fallback when native sharing isn't available. */
export function downloadBlob(blob, fileName) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = fileName;
  document.body.appendChild(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}

export function canShareFiles() {
  return typeof navigator.share === 'function' && typeof navigator.canShare === 'function';
}

/**
 * Opens Android's native share sheet with the PDF as a real file (so
 * WhatsApp/Gmail/etc. see an attachment, not a link). Falls back to a plain
 * download when the Web Share API or file sharing isn't supported.
 * @returns {'shared'|'downloaded'|'cancelled'}
 */
export async function shareOrDownloadPdf(blob, fileName) {
  const file = new File([blob], fileName, { type: 'application/pdf' });

  if (canShareFiles() && navigator.canShare({ files: [file] })) {
    try {
      await navigator.share({ files: [file], title: fileName });
      return 'shared';
    } catch (err) {
      if (err && err.name === 'AbortError') return 'cancelled';
      // Any await before this point (saving to IndexedDB, rendering the PDF)
      // can cost the "user gesture" the Web Share API requires — browsers
      // respond with NotAllowedError in that case. Don't strand the user
      // without their file: fall back to a plain download instead.
      console.warn('navigator.share failed, falling back to download:', err);
    }
  }

  downloadBlob(blob, fileName);
  return 'downloaded';
}
