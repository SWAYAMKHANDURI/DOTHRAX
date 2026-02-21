export const Storage = {
  async getMemory() {
    try {
      const raw = localStorage.getItem("agent:memory");
      return raw ? JSON.parse(raw) : { preferences: {}, history: [], sessions: [] };
    } catch { return { preferences: {}, history: [], sessions: [] }; }
  },
  async saveMemory(mem) {
    localStorage.setItem("agent:memory", JSON.stringify(mem));
  },
  async getHistory() {
    try {
      const raw = localStorage.getItem("agent:history");
      return raw ? JSON.parse(raw) : [];
    } catch { return []; }
  },
  async saveHistory(h) {
    localStorage.setItem("agent:history", JSON.stringify(h.slice(-50)));
  },
  async clearAll() {
    localStorage.removeItem("agent:memory");
    localStorage.removeItem("agent:history");
  }
};