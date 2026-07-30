/**
 * Service Worker for Offline-First PWA (Packet 6.4)
 * Network-first strategy for API calls, cache-first for static assets
 */

const CACHE_VERSION = "v4";
const STATIC_CACHE = `learnpath-static-${CACHE_VERSION}`;
const API_CACHE = `learnpath-api-${CACHE_VERSION}`;
const IMAGE_CACHE = `learnpath-images-${CACHE_VERSION}`;

// Static assets to cache on install
const STATIC_ASSETS = [
  "/",
  "/dashboard",
  "/learning",
  "/offline.html",
  "/manifest.json",
  "/favicon.ico",
];

/**
 * Install event: Cache static assets
 */
self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(STATIC_CACHE).then((cache) => {
      console.log("[SW] Caching static assets");
      // Cache each asset independently so a single missing/404 asset doesn't
      // abort the entire install (cache.addAll is all-or-nothing).
      return Promise.allSettled(
        STATIC_ASSETS.map((url) =>
          cache
            .add(new Request(url, { cache: "reload" }))
            .catch((err) => console.warn("[SW] Skipped caching", url, err))
        )
      );
    })
  );
  self.skipWaiting(); // Activate immediately
});

/**
 * Activate event: Clean up old caches
 */
self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames
          .filter((name) => {
            const isOldCache =
              name.startsWith("learnpath-") && !name.endsWith(CACHE_VERSION);
            return isOldCache;
          })
          .map((name) => {
            console.log("[SW] Deleting old cache:", name);
            return caches.delete(name);
          })
      );
    })
  );
  self.clients.claim(); // Claim all clients immediately
});

/**
 * Fetch event: Network-first strategy for API, cache-first for assets
 */
self.addEventListener("fetch", (event) => {
  const { request } = event;

  // Only GET is cacheable. Let POST/PUT/DELETE/etc. (uploads, mutations) go
  // straight to the network — intercepting them breaks the Cache API.
  if (request.method !== "GET") return;

  const url = new URL(request.url);

  // Intercept any insecure http:// request to a cross-origin backend and rewrite
  // it to go through the Vercel HTTPS proxy (same-origin /api/*) instead. This
  // handles the case where the JS bundle was built with NEXT_PUBLIC_API_URL set
  // to http:// — the SW upgrades it to a safe same-origin HTTPS request before
  // the browser can trigger a mixed-content block.
  //
  // NOTE: host-agnostic on purpose. The backend moved Railway -> Fly (.fly.dev),
  // and a hardcoded ".railway.app" check silently stopped catching the new host,
  // reintroducing mixed-content blocks. Match on protocol + cross-origin instead
  // so it survives future backend host changes.
  if (
    self.location.protocol === "https:" &&
    url.protocol === "http:" &&
    url.hostname !== "localhost" &&
    url.hostname !== "127.0.0.1" &&
    url.hostname !== self.location.hostname
  ) {
    const proxyUrl = "https://" + self.location.hostname + url.pathname + url.search;
    return event.respondWith(
      fetch(new Request(proxyUrl, {
        method: request.method,
        headers: request.headers,
        credentials: request.credentials,
      }))
    );
  }

  // API calls (same-origin /api/...): do NOT intercept — let the browser send
  // these directly through Next.js's server-side proxy rewrite to Railway.
  // Calling respondWith(fetch) here would chain the SW into the request and
  // cause "promise rejected" FetchEvent errors when the upstream fails.
  if (url.pathname.startsWith("/api/")) {
    return;
  }

  // Images: Cache-first
  if (request.destination === "image") {
    return event.respondWith(cacheFirstStrategy(request, IMAGE_CACHE));
  }

  // Static assets: Cache-first
  if (
    request.destination === "style" ||
    request.destination === "script" ||
    request.destination === "font"
  ) {
    return event.respondWith(cacheFirstStrategy(request, STATIC_CACHE));
  }

  // HTML pages: Network-first
  if (request.mode === "navigate") {
    return event.respondWith(networkFirstStrategy(request));
  }

  // Default: Network-first
  event.respondWith(networkFirstStrategy(request));
});

/**
 * Network-first strategy
 * Try network first, fallback to cache if offline
 */
async function networkFirstStrategy(request) {
  try {
    const response = await fetch(request);

    // Only cache safe, cacheable GET responses (never POST/etc.).
    if (request.method === "GET" && response.ok && request.url.startsWith(self.location.origin)) {
      const cache = await caches.open(API_CACHE);
      cache.put(request, response.clone());
    }

    return response;
  } catch (error) {
    // Network failed, try cache
    const cachedResponse = await caches.match(request);
    if (cachedResponse) {
      console.log("[SW] Using cached response for:", request.url);
      return cachedResponse;
    }

    // No cache, return offline page for navigation
    if (request.mode === "navigate") {
      return caches.match("/offline.html");
    }

    // Return error response
    return new Response("Network error and no cache available", {
      status: 503,
      statusText: "Service Unavailable",
    });
  }
}

/**
 * Cache-first strategy
 * Use cache if available, fallback to network
 */
