/**
 * BillApp service worker — offline-first app shell caching.
 *
 * There is no backend: every asset this app ever needs is local, so the
 * strategy is simple cache-first-with-network-fallback for everything, and a
 * precache of the full app shell on install so the very first launch after
 * "Add to Home Screen" already works offline.
 *
 * CACHE_VERSION must be bumped whenever any precached file's contents change
 * — the browser won't otherwise know to re-fetch it.
 */

const CACHE_VERSION = 'v12';
const CACHE_NAME = `billapp-shell-${CACHE_VERSION}`;

const PRECACHE_URLS = [
  './',
  './index.html',
  './manifest.webmanifest',

  './css/base.css',
  './css/layout.css',
  './css/components.css',
  './css/invoice-print.css',
  './css/animations.css',

  './assets/SignedSeal.png',

  './libs/jspdf.umd.min.js',
  './libs/html2canvas.min.js',

  './config/business.js',
  './config/appVersion.js',
  './data/seed.js',

  './js/app.js',
  './js/router.js',
  './js/utils/uid.js',
  './js/utils/domHelpers.js',
  './js/utils/validators.js',
  './js/ui/formatters.js',
  './js/ui/components/icons.js',
  './js/ui/components/bottomNav.js',
  './js/ui/components/fab.js',
  './js/ui/components/toast.js',
  './js/ui/components/modal.js',
  './js/ui/components/formField.js',
  './js/ui/components/searchBar.js',
  './js/ui/components/autocomplete.js',
  './js/ui/views/homeView.js',
  './js/ui/views/settingsView.js',
  './js/ui/views/customersView.js',
  './js/ui/views/itemsView.js',
  './js/ui/views/invoiceFormView.js',
  './js/ui/views/invoicePreviewView.js',
  './js/ui/views/billsListView.js',
  './js/ui/views/reportsView.js',
  './js/ui/views/backupView.js',
  './js/ui/renderer/invoiceRenderer.js',

  './js/services/invoiceService.js',
  './js/services/customerService.js',
  './js/services/itemService.js',
  './js/services/numberToWords.js',
  './js/services/draftService.js',
  './js/services/pendingInvoiceStore.js',
  './js/services/invoiceViewModel.js',
  './js/services/pdfService.js',
  './js/services/shareService.js',
  './js/services/reportService.js',
  './js/services/businessService.js',
  './js/services/backupService.js',
  './js/services/autoBackupService.js',

  './js/db/database.js',
  './js/db/backup.js',
  './js/db/stores/businessStore.js',
  './js/db/stores/bankStore.js',
  './js/db/stores/customerStore.js',
  './js/db/stores/itemStore.js',
  './js/db/stores/invoiceStore.js',
  './js/db/stores/settingsStore.js',

  './icons/icon-72.png',
  './icons/icon-96.png',
  './icons/icon-128.png',
  './icons/icon-144.png',
  './icons/icon-152.png',
  './icons/icon-192.png',
  './icons/icon-384.png',
  './icons/icon-512.png',
  './icons/icon-maskable-512.png',
  './icons/apple-touch-icon.png',
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches
      .open(CACHE_NAME)
      .then((cache) => cache.addAll(PRECACHE_URLS))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys
            .filter((key) => key.startsWith('billapp-shell-') && key !== CACHE_NAME)
            .map((key) => caches.delete(key))
        )
      )
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET') return;

  event.respondWith(
    caches.match(request).then((cached) => {
      if (cached) return cached;

      return fetch(request)
        .then((response) => {
          if (response && response.ok) {
            const clone = response.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(request, clone));
          }
          return response;
        })
        .catch(() => {
          if (request.mode === 'navigate') {
            return caches.match('./index.html');
          }
          return undefined;
        });
    })
  );
});
