
const CACHE_NAME = "art-atlas-v1";

const APP_FILES = [
    "./",
    "./index.html",
    "./manifest.json",
    "./css/style.css",
    "./js/app.js",
    "./images/icon-192.png",
    "./images/icon-512.png"
];

self.addEventListener("install", function(event) {
    event.waitUntil(
        caches.open(CACHE_NAME).then(function(cache) {
            return cache.addAll(APP_FILES);
        })
    );

    self.skipWaiting();
});

self.addEventListener("activate", function(event) {
    event.waitUntil(
        caches.keys().then(function(cacheNames) {
            return Promise.all(
                cacheNames.map(function(cacheName) {
                    if (
                        cacheName.startsWith("art-atlas-") &&
                        cacheName !== CACHE_NAME
                    ) {
                        return caches.delete(cacheName);
                    }
                })
            );
        }).then(function() {
            return self.clients.claim();
        })
    );
});


self.addEventListener("fetch", function(event) {
    if (event.request.method !== "GET") {
        return;
    }

    const requestURL = new URL(event.request.url);
    const isSameOrigin = requestURL.origin === self.location.origin;
    const isImage = event.request.destination === "image";

    if (!isSameOrigin && !isImage) {
        return;
    }

    event.respondWith(
        caches.match(event.request).then(function(cachedResponse) {
            if (cachedResponse) {
                return cachedResponse;
            }

            return fetch(event.request).then(function(response) {
                if (response && (response.ok || response.type === "opaque")) {
                    return caches.open("art-atlas-images-v1").then(
                        function(cache) {
                            cache.put(event.request, response.clone());
                            return response;
                        }
                    );
                }

                return response;
            });
        })
    );
});


            return fetch(event.request);
        })
    );
});

