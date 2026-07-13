import { el } from '../../utils/domHelpers.js';

let stackEl = null;

function getStack() {
  if (!stackEl) {
    stackEl = document.getElementById('toastRoot');
  }
  return stackEl;
}

/**
 * Show a transient toast message.
 * @param {string} message
 * @param {{type?: 'default'|'success'|'error'|'warning', duration?: number}} [opts]
 */
export function showToast(message, opts = {}) {
  const { type = 'default', duration = 2600 } = opts;
  const stack = getStack();
  if (!stack) return;

  const classes = ['toast'];
  if (type !== 'default') classes.push(`toast--${type}`);

  const node = el('div', { class: classes.join(' '), role: 'status' }, [message]);
  stack.appendChild(node);

  setTimeout(() => {
    node.style.transition = 'opacity 200ms ease';
    node.style.opacity = '0';
    setTimeout(() => node.remove(), 220);
  }, duration);
}
