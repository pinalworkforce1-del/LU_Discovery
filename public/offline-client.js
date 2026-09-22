(() => {
  if (!("serviceWorker" in navigator)) return;

  const script = document.currentScript;
  const localRoot = script ? new URL("./", script.src).pathname : new URL("./", location.href).pathname;

  const normalizeRoot = (root) => {
    let value = root || localRoot;
    if (!value.startsWith("/")) value = "/" + value;
    if (!value.endsWith("/")) value += "/";
    return value;
  };

  async function register(root = localRoot) {
    const scope = normalizeRoot(root);
    const swUrl = new URL(scope + "offline-sw.js", location.origin).toString();
    return navigator.serviceWorker.register(swUrl, { scope, updateViaCache: "none" });
  }

  async function activeWorker(root) {
    const reg = await register(root);
    await navigator.serviceWorker.ready.catch(() => null);
    if (reg.active) return reg.active;
    if (reg.waiting) return reg.waiting;
    if (reg.installing) {
      await new Promise((resolve) => {
        const worker = reg.installing;
        const done = () => {
          if (worker.state === "activated" || worker.state === "redundant") resolve();
        };
        worker.addEventListener("statechange", done);
        done();
      });
    }
    return reg.active || reg.waiting || reg.installing;
  }

  async function send(root, type) {
    const worker = await activeWorker(root);
    if (!worker) throw new Error("Offline worker is not available");
    return new Promise((resolve, reject) => {
      const channel = new MessageChannel();
      const timer = setTimeout(() => reject(new Error("Offline worker timed out")), 180000);
      channel.port1.onmessage = (event) => {
        clearTimeout(timer);
        resolve(event.data);
      };
      worker.postMessage({ type }, [channel.port2]);
    });
  }

  async function prepareScope(root) {
    return send(root, "PREPARE_OFFLINE");
  }

  async function prepareScopes(roots, onProgress) {
    const unique = [...new Set((roots || []).map(normalizeRoot))];
    const results = [];
    for (let i = 0; i < unique.length; i += 1) {
      const root = unique[i];
      onProgress?.({ phase: "start", root, index: i, total: unique.length });
      const result = await prepareScope(root);
      results.push({ root, ...result });
      onProgress?.({ phase: "complete", root, index: i, total: unique.length, result });
      if (!result?.ok) throw Object.assign(new Error("Offline preparation failed for " + root), { result, root });
    }
    return results;
  }

  async function estimateScopes(roots) {
    const unique = [...new Set((roots || []).map(normalizeRoot))];
    const manifests = [];
    for (const root of unique) {
      const url = new URL(root + "offline-manifest.json", location.origin);
      const response = await fetch(url, { cache: "no-store" });
      if (!response.ok) throw new Error("Offline manifest unavailable for " + root);
      manifests.push({ root, ...(await response.json()) });
    }
    return {
      manifests,
      totalBytes: manifests.reduce((sum, m) => sum + Number(m.totalBytes || 0), 0),
      totalFiles: manifests.reduce((sum, m) => sum + Number(m.files?.length || 0), 0),
    };
  }

  window.LevelUpOffline = { register, prepareScope, prepareScopes, estimateScopes, normalizeRoot };
  register(localRoot).catch((error) => console.warn("Level Up offline registration deferred", error));
})();
