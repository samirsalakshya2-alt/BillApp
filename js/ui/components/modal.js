import { el } from '../../utils/domHelpers.js';

/**
 * Show a bottom-sheet modal. Returns a close() function.
 * @param {{title?: string, body?: Node|string, actions?: Array<{label:string, variant?:string, onClick:Function}>}} opts
 */
export function showModal({ title, body, actions = [], dismissible = true } = {}) {
  const backdrop = el('div', {
    class: 'modal-backdrop',
    onclick: (e) => {
      if (dismissible && e.target === backdrop) close();
    },
  });

  const sheet = el('div', { class: 'modal-sheet' });
  if (title) sheet.appendChild(el('div', { class: 'modal-sheet__title' }, [title]));
  if (body) sheet.appendChild(el('div', { class: 'modal-sheet__body' }, [body]));

  if (actions.length) {
    const actionsEl = el('div', { class: 'modal-sheet__actions' });
    for (const action of actions) {
      const variant = action.variant || 'outline';
      const btn = el(
        'button',
        {
          class: `btn btn--${variant}`,
          onclick: async () => {
            btn.disabled = true;
            try {
              await action.onClick?.();
              if (action.closeOnClick !== false) close();
            } catch (err) {
              console.error(err);
            } finally {
              btn.disabled = false;
            }
          },
        },
        [action.label]
      );
      actionsEl.appendChild(btn);
    }
    sheet.appendChild(actionsEl);
  }

  backdrop.appendChild(sheet);
  document.body.appendChild(backdrop);

  function close() {
    backdrop.remove();
  }

  return close;
}

/** Convenience wrapper for a yes/no confirmation sheet. Resolves true/false. */
export function confirmDialog({ title, message, confirmLabel = 'Confirm', cancelLabel = 'Cancel', danger = false } = {}) {
  return new Promise((resolve) => {
    showModal({
      title,
      body: message,
      dismissible: true,
      actions: [
        { label: cancelLabel, variant: 'outline', onClick: () => resolve(false) },
        { label: confirmLabel, variant: danger ? 'danger' : 'primary', onClick: () => resolve(true) },
      ],
    });
  });
}
