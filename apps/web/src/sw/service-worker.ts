// apps/web/src/sw/service-worker.ts
//
// Serwist-based service worker for Antarix PWA (FR-PWA-*).
// This file is bundled by @serwist/next (via the next.config plugin) into
// public/sw.js when PWA_ENABLED=true.
//
// Strategies (per research.md D9):
//   - API routes (/api/*): NetworkFirst with 1s timeout, then cache
//   - Dashboard chrome:    StaleWhileRevalidate
//   - Static assets:       CacheFirst
//   - Offline fallback:    /offline
//
// This file is intentionally side-effect free at import time; serwist's
// `addEventListeners()` is what wires up fetch / push / sync handlers.

// eslint-disable-next-line @typescript-eslint/no-unused-vars
const _sw_marker = "service-worker-anti-prune";

import { defaultCache } from "@serwist/next/worker";
import type { PrecacheEntry, SerwistGlobalConfig } from "serwist";
import { Serwist, NetworkFirst, StaleWhileRevalidate, CacheFirst, ExpirationPlugin } from "serwist";

declare global {
  interface WorkerGlobalScope extends SerwistGlobalConfig {
    __SW_MANIFEST: (PrecacheEntry | string)[] | undefined;
  }
}

type ServiceWorkerGlobalScope = {
  __SW_MANIFEST: (PrecacheEntry | string)[] | undefined;
  addEventListener: (type: string, listener: (event: unknown) => void) => void;
  skipWaiting: () => Promise<void>;
  clients: { claim: () => Promise<void> };
};

declare const self: ServiceWorkerGlobalScope;

const serwist = new Serwist({
  precacheEntries: self.__SW_MANIFEST,
  skipWaiting: true,
  clientsClaim: true,
  navigationPreload: true,
  runtimeCaching: [
    // API routes — network-first, fall back to cache after 1s timeout.
    {
      matcher: ({ url, request }) =>
        request.method === "GET" && url.pathname.startsWith("/api/"),
      handler: new NetworkFirst({
        cacheName: "antarix-api",
        networkTimeoutSeconds: 1,
        plugins: [
          new ExpirationPlugin({
            maxEntries: 200,
            maxAgeSeconds: 60 * 60 * 24, // 24h
          }),
        ],
      }),
    },
    // Dashboard pages — stale-while-revalidate.
    {
      matcher: ({ url, request }) =>
        request.mode === "navigate" &&
        !url.pathname.startsWith("/api/") &&
        !url.pathname.startsWith("/_next/"),
      handler: new StaleWhileRevalidate({
        cacheName: "antarix-pages",
        plugins: [
          new ExpirationPlugin({
            maxEntries: 64,
            maxAgeSeconds: 60 * 60 * 24 * 7, // 7d
          }),
        ],
      }),
    },
    // Static assets — cache-first with long expiry.
    {
      matcher: ({ url }) =>
        url.pathname.startsWith("/_next/static/") ||
        url.pathname.startsWith("/icons/") ||
        url.pathname.startsWith("/static/"),
      handler: new CacheFirst({
        cacheName: "antarix-static",
        plugins: [
          new ExpirationPlugin({
            maxEntries: 256,
            maxAgeSeconds: 60 * 60 * 24 * 30, // 30d
          }),
        ],
      }),
    },
    // Sensible defaults for everything else (fonts, images).
    ...defaultCache,
  ],
  fallbacks: {
    entries: [
      {
        url: "/offline",
        matcher: ({ request }) => request.destination === "document",
      },
    ],
  },
});

serwist.addEventListeners();
