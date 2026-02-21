/**
 * storage.js
 * Persistent key-value storage adapter.
 *
 * ── ENVIRONMENTS ─────────────────────────────────────────────────────────────
 *
 * Claude Artifact (default):
 *   Uses window.storage — provided by the Claude artifact sandbox.
 *   Data persists across sessions automatically.
 *
 * Local Development (Vite):
 *   Set LOCAL_DEV = true below, or replace window.storage calls with
 *   the localStorage equivalents shown in the comments.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 *
 * To switch to localStorage for local dev, replace the body of each method:
 *
 *   getMemory:   const raw = localStorage.getItem("agent:memory");
 *                return raw ? JSON.parse(raw) : defaultValue;
 *
 *   saveMemory:  localStorage.setItem("agent:memory", JSON.stringify(mem));
 *
 *   getHistory:  const raw = localStorage.getItem("agent:history");
 *                return raw ? JSON.parse(raw) : [];
 *
 *   saveHistory: localStorage.setItem("agent:history", JSON.stringify(h.slice(-50)));
 *
 *   clearAll:    localStorage.removeItem("agent:memory");
 *                localStorage.removeItem("agent:history");
 */

const KEYS = {
  MEMORY:  "agent:memory",
  HISTORY: "agent:history",
};

const DEFAULT_MEMORY = { preferences: {}, history: [], sessions: [] };

export const Storage = {
  /**
   * Load the memory object (preferences + sessions).
   * @returns {Promise<object>}
   */
  async getMemory() {
    try {
      const r = await window.storage.get(KEYS.MEMORY);
      return r ? JSON.parse(r.value) : { ...DEFAULT_MEMORY };
    } catch {
      return { ...DEFAULT_MEMORY };
    }
  },

  /**
   * Persist the memory object.
   * @param {object} mem
   */
  async saveMemory(mem) {
    try {
      await window.storage.set(KEYS.MEMORY, JSON.stringify(mem));
    } catch (e) {
      console.warn("[Storage] saveMemory failed:", e);
    }
  },

  /**
   * Load conversation history array.
   * @returns {Promise<Array>}
   */
  async getHistory() {
    try {
      const r = await window.storage.get(KEYS.HISTORY);
      return r ? JSON.parse(r.value) : [];
    } catch {
      return [];
    }
  },

  /**
   * Persist history, capped at 50 entries.
   * @param {Array} history
   */
  async saveHistory(history) {
    try {
      await window.storage.set(KEYS.HISTORY, JSON.stringify(history.slice(-50)));
    } catch (e) {
      console.warn("[Storage] saveHistory failed:", e);
    }
  },

  /**
   * Wipe all stored data.
   */
  async clearAll() {
    try {
      await window.storage.delete(KEYS.MEMORY);
      await window.storage.delete(KEYS.HISTORY);
    } catch (e) {
      console.warn("[Storage] clearAll failed:", e);
    }
  },
};