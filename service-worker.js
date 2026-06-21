self.addEventListener('push',event=>{
  const data=event.data?.json()||{};
  event.waitUntil(self.registration.showNotification(data.title||'Nexus reminder',{
    body:data.body||'You have tasks that need attention.',
    icon:data.icon||'/icon-192.png',
    badge:data.badge||'/icon-192.png',
    data:{url:data.url||'/'},
    tag:'nexus-reminder'
  }));
});

self.addEventListener('notificationclick',event=>{
  event.notification.close();
  event.waitUntil(clients.openWindow(event.notification.data?.url||'/'));
});
