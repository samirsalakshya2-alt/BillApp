import { el } from '../../utils/domHelpers.js';
import { createIcon } from './icons.js';

/** Mounts a floating "New Bill" action button into `container`. Call the returned remove() when leaving a screen that shouldn't show it. */
export function mountFab(container, { label = 'New Bill', onClick } = {}) {
  const btn = el(
    'button',
    { class: 'fab', type: 'button', 'aria-label': label, onclick: onClick },
    [createIcon('plus', { size: 26 })]
  );
  container.appendChild(btn);
  return () => btn.remove();
}
