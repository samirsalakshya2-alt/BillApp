import { el } from '../../utils/domHelpers.js';
import { formatAmount, formatDateDisplay } from '../formatters.js';

/** The one official logo image, shown beside the business name in the invoice header. */
const LOGO_SRC = 'assets/logo.png';

/**
 * Invoice data -> HTML. This is the ONLY place the invoice layout is defined.
 * The preview screen, window.print(), and the PDF renderer (which rasterizes
 * this exact DOM via html2canvas) all call renderInvoiceSheet with the same
 * view-model shape, so there is exactly one invoice layout to maintain.
 *
 * @param {object} vm - see js/services/invoiceViewModel.js for the shape.
 */
export function renderInvoiceSheet(vm) {
  const dl = (pairs) => el('dl', { class: pairs.class || 'invoice-kv' }, pairs.rows.flatMap(([label, value]) => (
    value ? [el('dt', {}, [label]), el('dd', {}, [String(value)])] : []
  )));

  const phones = vm.business.phones.filter(Boolean);
  const header = el('div', { class: 'invoice-header' }, [
    el('div', { class: 'invoice-header__title-row' }, [
      el('span', { class: 'invoice-header__title' }, [vm.business.invoiceTitle]),
    ]),
    el('div', { class: 'invoice-header__brand-row' }, [
      el('img', { class: 'invoice-header__logo', src: LOGO_SRC, alt: '' }),
      el('span', { class: 'invoice-header__name' }, [vm.business.name]),
    ]),
    el('div', { class: 'invoice-header__address' }, [vm.business.addressLines.join(', ')]),
    vm.business.gstin
      ? el('div', { class: 'invoice-header__gstin' }, [`GSTIN : ${vm.business.gstin}`])
      : null,
    (phones.length || vm.business.email)
      ? el('div', { class: 'invoice-header__contact' }, [
          phones.length ? el('span', {}, [`Mob : ${phones.join(', ')}`]) : null,
          vm.business.email ? el('span', {}, [`Email : ${vm.business.email}`]) : null,
        ])
      : null,
  ]);

  const metaGrid = el('div', { class: 'invoice-meta-grid' }, [
    el('div', {}, [
      el('div', { class: 'invoice-section-title' }, ['Invoice Details']),
      dl({ class: 'invoice-kv invoice-kv--compact', rows: [
        ['Invoice No.', vm.invoiceNumber],
        ['Invoice Date', formatDateDisplay(vm.invoiceDate)],
        ['Date of Supply', formatDateDisplay(vm.dateOfSupply)],
      ] }),
    ]),
    el('div', {}, [
      el('div', { class: 'invoice-section-title' }, ['Bill To']),
      el('div', { class: 'invoice-customer-name' }, [vm.customer.name]),
      vm.customer.address ? el('div', { class: 'invoice-customer-address' }, [vm.customer.address]) : null,
      dl({ rows: [
        ['Customer No.', vm.customer.customerNumber],
        ['GSTIN', vm.customer.gstin],
        ['State / State Code', [vm.customer.state, vm.customer.stateCode].filter(Boolean).join(' / ')],
        ['Place of Supply', vm.customer.placeOfSupply],
      ] }),
    ]),
  ]);

  const hasTransportInfo = vm.transportMode || vm.vehicleNumber || vm.driverName || vm.driverContact || vm.brokerName;
  const transportSection = hasTransportInfo
    ? el('div', { class: 'invoice-transport-section' }, [
        el('div', { class: 'invoice-section-title' }, ['Transportation Details']),
        el('dl', { class: 'invoice-transport-grid' }, [
          ['Transportation Mode', vm.transportMode],
          ['Vehicle Number', vm.vehicleNumber],
          ['Broker Name', vm.brokerName],
          ['Driver Name', vm.driverName],
          ['Driver Contact', vm.driverContact],
        ].map(([label, value]) => el('div', { class: 'invoice-transport-field' }, [
          el('dt', {}, [label]),
          el('dd', {}, [value || ' ']),
        ]))),
      ])
    : null;

  const itemsTable = el('table', { class: 'invoice-items-table' }, [
    el('thead', {}, [
      el('tr', {}, [
        el('th', {}, ['#']),
        el('th', {}, ['Item']),
        el('th', { class: 'num' }, ['Bags']),
        el('th', { class: 'num' }, ['Qty']),
        el('th', { class: 'num' }, ['Rate']),
        el('th', { class: 'num' }, ['Amount']),
      ]),
    ]),
    el('tbody', {}, vm.items.map((item, i) => el('tr', {}, [
      el('td', {}, [String(i + 1)]),
      el('td', {}, [item.name, item.hsn ? el('div', { class: 'u-text-faint', style: 'font-size:10.5px;margin-top:2px;' }, [`HSN ${item.hsn}`]) : null]),
      el('td', { class: 'num' }, [item.bags ? String(item.bags) : '—']),
      el('td', { class: 'num' }, [`${item.qty} ${item.unit || 'Quintal'}`]),
      el('td', { class: 'num' }, [formatAmount(item.rate)]),
      el('td', { class: 'num' }, [formatAmount(item.amount)]),
    ]))),
  ]);

  const totalRow = el('div', { class: 'invoice-total-row' }, [
    el('div', { class: 'invoice-total-row__box' }, [
      el('span', {}, ['Total']),
      el('span', {}, [formatAmount(vm.totalAmount)]),
    ]),
  ]);

  const wordsRow = el('div', { class: 'invoice-words' }, [`Amount in Words: ${vm.amountInWords}`]);

  const bankSealRow = el('div', { class: 'invoice-bank-seal-row' }, [
    el('div', {}, [
      el('div', { class: 'invoice-section-title' }, ['Bank Details']),
      dl({ class: 'invoice-bank-kv', rows: [
        ['Bank', vm.bank.bankName],
        ['Account Name', vm.bank.accountName],
        ['Account No.', vm.bank.accountNumber],
        ['IFSC', vm.bank.ifsc],
        ['Branch', vm.bank.branch],
      ] }),
    ]),
    el('div', { class: 'invoice-seal' }, [
      el('div', { class: 'invoice-seal__for' }, [`For: ${vm.business.name}`]),
      el('img', { src: vm.sealSignatureSrc, alt: 'Seal and authorized signature' }),
      el('div', { class: 'invoice-seal__caption' }, ['Authorized Signatory']),
    ]),
  ]);

  const remarksRow = vm.remarks
    ? el('dl', { class: 'invoice-remarks' }, [el('dt', {}, ['Remarks']), el('dd', { style: 'margin:0;' }, [vm.remarks])])
    : null;

  const footer = el('div', { class: 'invoice-footer' }, ['This is a system-generated bill of supply. Thank you for your business.']);

  return el('div', { class: 'invoice-sheet' }, [
    header, metaGrid, transportSection, itemsTable, totalRow, wordsRow, bankSealRow, remarksRow, footer,
  ]);
}
