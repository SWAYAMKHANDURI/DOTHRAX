/**
 * qdrant.js
 * Mock Qdrant vector database client with production-faithful API surface.
 *
 * Implements the same interface as @qdrant/js-client-rest so swapping
 * to a real cluster is a one-line import change in vectorMemory.js.
 *
 * Features:
 *   - Cosine similarity search (real math, not fake)
 *   - Payload filter evaluation (must / should / must_not)
 *   - score_threshold filtering
 *   - Upsert with deterministic id deduplication
 *   - Full persistence via window.storage (survives page reloads)
 *   - All 7 Qdrant API methods: createCollection, upsert, search,
 *     retrieve, scroll, count, deleteCollection
 *
 * ── SWAP TO REAL QDRANT ───────────────────────────────────────────────────
 * In vectorMemory.js, replace:
 *
 *   import { QdrantMockClient as qdrant } from "./qdrant.js";
 *
 * with:
 *
 *   import { QdrantClient } from "@qdrant/js-client-rest";
 *   const qdrant = new QdrantClient({ url: "http://localhost:6333" });
 *   // or Qdrant Cloud:
 *   const qdrant = new QdrantClient({
 *     url: import.meta.env.VITE_QDRANT_URL,
 *     apiKey: import.meta.env.VITE_QDRANT_API_KEY,
 *   });
 *
 * The rest of the codebase is identical — collection names, upsert/search
 * call signatures, and payload shapes are all preserved.
 * ─────────────────────────────────────────────────────────────────────────
 *
 * ── LOCAL DEV PERSISTENCE ─────────────────────────────────────────────────
 * Replace persist() and hydrate() bodies to use localStorage:
 *
 *   const persist = (name, points) =>
 *     localStorage.setItem(`qdrant:${name}`, JSON.stringify(points));
 *
 *   const hydrate = (name) => {
 *     const raw = localStorage.getItem(`qdrant:${name}`);
 *     return raw ? JSON.parse(raw) : [];
 *   };
 * ─────────────────────────────────────────────────────────────────────────
 */

// ── Vector math ────────────────────────────────────────────────────────────────

/**
 * Cosine similarity ∈ [-1, 1]. Higher = more similar.
 * Assumes L2-normalised input vectors (from textToVector).
 *
 * @param {number[]} a
 * @param {number[]} b
 * @returns {number}
 */
const cosineSimilarity = (a, b) => {
  if (a.length !== b.length) throw new Error("Vector dimension mismatch");
  let dot = 0, normA = 0, normB = 0;
  for (let i = 0; i < a.length; i++) {
    dot   += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }
  const denom = Math.sqrt(normA) * Math.sqrt(normB);
  return denom === 0 ? 0 : dot / denom;
};

/**
 * Deterministic pseudo-embedding from text.
 *
 * Algorithm: character trigram frequency bucketing → 128-dim float vector → L2 normalise.
 *
 * Properties:
 *   ✓ Consistent: same text always produces the same vector
 *   ✓ Directionally meaningful: overlapping trigrams → higher cosine similarity
 *   ✓ Fast: O(n) in text length, no network call
 *   ✓ Zero dependencies
 *
 * Limitation: not semantically meaningful like a transformer embedding model.
 * For production, swap with OpenAI text-embedding-3-small or a sentence-transformer.
 *
 * @param {string} text
 * @param {number} [dims=128]
 * @returns {number[]}
 */
export const textToVector = (text, dims = 128) => {
  const normalised = text.toLowerCase().replace(/[^a-z0-9\s]/g, " ").trim();
  const words      = normalised.split(/\s+/).filter(Boolean);
  const vec        = new Float64Array(dims).fill(0);

  for (const word of words) {
    // Character trigrams
    for (let i = 0; i <= word.length - 3; i++) {
      const gram = word.slice(i, i + 3);
      let hash = 0;
      for (let j = 0; j < gram.length; j++) {
        hash = (hash * 31 + gram.charCodeAt(j)) >>> 0;
      }
      vec[hash % dims] += 1;
    }
    // Unigram (higher weight — captures topic words)
    let hash = 0;
    for (let j = 0; j < word.length; j++) {
      hash = (hash * 31 + word.charCodeAt(j)) >>> 0;
    }
    vec[hash % dims] += 2;
  }

  // L2 normalise → unit sphere
  let norm = 0;
  for (let i = 0; i < dims; i++) norm += vec[i] * vec[i];
  norm = Math.sqrt(norm);
  if (norm > 0) for (let i = 0; i < dims; i++) vec[i] /= norm;

  return Array.from(vec);
};

// ── Persistence ────────────────────────────────────────────────────────────────

const storageKey = (name) => `qdrant:${name}`;

const persist = async (name, points) => {
  try {
    await window.storage.set(storageKey(name), JSON.stringify(points));
  } catch (e) {
    console.warn(`[Qdrant] persist(${name}) failed:`, e);
  }
};

const hydrate = async (name) => {
  try {
    const r = await window.storage.get(storageKey(name));
    return r ? JSON.parse(r.value) : [];
  } catch {
    return [];
  }
};

// ── In-memory store ────────────────────────────────────────────────────────────

/** { [collectionName]: Point[] } — populated lazily from storage */
const _store  = {};
const _loaded = {};