async function cacheFirstStrategy(request, cacheName) {
  const cached = await caches.match(request);
  if (cached) {
    return cached;
  }

  try {
    const response = await fetch(request);
    if (response.ok) {
      const cache = await caches.open(cacheName);
      cache.put(request, response.clone());
    }
    return response;
  } catch (error) {
    console.log("[SW] Cache-first failed for:", request.url);
    return new Response("Resource not available", {
      status: 503,
      statusText: "Service Unavailable",
    });
  }
}

/**
 * Background sync for offline changes
 * Sync when connection is restored
 */
self.addEventListener("sync", (event) => {
  if (event.tag === "sync-quiz-responses") {
    event.waitUntil(syncQuizResponses());
  }

  if (event.tag === "sync-video-progress") {
    event.waitUntil(syncVideoProgress());
  }

  if (event.tag === "sync-notes") {
    event.waitUntil(syncNotes());
  }
});

/**
 * Sync quiz responses from IndexedDB to server
 */
async function syncQuizResponses() {
  try {
    const db = await openDatabase();
    const responses = await getAllFromStore(db, "quiz_responses");

    for (const response of responses) {
      try {
        const fetchResponse = await fetch("/api/quiz/submit", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(response),
        });

        if (fetchResponse.ok) {
          // Remove from local DB after sync
          await deleteFromStore(db, "quiz_responses", response.id);
          console.log("[SW] Synced quiz response:", response.id);
        }
      } catch (error) {
        console.error("[SW] Failed to sync quiz response:", error);
      }
    }
  } catch (error) {
    console.error("[SW] Background sync failed:", error);
  }
}

/**
 * Sync video progress from IndexedDB to server
 */
async function syncVideoProgress() {
  try {
    const db = await openDatabase();
    const progressUpdates = await getAllFromStore(db, "video_progress");

    for (const update of progressUpdates) {
      try {
        const fetchResponse = await fetch(
          `/api/learning/progress/${update.video_id}`,
          {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              current_time: update.current_time,
              total_duration: update.total_duration,
            }),
          }
        );

        if (fetchResponse.ok) {
          await deleteFromStore(db, "video_progress", update.id);
          console.log("[SW] Synced video progress:", update.video_id);
        }
      } catch (error) {
        console.error("[SW] Failed to sync video progress:", error);
      }
    }
  } catch (error) {
    console.error("[SW] Video progress sync failed:", error);
  }
}

/**
 * Sync notes from IndexedDB to server
 */
async function syncNotes() {
  try {
    const db = await openDatabase();
    const notes = await getAllFromStore(db, "notes");

    for (const note of notes) {
      try {
        const fetchResponse = await fetch("/api/learning/notes", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(note),
        });

        if (fetchResponse.ok) {
          await deleteFromStore(db, "notes", note.id);
          console.log("[SW] Synced note:", note.id);
        }
      } catch (error) {
        console.error("[SW] Failed to sync note:", error);
      }
    }
  } catch (error) {
    console.error("[SW] Notes sync failed:", error);
  }
}

/**
 * IndexedDB helpers
 */
function openDatabase() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open("LearnPathDB", 1);

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);

    request.onupgradeneeded = (event) => {
      const db = event.target.result;
      if (!db.objectStoreNames.contains("quiz_responses")) {
        db.createObjectStore("quiz_responses", { keyPath: "id" });
      }
      if (!db.objectStoreNames.contains("video_progress")) {
        db.createObjectStore("video_progress", { keyPath: "id" });
      }
      if (!db.objectStoreNames.contains("notes")) {
        db.createObjectStore("notes", { keyPath: "id" });
      }
    };
  });
}

function getAllFromStore(db, storeName) {
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(storeName, "readonly");
    const store = transaction.objectStore(storeName);
    const request = store.getAll();

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

function deleteFromStore(db, storeName, key) {
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(storeName, "readwrite");
    const store = transaction.objectStore(storeName);
    const request = store.delete(key);

    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
}

/**
 * Push notifications for background updates
 */
self.addEventListener("push", (event) => {
  if (!event.data) return;

  const data = event.data.json();
  const options = {
    badge: "/icons/icon-192x192.png",
    icon: "/icons/icon-192x192.png",
    title: data.title || "LearnPath",
    body: data.message || "",
    vibrate: [200, 100, 200],
    tag: data.tag || "learnpath",
    data: {
      url: data.url || "/dashboard",
    },
  };

  event.waitUntil(self.registration.showNotification(options.title, options));
});

/**
 * Handle notification clicks
 */
self.addEventListener("notificationclick", (event) => {
  event.notification.close();

  const url = event.notification.data.url;
  event.waitUntil(
    clients
      .matchAll({ type: "window", includeUncontrolled: true })
      .then((windowClients) => {
        // Try to focus existing window
        for (let i = 0; i < windowClients.length; i++) {
          if (windowClients[i].url === url) {
            return windowClients[i].focus();
          }
        }
        // Open new window if not found
        return clients.openWindow(url);
      })
  );
});
