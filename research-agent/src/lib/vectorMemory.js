/**
 * vectorMemory.js
 * Production-grade vector memory system built on QdrantMockClient.
 *
 * Collections:
 * ┌──────────────────────┬──────────────────────────────────────────────────┐
 * │ research_history     │ Every query + summary. Semantic search finds     │
 * │                      │ similar past research to inject as context.      │
 * ├──────────────────────┼──────────────────────────────────────────────────┤
 * │ user_preferences     │ Extracted prefs keyed by domain. ML prefs        │
 * │                      │ surface for ML questions, not web questions.     │
 * ├──────────────────────┼──────────────────────────────────────────────────┤
 * │ key_insights         │ Distilled facts from deep dives. Retrieved as    │
 * │                      │ RAG context for follow-up questions.             │
 * ├──────────────────────┼──────────────────────────────────────────────────┤
 * │ conversations        │ Full user+assistant turn pairs. Cross-session    │
 * │                      │ continuity — "continue where we left off".       │
 * └──────────────────────┴──────────────────────────────────────────────────┘
 *
 * Retrieval pipeline (runs before every Claude call):
 *   embed(query) → Promise.all 4 searches → rank → deduplicate → inject
 */

import { QdrantMockClient as qdrant, textToVector } from "./qdrant.js";

// ── Collection names ────────────────────────────────────────────────────────

export const COLLECTIONS = {
  RESEARCH_HISTORY: "research_history",
  USER_PREFERENCES: "user_preferences",
  KEY_INSIGHTS:     "key_insights",
  CONVERSATIONS:    "conversations",
};

const VECTOR_CONFIG = { size: 128, distance: "Cosine" };

// ── Initialisation ──────────────────────────────────────────────────────────

let _initialized = false;

/**
 * Create all 4 collections if they don't exist.
 * Idempotent — safe to call multiple times.
 */
export const initMemory = async () => {
  if (_initialized) return;
  await Promise.all(
    Object.values(COLLECTIONS).map((name) =>
      qdrant.createCollection(name, { vectors: VECTOR_CONFIG })
    )
  );
  _initialized = true;
};

// ── ID helper ───────────────────────────────────────────────────────────────

