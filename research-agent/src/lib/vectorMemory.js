/**
 * vectorMemory.js
 * Production-grade vector memory system built on QdrantMockClient.
 *
 * Collections:
 * ┌─────────────────────┬────────────────────────────────────────────────────┐
 * │ research_history    │ Every query + summary. Semantic search finds        │
 * │                     │ similar past research to inject as context.         │
 * ├─────────────────────┼────────────────────────────────────────────────────┤
 * │ user_preferences    │ Extracted preferences keyed by domain. Retrieved   │
 * │                     │ by topic so ML prefs surface for ML questions.      │
 * ├─────────────────────┼────────────────────────────────────────────────────┤
 * │ key_insights        │ Distilled facts/conclusions from deep dives.        │
 * │                     │ Retrieved as RAG context for follow-up questions.  │
 * ├─────────────────────┼────────────────────────────────────────────────────┤
 * │ conversations       │ Full conversation turns (user+assistant pairs).     │
 * │                     │ Enables "continue where we left off" across         │
 * │                     │ sessions.                                           │
 * └─────────────────────┴────────────────────────────────────────────────────┘
 *
 * Retrieval pipeline (called before every Claude request):
 *   embed(query) → search all 4 collections → rank → deduplicate → inject
 */

import { QdrantMockClient as qdrant, textToVector } from "./qdrant.js";

// ── Collection definitions ─────────────────────────────────────────────────

export const COLLECTIONS = {
  RESEARCH_HISTORY:  "research_history",
  USER_PREFERENCES:  "user_preferences",
  KEY_INSIGHTS:      "key_insights",
  CONVERSATIONS:     "conversations",
};

const VECTOR_CONFIG = { size: 128, distance: "Cosine" };

// ── Initialisation ─────────────────────────────────────────────────────────

let _initialized = false;

export const initMemory = async () => {
  if (_initialized) return;
  await Promise.all(
    Object.values(COLLECTIONS).map((name) =>
      qdrant.createCollection(name, { vectors: VECTOR_CONFIG })
    )
  );
  _initialized = true;
};

// ── ID helpers ─────────────────────────────────────────────────────────────

