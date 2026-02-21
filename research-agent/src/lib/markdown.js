/**
 * markdown.js
 * Lightweight markdown → HTML renderer. Zero external dependencies.
 *
 * Supported syntax:
 *   # / ## / ###  Headings
 *   **bold**       Bold
 *   *italic*       Italic
 *   `code`         Inline code
 *   ```lang\n…``` Fenced code blocks
 *   | col | col |  Tables (GFM-style)
 *   - item         Unordered lists
 *   1. item        Ordered lists (flat)
 *   [text](url)    Links (open in new tab)
 *
 * CSS classes emitted: md-h1/h2/h3, inline-code, code-block,
 *   code-lang, md-table, md-list, md-link
 */

export const renderMarkdown = (text) => {
  if (!text) return "";

  return text
    // ── Fenced code blocks (process first — prevents inner mangling) ──────
    .replace(/```(\w+)?\n([\s\S]*?)```/g, (_, lang, code) => {
      const escaped = code
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;");
      return (
        `<pre class="code-block">` +
        `<div class="code-lang">${lang || "code"}</div>` +
        `<code>${escaped}</code></pre>`
      );
    })

    // ── Inline code ────────────────────────────────────────────────────────
    .replace(/`([^`]+)`/g, '<code class="inline-code">$1</code>')

    // ── Headings ───────────────────────────────────────────────────────────
    .replace(/^### (.+)$/gm, '<h3 class="md-h3">$1</h3>')
    .replace(/^## (.+)$/gm,  '<h2 class="md-h2">$1</h2>')
    .replace(/^# (.+)$/gm,   '<h1 class="md-h1">$1</h1>')

    // ── Bold & italic ──────────────────────────────────────────────────────
    .replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>")
    .replace(/\*(.+?)\*/g,     "<em>$1</em>")

    // ── GFM tables ────────────────────────────────────────────────────────
    // Convert | a | b | rows to <tr><td>…
    .replace(/^\| (.+) \|$/gm, (row) => {
      // Skip separator rows (--- | --- | ---)
      if (/^[\s|:-]+$/.test(row)) return "";
      const cells = row.split("|").filter((c) => c.trim());
      return `<tr>${cells.map((c) => `<td>${c.trim()}</td>`).join("")}</tr>`;
    })
    // Wrap consecutive <tr> blocks in <table>
    .replace(/(<tr>[\s\S]*?<\/tr>\n?)+/g, (m) =>
      `<table class="md-table"><tbody>${m}</tbody></table>`
    )

    // ── Unordered lists ────────────────────────────────────────────────────
    .replace(/^- (.+)$/gm, "<li>$1</li>")
    .replace(/(<li>[\s\S]*?<\/li>\n?)+/g, (m) => `<ul class="md-list">${m}</ul>`)

    // ── Ordered lists (flat only) ──────────────────────────────────────────
    .replace(/^\d+\. (.+)$/gm, "<li>$1</li>")

    // ── Links ──────────────────────────────────────────────────────────────
    .replace(
      /\[([^\]]+)\]\(([^)]+)\)/g,
      '<a href="$2" class="md-link" target="_blank" rel="noopener noreferrer">$1</a>'
    )

    // ── Paragraph breaks ───────────────────────────────────────────────────
    .replace(/\n\n/g, "</p><p>");
};