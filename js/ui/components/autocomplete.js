import { el, debounce } from '../../utils/domHelpers.js';

/**
 * A text input with a debounced suggestion dropdown. Used for customer and
 * item lookup on the invoice form — typing a name that doesn't match
 * anything is valid too (it just means a new customer/item on save).
 *
 * @param {{inputProps?: object, fetchOptions: (query:string) => Promise<any[]>, renderOption: (opt:any) => {title:string, subtitle?:string}, onSelect: (opt:any) => void}} opts
 * @returns {{wrapper: HTMLElement, input: HTMLInputElement}}
 */
export function makeAutocomplete({ inputProps = {}, fetchOptions, renderOption, onSelect }) {
  const input = el('input', { class: 'field__input', autocomplete: 'off', ...inputProps });
  const list = el('div', { class: 'autocomplete__list u-hidden' });
  const wrapper = el('div', { class: 'autocomplete' }, [input, list]);

  function hide() {
    list.classList.add('u-hidden');
    list.innerHTML = '';
  }

  async function updateList(query) {
    const options = await fetchOptions(query);
    if (!options.length) {
      hide();
      return;
    }
    list.innerHTML = '';
    for (const opt of options) {
      const { title, subtitle } = renderOption(opt);
      list.appendChild(
        el('div', {
          class: 'autocomplete__option',
          onclick: () => {
            onSelect(opt);
            hide();
          },
        }, [
          el('div', { class: 'autocomplete__option-title' }, [title]),
          subtitle ? el('div', { class: 'autocomplete__option-subtitle' }, [subtitle]) : null,
        ])
      );
    }
    list.classList.remove('u-hidden');
  }

  const debouncedUpdate = debounce(() => updateList(input.value), 150);
  input.addEventListener('input', debouncedUpdate);
  input.addEventListener('focus', () => {
    if (input.value) updateList(input.value);
  });
  document.addEventListener('click', (e) => {
    if (!wrapper.contains(e.target)) hide();
  });

  return { wrapper, input };
}