const uid = () => `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

// ── WRITE operations ───────────────────────────────────────────────────────

/**
 * Store a completed research query + response summary.
 */
export const storeResearch = async ({ query, summary, mode, tags = [], responsePreview = "" }) => {
  await initMemory();
  const vector = textToVector(`${query} ${summary} ${tags.join(" ")}`);
  await qdrant.upsert(COLLECTIONS.RESEARCH_HISTORY, {
    points: [{
      id: uid(),
      vector,
      payload: {
        query,
        summary,
        mode,
        tags,
        responsePreview: responsePreview.slice(0, 400),
        timestamp: Date.now(),
      },
    }],
  });
};

/**
 * Store or update a user preference. One point per preference key,
 * upserted so duplicates don't accumulate.
 */
export const storePreference = async ({ key, value, domain = "general", example = "" }) => {
  await initMemory();
  // Use deterministic id so same key overwrites itself
  const id = `pref-${key}-${domain}`;
  const vector = textToVector(`user preference ${key} ${value} ${domain} ${example}`);
  await qdrant.upsert(COLLECTIONS.USER_PREFERENCES, {
    points: [{
      id,
      vector,
      payload: { key, value, domain, example, updatedAt: Date.now() },
    }],
  });
};

/**
 * Store a distilled insight/fact extracted from a deep dive.
 */
export const storeInsight = async ({ insight, topic, sourceQuery = "", tags = [] }) => {
  await initMemory();
  const vector = textToVector(`${insight} ${topic} ${tags.join(" ")}`);
  await qdrant.upsert(COLLECTIONS.KEY_INSIGHTS, {
    points: [{
      id: uid(),
      vector,
      payload: { insight, topic, sourceQuery, tags, timestamp: Date.now() },
    }],
  });
};

/**
 * Store a conversation turn (user message + assistant response pair).
 * Enables cross-session continuity.
 */
export const storeConversationTurn = async ({ userMessage, assistantMessage, mode, sessionId = "default" }) => {
  await initMemory();
  const vector = textToVector(`${userMessage} ${assistantMessage.slice(0, 300)}`);
  await qdrant.upsert(COLLECTIONS.CONVERSATIONS, {
    points: [{
      id: uid(),
      vector,
      payload: {
        userMessage,
        assistantMessage: assistantMessage.slice(0, 600),
        mode,
        sessionId,
        timestamp: Date.now(),
      },
    }],
  });
};

// ── READ / RETRIEVAL operations ────────────────────────────────────────────

/**
 * Core retrieval pipeline. Given a query, searches all 4 collections
 * and returns a structured context object ready for prompt injection.
 *
 * @param {string} query - The incoming user query
 * @param {{ limit?: number, minScore?: number }} opts
 * @returns {MemoryContext}
 */
export const retrieveContext = async (query, opts = {}) => {
  await initMemory();
  const { limit = 4, minScore = 0.25 } = opts;
  const vector = textToVector(query);

  const [historyHits, prefHits, insightHits, convHits] = await Promise.all([
    qdrant.search(COLLECTIONS.RESEARCH_HISTORY, {
      vector, limit, score_threshold: minScore, with_payload: true,
    }),
    qdrant.search(COLLECTIONS.USER_PREFERENCES, {
      vector, limit: 6, score_threshold: 0.15, with_payload: true,
    }),
    qdrant.search(COLLECTIONS.KEY_INSIGHTS, {
      vector, limit, score_threshold: minScore, with_payload: true,
    }),
    qdrant.search(COLLECTIONS.CONVERSATIONS, {
      vector, limit: 3, score_threshold: minScore, with_payload: true,
    }),
  ]);

  return {
    similarResearch:   historyHits.map(h => ({ ...h.payload, _score: h.score })),
    relevantPrefs:     prefHits.map(h => ({ ...h.payload, _score: h.score })),
    relevantInsights:  insightHits.map(h => ({ ...h.payload, _score: h.score })),
    relatedConversations: convHits.map(h => ({ ...h.payload, _score: h.score })),
  };
};

/**
 * Retrieve all stored preferences (for the memory panel UI).
 */
export const getAllPreferences = async () => {
  await initMemory();
  const { points } = await qdrant.scroll(COLLECTIONS.USER_PREFERENCES, {
    limit: 100, with_payload: true,
  });
  return points.map(p => p.payload);
};

/**
 * Retrieve recent research history (for the memory panel UI).
 */
export const getRecentHistory = async (limit = 20) => {
  await initMemory();
  const { points } = await qdrant.scroll(COLLECTIONS.RESEARCH_HISTORY, {
    limit: 100, with_payload: true,
  });
  return points
    .map(p => p.payload)
    .sort((a, b) => b.timestamp - a.timestamp)
    .slice(0, limit);
};

/**
 * Retrieve recent conversation turns (for session continuity).
 */
export const getRecentConversations = async (limit = 10) => {
  await initMemory();
  const { points } = await qdrant.scroll(COLLECTIONS.CONVERSATIONS, {
    limit: 50, with_payload: true,
  });
  return points
    .map(p => p.payload)
    .sort((a, b) => b.timestamp - a.timestamp)
    .slice(0, limit);
};

/**
 * Get collection stats for the UI.
 */
export const getMemoryStats = async () => {
  await initMemory();
  const stats = await Promise.all(
    Object.entries(COLLECTIONS).map(async ([label, name]) => {
      const { result } = await qdrant.getCollection(name);
      return { label, name, count: result.points_count };
    })
  );
  return stats;
};

/**
 * Clear all memory (used by the "Clear" button in the UI).
 */
export const clearAllMemory = async () => {
  await Promise.all(
    Object.values(COLLECTIONS).map((name) => qdrant.deleteCollection(name))
  );
  _initialized = false;
};

// ── Prompt injection helper ────────────────────────────────────────────────

/**
 * Format retrieved context into a structured string for system prompt injection.
 * Only includes sections that have content.
 *
 * @param {object} ctx - Result from retrieveContext()
 * @returns {string}
 */
export const formatContextForPrompt = (ctx) => {
  const sections = [];

  if (ctx.relevantPrefs?.length) {
    sections.push(
      "## Learned User Preferences (from vector memory)\n" +
      ctx.relevantPrefs
        .map(p => `- [${p.domain}] ${p.key}: ${JSON.stringify(p.value)}${p.example ? ` (e.g. "${p.example}")` : ""}  (similarity: ${p._score?.toFixed(2)})`)
        .join("\n")
    );
  }

  if (ctx.similarResearch?.length) {
    sections.push(
      "## Semantically Similar Past Research (retrieved from vector store)\n" +
      ctx.similarResearch
        .map(r => `- [${r.mode}] "${r.query}"\n  Summary: ${r.summary}\n  Tags: ${(r.tags || []).join(", ")}  (similarity: ${r._score?.toFixed(2)})`)
        .join("\n")
    );
  }

  if (ctx.relevantInsights?.length) {
    sections.push(
      "## Relevant Key Insights (distilled from prior deep dives)\n" +
      ctx.relevantInsights
        .map(i => `- [${i.topic}] ${i.insight}  (similarity: ${i._score?.toFixed(2)})`)
        .join("\n")
    );
  }

  if (ctx.relatedConversations?.length) {
    sections.push(
      "## Related Prior Conversations (for continuity)\n" +
      ctx.relatedConversations
        .map(c => `- User asked: "${c.userMessage}"\n  Agent responded: "${c.assistantMessage.slice(0, 200)}..."  (similarity: ${c._score?.toFixed(2)})`)
        .join("\n")
    );
  }

  if (sections.length === 0) return "No relevant memory found for this query.";

  return "# Retrieved Memory Context (Qdrant Semantic Search)\n\n" + sections.join("\n\n");
};