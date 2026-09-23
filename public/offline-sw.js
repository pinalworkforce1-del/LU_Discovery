const ENGINE_VERSION = "1.0.1";
const CACHE_PREFIX = "level-up-offline";
const scopeUrl = new URL(self.registration.scope);
const scopeKey = scopeUrl.pathname.replace(/[^a-z0-9]+/gi, "-").replace(/^-|-$/g, "") || "root";
const CACHE_NAME = `${CACHE_PREFIX}-${scopeKey}-v${ENGINE_VERSION}`;
const MANIFEST_URL = new URL("offline-manifest.json", self.registration.scope).toString();

self.addEventListener("install", (event) => {
  event.waitUntil((async () => {
    const cache = await caches.open(CACHE_NAME);
    for (const url of [self.registration.scope, MANIFEST_URL]) {
      try {
        const response = await fetch(url, { cache: "no-store" });
        if (response.ok) await cache.put(url, response.clone());
      } catch (_) {}
    }
    await self.skipWaiting();
  })());
});

self.addEventListener("activate", (event) => {
  event.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys
      .filter((key) => key.startsWith(CACHE_PREFIX + "-" + scopeKey + "-") && key !== CACHE_NAME)
      .map((key) => caches.delete(key)));
    await self.clients.claim();
  })());
});

function inScope(url) {
  return url.origin === scopeUrl.origin && url.pathname.startsWith(scopeUrl.pathname);
}

function cacheable(response) {
  return response && response.ok && response.type !== "opaque" && response.status !== 206;
}

async function cachedMatch(cache, request) {
  return cache.match(request, { ignoreSearch: true, ignoreVary: true });
}

async function rangedResponse(request, cached) {
  const range = request.headers.get("range");
  if (!range) return cached;

  const match = /^bytes=(\d*)-(\d*)$/.exec(range.trim());
  if (!match) return cached;

  const blob = await cached.blob();
  const size = blob.size;
  let start;
  let end;

  if (match[1] === "" && match[2] === "") return cached;

  if (match[1] === "") {
    const suffix = Number(match[2]);
    if (!Number.isFinite(suffix) || suffix <= 0) return cached;
    start = Math.max(0, size - suffix);
    end = size - 1;
  } else {
    start = Number(match[1]);
    end = match[2] === "" ? size - 1 : Number(match[2]);
  }

  if (!Number.isFinite(start) || !Number.isFinite(end) || start < 0 || start >= size || end < start) {
    return new Response(null, {
      status: 416,
      statusText: "Range Not Satisfiable",
      headers: { "Content-Range": `bytes */${size}` }
    });
  }

  end = Math.min(end, size - 1);
  const type = cached.headers.get("content-type") || blob.type || "application/octet-stream";
  const slice = blob.slice(start, end + 1, type);
  return new Response(slice, {
    status: 206,
    statusText: "Partial Content",
    headers: {
      "Content-Type": type,
      "Content-Range": `bytes ${start}-${end}/${size}`,
      "Content-Length": String(end - start + 1),
      "Accept-Ranges": "bytes"
    }
  });
}

self.addEventListener("fetch", (event) => {
  const request = event.request;
  if (request.method !== "GET") return;
  const url = new URL(request.url);
  if (!inScope(url)) return;

  if (request.mode === "navigate") {
    event.respondWith((async () => {
      const cache = await caches.open(CACHE_NAME);
      try {
        const response = await fetch(request);
        if (cacheable(response)) {
          try { await cache.put(request, response.clone()); } catch (_) {}
        }
        return response;
      } catch (_) {
        return (await cachedMatch(cache, request)) ||
          (await cache.match(new URL("index.html", self.registration.scope).toString(), { ignoreSearch: true, ignoreVary: true })) ||
          (await cache.match(self.registration.scope, { ignoreSearch: true, ignoreVary: true })) ||
          Response.error();
      }
    })());
    return;
  }

  event.respondWith((async () => {
    const cache = await caches.open(CACHE_NAME);
    const cached = await cachedMatch(cache, request);

    if (cached) {
      if (!request.headers.has("range")) {
        event.waitUntil(fetch(request).then(async (response) => {
          if (cacheable(response)) {
            try { await cache.put(request, response.clone()); } catch (_) {}
          }
        }).catch(() => {}));
      }
      return rangedResponse(request, cached);
    }

    try {
      const response = await fetch(request);
      if (cacheable(response)) {
        try { await cache.put(request, response.clone()); } catch (_) {}
      }
      return response;
    } catch (_) {
      return Response.error();
    }
  })());
});

async function prepareOffline() {
  const manifestResponse = await fetch(MANIFEST_URL, { cache: "no-store" });
  if (!manifestResponse.ok) throw new Error("Offline manifest unavailable");
  const manifest = await manifestResponse.json();
  const files = Array.isArray(manifest.files) ? manifest.files : [];
  const cache = await caches.open(CACHE_NAME);
  let completed = 0;
  const failures = [];

  for (const entry of files) {
    const raw = typeof entry === "string" ? entry : entry.path;
    if (!raw) continue;
    const url = new URL(raw, self.registration.scope).toString();
    try {
      const response = await fetch(url, { cache: "reload" });
      if (!cacheable(response)) throw new Error("HTTP " + response.status);
      await cache.put(url, response);
      completed += 1;
    } catch (error) {
      failures.push({ path: raw, error: String(error?.message || error) });
    }
  }

  await cache.put(MANIFEST_URL, new Response(JSON.stringify(manifest), {
    headers: { "Content-Type": "application/json" }
  }));

  return { ok: failures.length === 0, completed, total: files.length, failures, manifest };
}

async function offlineStatus() {
  const cache = await caches.open(CACHE_NAME);
  const keys = await cache.keys();
  let manifest = null;
  try {
    const response = await cache.match(MANIFEST_URL, { ignoreSearch: true, ignoreVary: true });
    if (response) manifest = await response.json();
  } catch (_) {}
  return { engineVersion: ENGINE_VERSION, cachedRequests: keys.length, manifest };
}

self.addEventListener("message", (event) => {
  const { type } = event.data || {};
  if (!type) return;
  const reply = (payload) => event.ports?.[0]?.postMessage(payload);

  if (type === "PREPARE_OFFLINE") {
    event.waitUntil(prepareOffline().then(reply).catch((error) => reply({ ok: false, error: String(error?.message || error) })));
  } else if (type === "OFFLINE_STATUS") {
    event.waitUntil(offlineStatus().then((status) => reply({ ok: true, ...status })));
  } else if (type === "CLEAR_OFFLINE") {
    event.waitUntil(caches.delete(CACHE_NAME).then((cleared) => reply({ ok: true, cleared })));
  } else if (type === "SKIP_WAITING") {
    self.skipWaiting();
    reply({ ok: true });
  }
});
