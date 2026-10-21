
self.skipWaiting();

self.addEventListener("activate", function(event) {
    event.waitUntil(self.clients.claim());
});
