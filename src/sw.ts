/// <reference lib="webworker" />
// Custom service worker for BotanyBuddy.
// - Precaches the app shell using the manifest injected by vite-plugin-pwa.
// - Runtime-caches plant photos so the app works offline for viewing.
// - Handles web push notifications + click → open the right plant page.

import { precacheAndRoute, cleanupOutdatedCaches } from "workbox-precaching";
import { registerRoute, NavigationRoute } from "workbox-routing";
import { CacheFirst, NetworkOnly } from "workbox-strategies";
import { ExpirationPlugin } from "workbox-expiration";
import { CacheableResponsePlugin } from "workbox-cacheable-response";

declare const self: ServiceWorkerGlobalScope & {
  __WB_MANIFEST: Array<{ url: string; revision: string | null }>;
};

cleanupOutdatedCaches();
precacheAndRoute(self.__WB_MANIFEST);

// SPA navigations → fall back to index.html offline.
registerRoute(new NavigationRoute(async () => (await caches.match("/index.html")) || Response.error()));

// Plant photos: cache-first.
registerRoute(
  ({ url }) =>
    url.hostname.endsWith(".supabase.co") && url.pathname.includes("/storage/"),
  new CacheFirst({
    cacheName: "plant-photos",
    plugins: [
      new CacheableResponsePlugin({ statuses: [0, 200] }),
      new ExpirationPlugin({
        maxEntries: 200,
        maxAgeSeconds: 60 * 60 * 24 * 30,
      }),
    ],
  }),
);

// Don't cache live data / Grok / auth.
registerRoute(
  ({ url }) =>
    url.pathname.includes("/functions/v1/") ||
    url.pathname.includes("/rest/v1/") ||
    url.pathname.includes("/auth/v1/"),
  new NetworkOnly(),
);

// ---------------------------------------------------------------------------
// Web Push handlers
// ---------------------------------------------------------------------------

interface PushPayload {
  title?: string;
  body?: string;
  url?: string;
  tag?: string;
}

self.addEventListener("push", (event) => {
  if (!event.data) return;
  let payload: PushPayload = {};
  try {
    payload = event.data.json() as PushPayload;
  } catch {
    payload = { title: "BotanyBuddy", body: event.data.text() };
  }

  const title = payload.title ?? "BotanyBuddy";
  const options: NotificationOptions = {
    body: payload.body,
    icon: "/icon-192.png",
    badge: "/icon-192.png",
    tag: payload.tag ?? "grok-garden",
    data: { url: payload.url ?? "/" },
  };

  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const url = (event.notification.data as { url?: string } | undefined)?.url ?? "/";
  event.waitUntil(
    (async () => {
      const all = await self.clients.matchAll({ type: "window", includeUncontrolled: true });
      for (const c of all) {
        if (new URL(c.url).origin === self.location.origin) {
          await c.focus();
          const nav = (c as WindowClient & {
            navigate?: (u: string) => Promise<unknown>;
          }).navigate;
          if (typeof nav === "function") return nav.call(c, url);
        }
      }
      await self.clients.openWindow(url);
    })(),
  );
});

self.addEventListener("message", (event) => {
  if (event.data === "SKIP_WAITING") self.skipWaiting();
});
