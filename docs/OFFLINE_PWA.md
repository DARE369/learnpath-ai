# Offline-First PWA Architecture (Packet 6.4)

## Overview

LearnPath implements a **Progressive Web App (PWA)** with offline-first architecture, allowing users to continue learning even without internet connection. Changes sync automatically when reconnected.

---

## Core Concepts

### 1. Service Worker Caching Strategy

**Network-First (API calls):**
- Try network first (fastest when online)
- Fall back to cache if offline
- Update cache on successful fetch

**Cache-First (Static assets):**
- Use cache first for speed
- Fall back to network if not cached
- Used for images, styles, scripts

```javascript
// Example: Network-first for API
try {
  const response = await fetch(request);
  cache.put(request, response.clone()); // Update cache
  return response;
} catch (error) {
  return caches.match(request); // Use cache on error
}
```

---

## Installation & Configuration

### 1. Service Worker Registration

The service worker is automatically registered in the app:

```typescript
// frontend/hooks/usePWA.ts
if ("serviceWorker" in navigator) {
  navigator.serviceWorker.register("/sw.js", { scope: "/" });
}
```

### 2. Web App Manifest

Configure in `frontend/public/manifest.json`:

```json
{
  "name": "LearnPath AI",
  "short_name": "LearnPath",
  "start_url": "/dashboard",
  "display": "standalone",
  "theme_color": "#3b82f6",
  "icons": [
    {
      "src": "/icons/icon-192x192.png",
      "sizes": "192x192",
      "type": "image/png",
      "purpose": "any"
    }
  ]
}
```

### 3. HTML Head

Add manifest link in `frontend/pages/_app.tsx`:

```html
<link rel="manifest" href="/manifest.json" />
<link rel="apple-touch-icon" href="/icons/icon-192x192.png" />
<meta name="theme-color" content="#3b82f6" />
```

---

## Offline Sync

### 1. Queueing Offline Changes

When user is offline, changes are queued locally:

```typescript
import { usePWA } from "@/hooks/usePWA";

function VideoPlayer() {
  const { queueOfflineChange, isOnline } = usePWA();

  const handleVideoProgress = (currentTime: number) => {
    if (!isOnline) {
      queueOfflineChange("videoProgress", {
        video_id: videoId,
        current_time: currentTime,
        total_duration: videoDuration,
        timestamp: Date.now(),
      });
    }
  };
}
```

### 2. Sync on Reconnect

Changes automatically sync when connection is restored:

```typescript
const { syncOfflineChanges } = usePWA();

// Called automatically when online event fires
window.addEventListener("online", syncOfflineChanges);
```

### 3. Background Sync API

Register periodic sync for reliability:

```typescript
const { requestPeriodicSync } = usePWA();

// Register to sync quiz responses every 30 minutes
requestPeriodicSync("sync-quiz-responses", 30 * 60 * 1000);
```

---

## Offline Features

### 1. Offline Page

When user is offline, `/offline.html` is served:
- Shows offline status
- Lists available offline features
- Provides retry option
- Auto-detects reconnection

### 2. Offline Indicator

Display status in UI:

```typescript
import { OfflineIndicator } from "@/components/PWA/OfflineIndicator";

export default function Layout() {
  return (
    <>
      <OfflineIndicator /> {/* Shows when offline or syncing */}
      {children}
    </>
  );
}
```

### 3. Supported Offline Features

✓ Watch downloaded videos
✓ Take quizzes (sync when online)
✓ View progress and stats
✓ Read notes and materials
✓ Search local content

### 4. Unsupported Offline Features

✗ Live video streaming
✗ Real-time community chat
✗ Leaderboards
✗ API integrations (Claude, YouTube)

---

## Caching Strategy Details

### Static Assets (Cache-First)

```
GET /css/style.css
GET /js/app.js
GET /images/logo.png
GET /fonts/font.woff2
```

Strategy:
1. Check service worker cache
2. If found, return immediately
3. If not found, fetch from network
4. Cache response for future use

### API Calls (Network-First)

```
GET /api/learning/paths
GET /api/quiz/questions
POST /api/quiz/submit
```

Strategy:
1. Try network first
2. Update cache with response
3. If network fails, use cached response
4. If no cache, show offline page

---

## Cache Sizes

```
STATIC_CACHE     ~5 MB  (HTML, CSS, JS, basic assets)
API_CACHE       ~50 MB  (JSON responses, cached API data)
IMAGE_CACHE    ~100 MB  (Images, avatars, thumbnails)
═════════════════════════
TOTAL          ~155 MB
```

Configure in `frontend/public/sw.js`:

```javascript
// Clean up old caches on activation
caches.keys().then(cacheNames => {
  cacheNames
    .filter(name => !name.endsWith(CACHE_VERSION))
    .forEach(name => caches.delete(name))
})
```

