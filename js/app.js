import { registerRoute, initRouter } from './router.js';
import { mountBottomNav } from './ui/components/bottomNav.js';
import * as homeView from './ui/views/homeView.js';
import * as settingsView from './ui/views/settingsView.js';
import * as customersView from './ui/views/customersView.js';
import * as itemsView from './ui/views/itemsView.js';
import * as invoiceFormView from './ui/views/invoiceFormView.js';
import * as invoicePreviewView from './ui/views/invoicePreviewView.js';
import * as billsListView from './ui/views/billsListView.js';
import * as reportsView from './ui/views/reportsView.js';
import * as backupView from './ui/views/backupView.js';
import { seedIfNeeded } from '../data/seed.js';
import { showToast } from './ui/components/toast.js';

// Every route now points at its real view module — no placeholders remain.
registerRoute('/home', homeView, { title: 'BillApp' });
registerRoute('/bills', billsListView, { title: 'Bills' });
registerRoute('/reports', reportsView, { title: 'Reports' });
registerRoute('/settings', settingsView, { title: 'Settings' });
registerRoute('/customers', customersView, { title: 'Customers' });
registerRoute('/items', itemsView, { title: 'Items' });
registerRoute('/backup', backupView, { title: 'Backup', showBack: true, backTo: '#/home' });
registerRoute('/invoice/new', invoiceFormView, { title: 'New Bill', showBack: true, backTo: '#/home' });
registerRoute('/invoice/:id/edit', invoiceFormView, { title: 'Edit Bill', showBack: true, backTo: '#/bills' });
registerRoute('/invoice/preview', invoicePreviewView, { title: 'Preview', chromeless: true });
registerRoute('/invoice/:id/preview', invoicePreviewView, { title: 'Preview', chromeless: true });

async function bootstrap() {
  try {
    await seedIfNeeded();
  } catch (err) {
    console.error('Database seed failed:', err);
    showToast('Could not initialize local storage. Try reloading.', { type: 'error' });
  }

  initRouter({
    header: document.getElementById('appHeader'),
    main: document.getElementById('appMain'),
    bottomNavRoot: document.getElementById('bottomNavRoot'),
    fabRoot: document.getElementById('fabRoot'),
  });

  mountBottomNav(document.getElementById('bottomNavRoot'));
}

function registerServiceWorker() {
  if (!('serviceWorker' in navigator)) return;
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('./sw.js').catch((err) => {
      console.error('Service worker registration failed:', err);
    });
  });
}

bootstrap();
registerServiceWorker();