const getCollection = async (name) => {
  if (!_loaded[name]) {
    _store[name]  = await hydrate(name);
    _loaded[name] = true;
  }
  return _store[name];
};

// ── Payload filter evaluation ───────────────────────────────────────────────────

/**
 * Evaluate a Qdrant-style filter against a point payload.
 *
 * Supported:
 *   { must:     [{ key, match: { value } }] }
 *   { should:   [{ key, match: { value } }] }
 *   { must_not: [{ key, match: { value } }] }
 *   { key, range: { gte?, lte?, gt?, lt? } }
 *
 * @param {object|null} filter
 * @param {object}      payload
 * @returns {boolean}
 */
const evalFilter = (filter, payload) => {
  if (!filter) return true;

  const evalCondition = (cond) => {
    if (cond.key && cond.match) {
      const val = payload[cond.key];
      return val === cond.match.value ||
             (Array.isArray(val) && val.includes(cond.match.value));
    }
    if (cond.key && cond.range) {
      const val = payload[cond.key];
      const { gte, lte, gt, lt } = cond.range;
      return (gte == null || val >= gte) &&
             (lte == null || val <= lte) &&
             (gt  == null || val >  gt)  &&
             (lt  == null || val <  lt);
    }
    return true;
  };

  if (filter.must)     return filter.must.every(evalCondition);
  if (filter.should)   return filter.should.some(evalCondition);
  if (filter.must_not) return !filter.must_not.some(evalCondition);
  return true;
};

// ── QdrantMockClient ────────────────────────────────────────────────────────────

export const QdrantMockClient = {
  /**
   * Ensure a collection exists. No-op if already initialised.
   */
  async createCollection(name, _config) {
    await getCollection(name);
    return { status: "ok", result: true };
  },

  /**
   * Insert or update points by id.
   *
   * @param {string} collection
   * @param {{ points: Array<{ id: string, vector: number[], payload: object }> }} body
   */
  async upsert(collection, { points }) {
    const col = await getCollection(collection);
    for (const pt of points) {
      const idx = col.findIndex((p) => p.id === pt.id);
      if (idx >= 0) col[idx] = pt;
      else          col.push(pt);
    }
    await persist(collection, col);
    return { status: "ok", result: { operation_id: Date.now(), status: "completed" } };
  },

  /**
   * Vector similarity search with optional payload filtering.
   *
   * @param {string} collection
   * @param {{ vector: number[], limit?: number, filter?: object, score_threshold?: number, with_payload?: boolean, with_vector?: boolean }} params
   * @returns {Array<{ id, score, payload, vector? }>}
   */
  async search(collection, {
    vector,
    limit          = 5,
    filter         = null,
    score_threshold = 0.0,
    with_payload   = true,
    with_vector    = false,
  }) {
    const col = await getCollection(collection);
    return col
      .filter((pt) => evalFilter(filter, pt.payload))
      .map((pt) => ({
        id:      pt.id,
        score:   cosineSimilarity(vector, pt.vector),
        payload: with_payload ? pt.payload : undefined,
        vector:  with_vector  ? pt.vector  : undefined,
      }))
      .filter((r) => r.score >= score_threshold)
      .sort((a, b) => b.score - a.score)
      .slice(0, limit);
  },

  /**
   * Retrieve points by exact id.
   *
   * @param {string} collection
   * @param {{ ids: string[], with_payload?: boolean }} params
   */
  async retrieve(collection, { ids, with_payload = true }) {
    const col = await getCollection(collection);
    return col
      .filter((pt) => ids.includes(pt.id))
      .map((pt) => ({
        id:      pt.id,
        payload: with_payload ? pt.payload : undefined,
        vector:  pt.vector,
      }));
  },

  /**
   * Paginate through all points with optional filter.
   *
   * @param {string} collection
   * @param {{ filter?: object, limit?: number, offset?: number, with_payload?: boolean }} params
   */
  async scroll(collection, { filter = null, limit = 100, offset = 0, with_payload = true } = {}) {
    const col      = await getCollection(collection);
    const filtered = col.filter((pt) => evalFilter(filter, pt.payload));
    const page     = filtered.slice(offset, offset + limit);
    return {
      points: page.map((pt) => ({
        id:      pt.id,
        payload: with_payload ? pt.payload : undefined,
      })),
      next_page_offset: offset + limit < filtered.length ? offset + limit : null,
    };
  },

  /**
   * Count points (optionally filtered).
   */
  async count(collection, { filter = null } = {}) {
    const col = await getCollection(collection);
    const n   = filter
      ? col.filter((pt) => evalFilter(filter, pt.payload)).length
      : col.length;
    return { result: { count: n } };
  },

  /**
   * Delete points by id list.
   */
  async delete(collection, { points: ids }) {
    const col = await getCollection(collection);
    _store[collection] = col.filter((p) => !ids.includes(p.id));
    await persist(collection, _store[collection]);
    return { status: "ok" };
  },

  /**
   * Drop an entire collection.
   */
  async deleteCollection(name) {
    _store[name]  = [];
    _loaded[name] = true;
    try { await window.storage.delete(storageKey(name)); } catch { /* ok */ }
    return { status: "ok" };
  },

  /**
   * Get collection metadata.
   */
  async getCollection(name) {
    const col = await getCollection(name);
    return {
      result: {
        status:        "green",
        points_count:  col.length,
        vectors_count: col.length,
      },
    };
  },
};