---

## Install Prompt

### 1. PWA Install Prompt Component

Display install button:

```typescript
import { PWAInstallPrompt } from "@/components/PWA/PWAInstallPrompt";

export default function Layout() {
  return (
    <>
      <PWAInstallPrompt /> {/* Shows on installable browsers */}
      {children}
    </>
  );
}
```

### 2. Manual Install

Users can also install via browser menu:
- **Chrome/Edge:** Menu → "Install app"
- **Firefox:** Menu → "Install app"
- **Safari iOS:** Share → "Add to Home Screen"

### 3. Check Installation Status

```typescript
const { isInstalled, isInstallable } = usePWA();

if (isInstalled) {
  console.log("App is installed"); // Show "Installed" badge
}
```

---

## IndexedDB for Local Storage

Service worker uses IndexedDB for storing offline data:

```javascript
// Stores created by service worker:
- quiz_responses    // Unsynced quiz submissions
- video_progress    // Video playback position
- notes             // User notes taken offline
```

API:
```typescript
// Open database
const db = await openDatabase("LearnPathDB");

// Get all unsynced items
const responses = await getAllFromStore(db, "quiz_responses");

// Delete after sync
await deleteFromStore(db, "quiz_responses", responseId);
```

---

## Notifications

### 1. Request Permission

```typescript
const { requestNotificationPermission } = usePWA();

const hasPermission = await requestNotificationPermission();
```

### 2. Send Notification

```typescript
const { sendNotification } = usePWA();

sendNotification("Quiz Completed!", {
  body: "You scored 92% on Biology Quiz",
  icon: "/icons/icon-192x192.png",
  badge: "/icons/badge-192x192.png",
  tag: "quiz-completed",
});
```

### 3. Handle Notification Click

```javascript
// In service worker
self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  clients.openWindow("/dashboard"); // Navigate to dashboard
});
```

---

## Troubleshooting

### Service Worker Not Registering

**Check:**
- `/sw.js` file exists and is served (should be in `public/`)
- HTTPS enabled (or localhost)
- No CORS issues
- Browser supports Service Workers

```javascript
// Verify in browser console
navigator.serviceWorker.getRegistrations().then(registrations => {
  console.log("Registered:", registrations);
});
```

### Cache Not Updating

**Solution:** Clear old caches by incrementing version:

```javascript
// sw.js
const CACHE_VERSION = "v2"; // Changed from v1
```

Service Worker will clean up `v1` caches on next install.

### Offline Changes Not Syncing

**Check:**
1. IndexedDB has items: `indexedDB.databases()`
2. Browser has `sync` permission
3. Connection restored: `navigator.onLine`
4. Service Worker active: DevTools → Application → Service Workers

**Manual sync:**
```typescript
const { syncOfflineChanges } = usePWA();
await syncOfflineChanges();
```

---

## Testing

### 1. Simulate Offline

Chrome DevTools:
1. Open DevTools (F12)
2. Go to "Network" tab
3. Check "Offline"
4. Reload page

### 2. Test Service Worker

Chrome DevTools:
1. Go to "Application" tab
2. Check "Service Workers" section
3. See registered workers
4. View cached files in "Cache Storage"

### 3. Test Offline Sync

```bash
# 1. Load app and go offline
# 2. Submit a quiz
# 3. Check IndexedDB (DevTools → Application → Storage)
# 4. Go online
# 5. Verify sync completed
```

### 4. Test on Mobile

```bash
# iOS (Safari)
Add to Home Screen → Select LearnPath

# Android (Chrome)
Menu → Install app
```

---

## Performance Metrics

Target metrics for PWA:

| Metric | Target |
|--------|--------|
| First Install | <2s |
| App Launch (offline) | <1s |
| Sync Time | <5s |
| Cache Hit Rate | 95%+ |
| Cache Size | <200MB |

Monitor in Chrome DevTools → Lighthouse → PWA score

---

## Security Considerations

### 1. HTTPS Only

Service Workers only work on HTTPS (except localhost):
```
Production: https://learnpath.ai
Development: http://localhost:3000
```

### 2. Cache Validation

Only cache safe responses:
```javascript
if (response.status < 400) {
  cache.put(request, response.clone());
}
```

### 3. Sensitive Data

Don't cache:
- User passwords
- Auth tokens (handle in headers only)
- Credit card info
- Personal documents

---

## Resources

- [Web.dev PWA Checklist](https://web.dev/pwa-checklist/)
- [MDN Service Workers](https://developer.mozilla.org/en-US/docs/Web/API/Service_Worker_API)
- [PWA Builder](https://www.pwabuilder.com/)
- [Can I Use: Service Workers](https://caniuse.com/serviceworkers)

---

## Support

For PWA issues:
- Email: support@learnpath.ai
- GitHub Issues: Tag with `pwa`

