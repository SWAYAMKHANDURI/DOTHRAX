/**
 * cost.js
 * Token counting and cost estimation for Claude Sonnet 4.
 *
 * Pricing (as of 2025):
 *   Input:  $3.00 / 1M tokens
 *   Output: $15.00 / 1M tokens
 */

const PRICING = {
  "claude-sonnet-4": { input: 3.0, output: 15.0 }, // USD per million tokens
};

/**
 * Compute exact cost from API usage response.
 *
 * @param {number} inputTokens
 * @param {number} outputTokens
 * @param {string} [model]
 * @returns {{ inputCost: number, outputCost: number, total: number, inputTokens: number, outputTokens: number }}
 */
export const estimateCost = (inputTokens, outputTokens, model = "claude-sonnet-4") => {
  const p        = PRICING[model] ?? PRICING["claude-sonnet-4"];
  const inputCost  = (inputTokens  / 1_000_000) * p.input;
  const outputCost = (outputTokens / 1_000_000) * p.output;
  return {
    inputCost,
    outputCost,
    total: inputCost + outputCost,
    inputTokens,
    outputTokens,
  };
};

/**
 * Rough token approximation from raw text (4 chars ≈ 1 token).
 * Used only for pre-request budgeting — not for billing.
 *
 * @param {string} text
 * @returns {number}
 */
export const approxTokens = (text) => Math.ceil((text ?? "").length / 4);

/**
 * Format a USD dollar amount for display in the UI.
 *
 * @param {number} amount
 * @returns {string}
 */
export const formatCost = (amount) => `$${amount.toFixed(5)}`;