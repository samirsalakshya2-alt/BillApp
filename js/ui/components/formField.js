import { el } from '../../utils/domHelpers.js';

/** Wraps a labeled input in the standard `.field` layout — reused by every master/invoice form. */
export function formField(label, inputNode, { hint } = {}) {
  const children = [el('label', { class: 'field__label' }, [label]), inputNode];
  if (hint) children.push(el('div', { class: 'field__hint' }, [hint]));
  return el('div', { class: 'field' }, children);
}

export function textInput(props = {}) {
  return el('input', { class: 'field__input', type: 'text', ...props });
}

export function numberInput(props = {}) {
  return el('input', { class: 'field__input', type: 'number', ...props });
}
