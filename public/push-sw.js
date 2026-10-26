// No cachea páginas, PDFs ni datos de clientes.
self.addEventListener('push', event => {
  let message;
  try { message = event.data.json(); } catch { return; }
  if (message?.tipo !== 'trabajo_asignado') return;
  event.waitUntil(self.registration.showNotification('Croacia: trabajo asignado', {
    body: 'Tenés un trabajo asignado. Abrí la app para ver el detalle.',
    icon: '/logo.png', badge: '/logo.png', tag: 'croacia-asignacion-' + String(message.evento),
    data: { url: '/trabajos' },
  }));
});
self.addEventListener('notificationclick', event => {
  event.notification.close();
  event.waitUntil(clients.openWindow('/trabajos'));
});
