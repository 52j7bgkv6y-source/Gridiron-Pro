/* ─────────────────────────────────────────────────────────────────────────────
   GRIDIRON service worker
   Strategy:
   • Navigations (the app page itself): NETWORK-FIRST so every online open gets
     the freshest deploy — but with two speed upgrades for bad internet:
       1. The request allows HTTP revalidation (ETag/304), so an unchanged
          deploy costs ~1KB instead of re-downloading the whole app.
       2. A 2.5s timeout: if the network is alive-but-awful, the cached copy
          opens the app immediately and the slow response quietly refreshes
          the cache in the background for next time. Offline falls straight
          back to cache.
   • CDN libraries (React, ReactDOM, Supabase client, three.js) and Google
     Fonts: CACHE-FIRST — near-instant opens on slow school WiFi. Babel is
     gone: the shell ships precompiled inside index.html.
   • Supabase API traffic: NEVER intercepted (auth + live team data must
     always hit the network directly).
   Bump VERSION if you ever need to force old caches out.
   ──────────────────────────────────────────────────────────────────────────── */
const VERSION = "gridiron-v3";
const APP_CACHE = VERSION + "-app";
const LIB_CACHE = VERSION + "-lib";
const NAV_TIMEOUT_MS = 2500;

const LIB_URLS = [
  "https://unpkg.com/react@18/umd/react.production.min.js",
  "https://unpkg.com/react-dom@18/umd/react-dom.production.min.js",
  "https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2",
  "https://cdnjs.cloudflare.com/ajax/libs/three.js/r128/three.min.js",
];
// Identity of a cached/fetched page. ETag is what Netlify sends; the others are
// fallbacks. Null means "can't tell" — we then never claim an update.
const buildId = (res) => {
  if (!res || !res.headers) return null;
  return res.headers.get("ETag") || res.headers.get("Last-Modified") || null;
};
const LIB_HOSTS = ["unpkg.com", "cdn.jsdelivr.net", "cdnjs.cloudflare.com", "fonts.googleapis.com", "fonts.gstatic.com"];

self.addEventListener("install", (e) => {
  e.waitUntil((async () => {
    const app = await caches.open(APP_CACHE);
    // {cache:"reload"} on the page itself: the precached copy must come from
    // the network, never from a stale HTTP cache entry.
    try {
      await app.addAll([
        new Request("./", { cache: "reload" }),
        "./manifest.webmanifest",
        "./icon-192.png",
        "./icon-512.png",
        "./icon-512-maskable.png",
        "./apple-touch-icon.png",
      ]);
    } catch (err) {}
    const lib = await caches.open(LIB_CACHE);
    await Promise.all(LIB_URLS.map(async (u) => {
      try { await lib.add(new Request(u, { mode: "no-cors" })); } catch (err) {}
    }));
    self.skipWaiting();
  })());
});

self.addEventListener("activate", (e) => {
  e.waitUntil((async () => {
    const names = await caches.keys();
    await Promise.all(names.map((n) => (n.startsWith(VERSION) ? null : caches.delete(n))));
    await self.clients.claim();
  })());
});

self.addEventListener("fetch", (e) => {
  const req = e.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);

  // Live data: hands off. Let auth and team queries hit the network directly.
  if (url.hostname.endsWith(".supabase.co")) return;

  // The app page: fresh when online, instant when the network is bad or dead.
  if (req.mode === "navigate") {
    e.respondWith((async () => {
      const app = await caches.open(APP_CACHE);
      // The build identity of what we're about to serve, so we can tell whether
      // a late-arriving response is actually a NEW deploy or the same bytes.
      const before = await app.match("./");
      let servedStale = false;
      const network = fetch(req, { cache: "no-cache" }).then(async (fresh) => {
        if (fresh && fresh.ok) {
          await app.put("./", fresh.clone());
          // If the page is already showing the OLD copy (we lost the race) and
          // this really is a different build, surface an update prompt instead
          // of silently leaving them a version behind until the next open.
          if (servedStale && buildId(before) && buildId(fresh) && buildId(before) !== buildId(fresh)) {
            const cs = await self.clients.matchAll({ type: "window" });
            cs.forEach((c) => c.postMessage({ type: "gp-update-ready" }));
          }
        }
        return fresh;
      });
      // Keep the worker alive so a response that arrives after the timeout
      // still lands in the cache for the NEXT open.
      e.waitUntil(network.catch(() => {}));
      const timer = new Promise((res) => setTimeout(() => res(null), NAV_TIMEOUT_MS));
      const winner = await Promise.race([network.catch(() => null), timer]);
      if (winner) return winner;
      servedStale = true;
      const cached = (await app.match("./")) || (await app.match(req));
      if (cached) return cached;
      // First-ever visit on a slow link: nothing cached yet, wait it out.
      try { return await network; } catch (err) { return Response.error(); }
    })());
    return;
  }

  // Libraries + fonts: cache-first, fill on miss.
  if (LIB_HOSTS.includes(url.hostname)) {
    e.respondWith((async () => {
      const lib = await caches.open(LIB_CACHE);
      const hit = await lib.match(req, { ignoreVary: true });
      if (hit) return hit;
      try {
        const res = await fetch(req);
        if (res && (res.ok || res.type === "opaque")) lib.put(req, res.clone());
        return res;
      } catch (err) {
        return Response.error();
      }
    })());
    return;
  }

  // Same-origin assets (icons, manifest): cache-first with network fill.
  if (url.origin === self.location.origin) {
    e.respondWith((async () => {
      const app = await caches.open(APP_CACHE);
      const hit = await app.match(req);
      if (hit) return hit;
      try {
        const res = await fetch(req);
        if (res && res.ok) app.put(req, res.clone());
        return res;
      } catch (err) {
        return Response.error();
      }
    })());
  }
});
