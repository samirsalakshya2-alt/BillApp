import { el, debounce } from '../../utils/domHelpers.js';
import { createIcon } from './icons.js';

/** A search input styled as a pill bar. Calls onChange(query) debounced as the user types. */
export function searchBar({ placeholder = 'Search…', onChange, debounceMs = 200 } = {}) {
  const input = el('input', {
    type: 'search',
    placeholder,
    autocomplete: 'off',
    oninput: debounce((e) => onChange?.(e.target.value.trim()), debounceMs),
  });

  return el('div', { class: 'search-bar' }, [createIcon('search', { size: 18 }), input]);
}
