/**
 * api.js
 * Claude API HTTP client.
 *
 * Features:
 *   - Exponential backoff retry (configurable, default 2 retries)
 *   - Retriable vs non-retriable error classification
 *   - JSON helper that strips markdown fences before parsing
 *   - Usage tracking returned with every response
 */

const MODEL   = "claude-sonnet-4-20250514";
const API_URL = "https://api.anthropic.com/v1/messages";

/**
 * Core Claude API call with retry + backoff.
 *
 * @param {Array}  messages   - Conversation history [{role, content}]
 * @param {string} system     - System prompt string
 * @param {number} maxTokens  - Max output tokens
 * @param {number} retries    - Retry attempts on transient errors (default 2)
 * @returns {{ text: string, usage: { input_tokens, output_tokens } }}
 */
export const callClaude = async (messages, system, maxTokens = 2000, retries = 2) => {
  let lastError;

  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      const res = await fetch(API_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-api-key": import.meta.env.VITE_ANTHROPIC_API_KEY,
          "anthropic-version": "2023-06-01",
          "anthropic-dangerous-direct-browser-access": "true",
        },
        body: JSON.stringify({
          model: MODEL,
          max_tokens: maxTokens,
          system,
          messages,
        }),
      });

      // Non-retriable — auth / bad request errors, throw immediately
      if ([400, 401, 403].includes(res.status)) {
        const body = await res.text();
        throw new Error(`API error ${res.status} (non-retriable): ${body}`);
      }

      // Retriable — rate limits, server errors
      if (!res.ok) {
        const body = await res.text();
        lastError = new Error(`API error ${res.status}: ${body}`);
        if (attempt < retries) {
          await sleep(1000 * (attempt + 1)); // 1s → 2s backoff
          continue;
        }
        throw lastError;
      }

      const data = await res.json();
      return {
        text:  data.content.map((b) => b.text ?? "").join(""),
        usage: data.usage ?? { input_tokens: 0, output_tokens: 0 },
      };

    } catch (err) {
      lastError = err;
      if (attempt < retries && isRetriable(err)) {
        await sleep(1000 * (attempt + 1));
        continue;
      }
      throw err;
    }
  }

  throw lastError;
};

/**
 * Claude call that returns parsed JSON.
 * Strips accidental markdown code fences before JSON.parse().
 *
 * @param {Array}  messages
 * @param {string} system
 * @param {number} maxTokens
 * @returns {{ data: object, usage }}
 */
export const callClaudeJSON = async (messages, system, maxTokens = 300) => {
  const { text, usage } = await callClaude(messages, system, maxTokens);
  const clean = text
    .replace(/^```json\s*/m, "")
    .replace(/^```\s*/m, "")
    .replace(/```$/m, "")
    .trim();
  try {
    return { data: JSON.parse(clean), usage };
  } catch {
    throw new Error(`Failed to parse JSON: ${clean.slice(0, 200)}`);
  }
};

// ── Internal helpers ────────────────────────────────────────────────────────

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const isRetriable = (err) =>
  ["529", "500", "503", "network", "fetch"].some((kw) =>
    err.message.toLowerCase().includes(kw)
  );