const uid = () => `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

// ── WRITE operations ────────────────────────────────────────────────────────

/**
 * Store a completed research query + response summary.
 *
 * @param {{ query, summary, mode, tags, responsePreview }} params
 */
export const storeResearch = async ({ query, summary, mode, tags = [], responsePreview = "" }) => {
  await initMemory();
  const vector = textToVector(`${query} ${summary} ${tags.join(" ")}`);
  return qdrant.upsert(COLLECTIONS.RESEARCH_HISTORY, {
    points: [{
      id: uid(),
      vector,
      payload: {
        query,
        summary,
        mode,
        tags,
        responsePreview: responsePreview.slice(0, 400),
        timestamp:       Date.now(),
      },
    }],
  });
};

/**
 * Store or update a user preference.
 * Uses a deterministic id so the same key/domain pair overwrites itself.
 *
 * @param {{ key, value, domain, example }} params
 */
export const storePreference = async ({ key, value, domain = "general", example = "" }) => {
  await initMemory();
  const id     = `pref-${key}-${domain}`; // deterministic → no duplicates
  const vector = textToVector(`user preference ${key} ${value} ${domain} ${example}`);
  return qdrant.upsert(COLLECTIONS.USER_PREFERENCES, {
    points: [{
      id,
      vector,
      payload: { key, value, domain, example, updatedAt: Date.now() },
    }],
  });
};

/**
 * Store a distilled insight extracted from a deep dive.
 *
 * @param {{ insight, topic, sourceQuery, tags }} params
 */
export const storeInsight = async ({ insight, topic, sourceQuery = "", tags = [] }) => {
  await initMemory();
  const vector = textToVector(`${insight} ${topic} ${tags.join(" ")}`);
  return qdrant.upsert(COLLECTIONS.KEY_INSIGHTS, {
    points: [{
      id: uid(),
      vector,
      payload: { insight, topic, sourceQuery, tags, timestamp: Date.now() },
    }],
  });
};

/**
 * Store a full conversation turn (user + assistant).
 * Enables cross-session continuity.
 *
 * @param {{ userMessage, assistantMessage, mode, sessionId }} params
 */
export const storeConversationTurn = async ({
  userMessage,
  assistantMessage,
  mode,
  sessionId = "default",
}) => {
  await initMemory();
  const vector = textToVector(`${userMessage} ${assistantMessage.slice(0, 300)}`);
  return qdrant.upsert(COLLECTIONS.CONVERSATIONS, {
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

// ── READ / RETRIEVAL operations ─────────────────────────────────────────────

/**
 * Core retrieval pipeline.
 * Embeds the query, searches all 4 collections in parallel,
 * and returns a structured context object.
 *
 * @param {string} query
 * @param {{ limit?: number, minScore?: number }} opts
 * @returns {Promise<MemoryContext>}
 */
export const retrieveContext = async (query, opts = {}) => {
  await initMemory();
  const { limit = 4, minScore = 0.2 } = opts;
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
    similarResearch:      historyHits.map((h) => ({ ...h.payload, _score: h.score })),
    relevantPrefs:        prefHits.map((h)    => ({ ...h.payload, _score: h.score })),
    relevantInsights:     insightHits.map((h) => ({ ...h.payload, _score: h.score })),
    relatedConversations: convHits.map((h)    => ({ ...h.payload, _score: h.score })),
  };
};

/**
 * Retrieve all stored preferences (used by the memory panel UI).
 */
export const getAllPreferences = async () => {
  await initMemory();
  const { points } = await qdrant.scroll(COLLECTIONS.USER_PREFERENCES, {
    limit: 100, with_payload: true,
  });
  return points.map((p) => p.payload);
};

/**
 * Retrieve recent research history sorted by timestamp desc (used by memory panel).
 *
 * @param {number} [limit=20]
 */
export const getRecentHistory = async (limit = 20) => {
  await initMemory();
  const { points } = await qdrant.scroll(COLLECTIONS.RESEARCH_HISTORY, {
    limit: 200, with_payload: true,
  });
  return points
    .map((p) => p.payload)
    .sort((a, b) => b.timestamp - a.timestamp)
    .slice(0, limit);
};

/**
 * Get collection point counts for the memory panel stats display.
 */
export const getMemoryStats = async () => {
  await initMemory();
  return Promise.all(
    Object.entries(COLLECTIONS).map(async ([label, name]) => {
      const { result } = await qdrant.getCollection(name);
      return { label, name, count: result.points_count };
    })
  );
};

/**
 * Wipe all 4 collections. Called by the "Clear All" button.
 */
export const clearAllMemory = async () => {
  await Promise.all(
    Object.values(COLLECTIONS).map((name) => qdrant.deleteCollection(name))
  );
  _initialized = false;
};

// ── Prompt injection ────────────────────────────────────────────────────────

/**
 * Format a MemoryContext object into a structured markdown string
 * for injection into the system prompt.
 * Only includes sections that have content.
 *
 * @param {object} ctx - Result from retrieveContext()
 * @returns {string}
 */
export const formatContextForPrompt = (ctx) => {
  const sections = [];

  if (ctx.relevantPrefs?.length) {
    sections.push(
      "## Learned User Preferences (semantic retrieval from Qdrant)\n" +
      ctx.relevantPrefs
        .map((p) =>
          `- [${p.domain}] ${p.key}: ${JSON.stringify(p.value)}` +
          (p.example ? ` — e.g. "${p.example}"` : "") +
          ` (similarity: ${p._score?.toFixed(2)})`
        )
        .join("\n")
    );
  }

  if (ctx.similarResearch?.length) {
    sections.push(
      "## Semantically Similar Past Research (from Qdrant)\n" +
      ctx.similarResearch
        .map((r) =>
          `- [${r.mode}] "${r.query}"\n` +
          `  Summary: ${r.summary}\n` +
          `  Tags: ${(r.tags || []).join(", ")} (similarity: ${r._score?.toFixed(2)})`
        )
        .join("\n")
    );
  }

  if (ctx.relevantInsights?.length) {
    sections.push(
      "## Relevant Key Insights (distilled from prior deep dives)\n" +
      ctx.relevantInsights
        .map((i) =>
          `- [${i.topic}] ${i.insight} (similarity: ${i._score?.toFixed(2)})`
        )
        .join("\n")
    );
  }

  if (ctx.relatedConversations?.length) {
    sections.push(
      "## Related Prior Conversations (for continuity)\n" +
      ctx.relatedConversations
        .map((c) =>
          `- User asked: "${c.userMessage}"\n` +
          `  Agent responded: "${c.assistantMessage.slice(0, 200)}..." (similarity: ${c._score?.toFixed(2)})`
        )
        .join("\n")
    );
  }

  if (sections.length === 0) {
    return "No relevant memory found for this query.";
  }

  return "# Retrieved Memory Context (Qdrant Semantic Search)\n\n" + sections.join("\n\n");
};