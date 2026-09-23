(() => {
  const KEY = "level-up-offline-progress-v1";

  function read() {
    try {
      const raw = localStorage.getItem(KEY);
      const parsed = raw ? JSON.parse(raw) : {};
      return parsed && typeof parsed === "object" ? parsed : {};
    } catch (_) {
      return {};
    }
  }

  function write(data) {
    localStorage.setItem(KEY, JSON.stringify(data));
    window.dispatchEvent(new CustomEvent("level-up-offline-progress", { detail: data }));
  }

  function save(moduleId, journeyState, options = {}) {
    if (!moduleId) return null;
    const all = read();
    const previous = all[moduleId] || {};
    const now = new Date().toISOString();
    const row = {
      module_id: moduleId,
      journey_state: journeyState || {},
      xp: Math.max(0, Number(options.xp ?? journeyState?.xp ?? previous.xp ?? 0) || 0),
      is_complete: Boolean(options.isComplete ?? journeyState?.complete ?? journeyState?.finished ?? previous.is_complete ?? false),
      completed_at: options.completedAt ?? journeyState?.completionDate ?? journeyState?.completedAt ?? previous.completed_at ?? null,
      updated_at: options.updatedAt || now,
      pending: options.pending !== false,
      last_synced_at: previous.last_synced_at || null,
    };
    all[moduleId] = row;
    write(all);
    return row;
  }

  function markSynced(moduleId, syncedAt) {
    const all = read();
    if (!all[moduleId]) return;
    all[moduleId] = {
      ...all[moduleId],
      pending: false,
      last_synced_at: syncedAt || new Date().toISOString(),
    };
    write(all);
  }

  function remove(moduleId) {
    const all = read();
    delete all[moduleId];
    write(all);
  }

  function get(moduleId) {
    return read()[moduleId] || null;
  }

  function list() {
    return Object.values(read());
  }

  window.LevelUpOfflineProgress = { key: KEY, read, save, markSynced, remove, get, list };
})();
