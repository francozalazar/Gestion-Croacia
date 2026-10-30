// No cachea páginas, PDFs ni datos de clientes. Tags estables evitan avisos visuales repetidos.
self.addEventListener('push', event => {
  let message;
  try { message = event.data.json(); } catch { return; }
  const tecnico = message?.tipo === 'trabajo_asignado';
  if (!tecnico && message?.tipo !== 'circuito') return;
  event.waitUntil(self.registration.showNotification(tecnico ? 'Croacia: trabajo asignado' : message.titulo, {
    body: tecnico ? 'Tenés un trabajo asignado. Abrí la app para ver el detalle.' : message.cuerpo,
    icon: '/logo.png', badge: '/logo.png', tag: (tecnico ? 'croacia-asignacion-' : 'croacia-circuito-') + String(message.evento),
    renotify: false, data: { url: tecnico ? '/trabajos' : '/dashboard' },
  }));
});
self.addEventListener('notificationclick', event => {
  event.notification.close();
  const url = event.notification.data?.url === '/trabajos' ? '/trabajos' : '/dashboard';
  event.waitUntil(clients.openWindow(url));
});
