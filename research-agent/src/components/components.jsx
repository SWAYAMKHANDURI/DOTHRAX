/**
 * components.jsx
 * All UI components for the Deep Research Agent.
 *
 * Components:
 *   GlobalStyles        — CSS reset + markdown + scrollbar styles
 *   CostBadge           — Per-response cost + token counts
 *   MemoryHints         — Qdrant retrieval hit counts per collection
 *   CitationPanel       — Collapsible arxiv citation list (Deep mode)
 *   ClarifyCard         — Yellow clarification question card
 *   FileBadge           — Attached PDF / image badge with remove button
 *   ModeSelector        — Quick / Deep toggle
 *   ThinkingIndicator   — Animated braille spinner while loading
 *   Message             — Single chat message (user or assistant)
 *   MemoryPanel         — Right-side panel: collections, prefs, history
 *   InputBar            — Fixed bottom input with mode selector + file attach
 */

import { useState, useEffect } from "react";
import { renderMarkdown } from "../lib/markdown.js";
import { formatCost }     from "../lib/cost.js";

// ── GlobalStyles ──────────────────────────────────────────────────────────────

export const GlobalStyles = () => (
  <style>{`
    @import url('https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@300;400;500;600;700&family=Syne:wght@600;700;800&display=swap');

    *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
    body { background: #040608; }

    ::-webkit-scrollbar       { width: 3px; }
    ::-webkit-scrollbar-track { background: transparent; }
    ::-webkit-scrollbar-thumb { background: #1e2530; border-radius: 2px; }

    /* ── Markdown body ────────────────────────────────────────────────────── */
    .markdown-body { font-family: 'JetBrains Mono', monospace; }

    .markdown-body .md-h1 {
      font-size: 19px; font-weight: 700; color: #f1f5f9;
      margin: 16px 0 8px; font-family: 'Syne', sans-serif;
    }
    .markdown-body .md-h2 {
      font-size: 14px; font-weight: 700; color: #e2e8f0;
      margin: 14px 0 6px; padding-bottom: 5px;
      border-bottom: 1px solid #131a24;
      font-family: 'Syne', sans-serif;
    }
    .markdown-body .md-h3 {
      font-size: 13px; font-weight: 600; color: #cbd5e1;
      margin: 11px 0 4px;
      font-family: 'Syne', sans-serif;
    }
    .markdown-body p  { color: #8a9bb0; font-size: 13px; line-height: 1.78; margin: 6px 0; }
    .markdown-body strong { color: #e2e8f0; font-weight: 600; }
    .markdown-body em     { color: #94a3b8; font-style: italic; }

    /* Fenced code blocks */
    .code-block {
      background: #060a12; border: 1px solid #0f1620;
      border-radius: 8px; padding: 14px 16px; margin: 10px 0;
      overflow-x: auto; position: relative;
    }
    .code-lang {
      position: absolute; top: 6px; right: 10px;
      font-size: 9px; color: #1e3040; font-family: 'JetBrains Mono', monospace;
      text-transform: uppercase; letter-spacing: 0.1em;
    }
    .code-block code {
      font-family: 'JetBrains Mono', monospace;
      font-size: 11.5px; color: #86efac; line-height: 1.65;
    }

    /* Inline code */
    .inline-code {
      background: #0a0f1a; border: 1px solid #131a24;
      border-radius: 3px; padding: 1px 5px;
      font-family: 'JetBrains Mono', monospace;
      font-size: 12px; color: #7dd3fc;
    }

    /* Tables */
    .md-table { width: 100%; border-collapse: collapse; margin: 10px 0; font-size: 12px; }
    .md-table td { border: 1px solid #0f1620; padding: 6px 10px; color: #8a9bb0; }
    .md-table tr:first-child td {
      background: #080c14; color: #e2e8f0; font-weight: 600;
    }
    .md-table tr:not(:first-child):hover td { background: #060a10; }

    /* Lists */
    .md-list { padding-left: 18px; margin: 6px 0; }
    .md-list li { color: #8a9bb0; font-size: 13px; line-height: 1.7; margin: 3px 0; }

    /* Links */
    .md-link { color: #818cf8; text-decoration: none; }
    .md-link:hover { text-decoration: underline; }

    /* ── Interaction helpers ──────────────────────────────────────────────── */
    .example-btn {
      background: #070b10; border: 1px solid #0f1820;
      border-radius: 8px; padding: 9px 14px; color: #2d3f52;
      font-size: 11.5px; text-align: left; cursor: pointer;
      transition: all 0.18s; font-family: 'JetBrains Mono', monospace; width: 100%;
    }
    .example-btn:hover {
      background: #0a1020; border-color: #1e2d3d; color: #6a8aaa;
    }

    .mode-btn {
      padding: 7px 17px; border-radius: 6px; border: none; cursor: pointer;
      font-family: 'JetBrains Mono', monospace; font-size: 11px; font-weight: 700;
      letter-spacing: 0.06em; text-transform: uppercase; transition: all 0.15s;
    }
    .mode-btn:disabled { cursor: not-allowed; opacity: 0.5; }

    .send-btn {
      border: none; border-radius: 8px; padding: 9px 18px;
      font-family: 'JetBrains Mono', monospace; font-size: 12px;
      font-weight: 700; cursor: pointer; transition: all 0.15s;
      white-space: nowrap; align-self: flex-end;
    }
    .send-btn:disabled { cursor: not-allowed; }
    .send-btn:not(:disabled):hover { filter: brightness(1.08); }

    /* ── Animations ───────────────────────────────────────────────────────── */
    @keyframes fadeUp {
      from { opacity: 0; transform: translateY(10px); }
      to   { opacity: 1; transform: translateY(0); }
    }
    @keyframes pulse-dot {
      0%, 100% { box-shadow: 0 0 6px #00ff8888; }
      50%       { box-shadow: 0 0 2px #00ff8822; }
    }
    @keyframes slide-in {
      from { transform: translateX(320px); opacity: 0; }
      to   { transform: translateX(0);     opacity: 1; }
    }

    .msg-enter   { animation: fadeUp 0.28s ease forwards; }
    .mem-slide   { animation: slide-in 0.22s ease forwards; }
    .pulse-ready { animation: pulse-dot 2.5s ease infinite; }
  `}</style>
);

// ── Chip (internal) ────────────────────────────────────────────────────────────

const Chip = ({ label, color }) => (
  <span style={{
    background:   `${color}18`,
    border:       `1px solid ${color}40`,
    borderRadius: 3,
    padding:      "1px 7px",
    fontSize:     10,
    color,
    fontFamily:   "monospace",
    whiteSpace:   "nowrap",
  }}>
    {label}
  </span>
);

// ── CostBadge ─────────────────────────────────────────────────────────────────

export const CostBadge = ({ cost }) => (
  <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap", marginTop: 4 }}>
    <span style={{
      background:   "rgba(0,255,136,0.07)",
      border:       "1px solid rgba(0,255,136,0.22)",
      borderRadius: 4,
      padding:      "2px 8px",
      fontSize:     10,
      color:        "#00ff88",
      fontFamily:   "monospace",
    }}>
      ~{formatCost(cost.total)}
    </span>
    <span style={{ color: "#1e3040", fontSize: 10, fontFamily: "monospace" }}>
      {cost.inputTokens}↑ {cost.outputTokens}↓ tok
    </span>
  </div>
);

// ── MemoryHints ───────────────────────────────────────────────────────────────

export const MemoryHints = ({ hints }) => {
  if (!hints) return null;
  const total =
    hints.similarResearch + hints.relevantPrefs +
    hints.relevantInsights + hints.relatedConversations;
  if (total === 0) {
    return <span style={{ color: "#1a2530", fontSize: 10, fontFamily: "monospace" }}>🔍 0 memory hits</span>;
  }
  return (
    <div style={{ display: "flex", gap: 5, flexWrap: "wrap", alignItems: "center" }}>
      <span style={{ color: "#1e3040", fontSize: 10, fontFamily: "monospace" }}>🧠 Qdrant:</span>
      {hints.relevantPrefs        > 0 && <Chip label={`${hints.relevantPrefs} pref`}       color="#a78bfa" />}
      {hints.similarResearch      > 0 && <Chip label={`${hints.similarResearch} research`}  color="#38bdf8" />}
      {hints.relevantInsights     > 0 && <Chip label={`${hints.relevantInsights} insight`}  color="#f59e0b" />}
      {hints.relatedConversations > 0 && <Chip label={`${hints.relatedConversations} conv`} color="#34d399" />}
    </div>
  );
};

// ── CitationPanel ─────────────────────────────────────────────────────────────

export const CitationPanel = ({ citations }) => {
  const [open, setOpen] = useState(false);
  if (!citations?.length) return null;
  return (
    <div style={{ marginTop: 6 }}>
      <button
        onClick={() => setOpen((o) => !o)}
        style={{
          background:   "rgba(129,140,248,0.08)",
          border:       "1px solid rgba(129,140,248,0.25)",
          borderRadius: 6,
          padding:      "3px 12px",
          color:        "#818cf8",
          cursor:       "pointer",
          fontSize:     10,
          fontFamily:   "JetBrains Mono, monospace",
          display:      "flex",
          alignItems:   "center",
          gap:          6,
        }}
      >
        📚 {citations.length} citation{citations.length > 1 ? "s" : ""} extracted {open ? "▲" : "▼"}
      </button>

      {open && (
        <div style={{
          background:   "#060a12",
          border:       "1px solid #0f1620",
          borderRadius: 8,
          padding:      "10px 14px",
          marginTop:    5,
        }}>
          {citations.map((c, i) => (
            <div
              key={i}
              style={{
                padding:      "5px 0",
                borderBottom: i < citations.length - 1 ? "1px solid #0a0f1a" : "none",
              }}
            >
              <div style={{ color: "#e2e8f0", fontSize: 11, fontWeight: 600 }}>
                [{c.id}] {c.title}
              </div>
              <div style={{ color: "#334155", fontSize: 10, marginTop: 1 }}>
                {c.authors}{c.year ? ` · ${c.year}` : ""}
              </div>
              {c.arxivId && (
                <a
                  href={`https://arxiv.org/abs/${c.arxivId}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  style={{ color: "#818cf8", fontSize: 10 }}
                >
                  arxiv:{c.arxivId} ↗
                </a>
              )}
              {c.url && !c.arxivId && (
                <a
                  href={c.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  style={{ color: "#34d399", fontSize: 10 }}
                >
                  {c.url} ↗
                </a>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

// ── ClarifyCard ───────────────────────────────────────────────────────────────

export const ClarifyCard = ({ questions, onDismiss }) => (
  <div style={{
    background:   "#07090f",
    border:       "1px solid rgba(253,230,138,0.22)",
    borderRadius: 10,
    padding:      "13px 16px",
    maxWidth:     "88%",
    marginTop:    4,
  }}>
    <div style={{
      color:         "#fde68a",
      fontSize:      10,
      fontWeight:    700,
      marginBottom:  7,
      letterSpacing: "0.07em",
    }}>
      ❓ CLARIFYING QUESTION{questions.length > 1 ? "S" : ""}
    </div>

    {questions.map((q, i) => (
      <div
        key={i}
        style={{
          color:        "#cbd5e1",
          fontSize:     12.5,
          marginBottom: i < questions.length - 1 ? 5 : 0,
          lineHeight:   1.55,
        }}
      >
        {i + 1}. {q}
      </div>
    ))}

    <div style={{ marginTop: 9 }}>
      <span style={{ color: "#334155", fontSize: 10 }}>Type your answer below, or </span>
      <button
        onClick={onDismiss}
        style={{
          background:     "none",
          border:         "none",
          color:          "#475569",
          cursor:         "pointer",
          fontSize:       10,
          textDecoration: "underline",
          fontFamily:     "JetBrains Mono, monospace",
        }}
      >
        skip and proceed
      </button>
    </div>
  </div>
);

// ── FileBadge ─────────────────────────────────────────────────────────────────

export const FileBadge = ({ name, onRemove }) => (
  <div style={{
    display:      "flex",
    alignItems:   "center",
    gap:          6,
    background:   "rgba(129,140,248,0.08)",
    border:       "1px solid rgba(129,140,248,0.25)",
    borderRadius: 6,
    padding:      "3px 10px",
    fontSize:     11,
    maxWidth:     220,
  }}>
    <span style={{ color: "#818cf8" }}>📄</span>
    <span style={{
      color:        "#a5b4fc",
      overflow:     "hidden",
      textOverflow: "ellipsis",
      whiteSpace:   "nowrap",
      flex:         1,
    }}>
      {name}
    </span>
    {onRemove && (
      <button
        onClick={onRemove}
        style={{
          background: "none",
          border:     "none",
          color:      "#334155",
          cursor:     "pointer",
          fontSize:   15,
          lineHeight: 1,
          padding:    "0 2px",
          flexShrink: 0,
        }}
      >
        ×
      </button>
    )}
  </div>
);

// ── ModeSelector ──────────────────────────────────────────────────────────────

export const ModeSelector = ({ mode, setMode, disabled }) => (
  <div style={{
    display:      "flex",
    gap:          3,
    background:   "#060a10",
    borderRadius: 8,
    padding:      3,
    border:       "1px solid #0d1520",
  }}>
    {["quick", "deep"].map((m) => (
      <button
        key={m}
        className="mode-btn"
        onClick={() => setMode(m)}
        disabled={disabled}
        style={{
          background: mode === m
            ? m === "quick" ? "#00ff88" : "#7c3aed"
            : "transparent",
          color: mode === m
            ? m === "quick" ? "#000" : "#fff"
            : "#2d4055",
        }}
      >
        {m === "quick" ? "⚡ Quick" : "🔬 Deep"}
      </button>
    ))}
  </div>
);

// ── ThinkingIndicator ─────────────────────────────────────────────────────────

const BRAILLE = ["⠋","⠙","⠹","⠸","⠼","⠴","⠦","⠧","⠇","⠏"];

export const ThinkingIndicator = ({ mode }) => {
  const [frame, setFrame] = useState(0);

  useEffect(() => {
    const t = setInterval(() => setFrame((f) => (f + 1) % BRAILLE.length), 90);
    return () => clearInterval(t);
  }, []);

  const col    = mode === "deep" ? "#a78bfa" : "#00ff88";
  const border = mode === "deep" ? "rgba(167,139,250,0.18)" : "rgba(0,255,136,0.15)";

  return (
    <div style={{
      display:    "flex",
      alignItems: "center",
      gap:        12,
      padding:    "13px 18px",
      background: "#060a10",
      borderRadius: 10,
      border:     `1px solid ${border}`,
      maxWidth:   400,
      margin:     "12px 0",
    }}>
      <span style={{ fontSize: 17, color: col, fontFamily: "monospace" }}>
        {BRAILLE[frame]}
      </span>
      <div>
        <div style={{ color: "#cbd5e1", fontSize: 12, fontWeight: 600 }}>
          {mode === "deep" ? "Deep research in progress…" : "Synthesizing answer…"}
        </div>
        <div style={{ color: "#1e3040", fontSize: 10, marginTop: 2 }}>
          Qdrant retrieval · memory injection · generating
        </div>
      </div>
    </div>
  );
};

// ── Message ───────────────────────────────────────────────────────────────────

export const Message = ({ msg, onDismissClarify }) => {
  const isUser   = msg.role === "user";
  const isSystem = msg.mode === "system";

  if (isSystem) {
    return (
      <div style={{
        padding:      "10px 14px",
        background:   "#060a10",
        borderRadius: 8,
        border:       "1px solid #0f1620",
        margin:       "8px 0",
      }}>
        <span style={{ color: "#334155", fontSize: 11, fontFamily: "monospace" }}>
          ⚠ {msg.content}
        </span>
      </div>
    );
  }

  const modeCol    = msg.mode === "deep" ? "#a78bfa" : "#00ff88";
  const modeBg     = msg.mode === "deep" ? "rgba(167,139,250,0.07)" : "rgba(0,255,136,0.06)";
  const modeBorder = msg.mode === "deep" ? "rgba(167,139,250,0.22)" : "rgba(0,255,136,0.2)";

  return (
    <div
      className="msg-enter"
      style={{
        display:       "flex",
        flexDirection: "column",
        alignItems:    isUser ? "flex-end" : "flex-start",
        margin:        "14px 0",
        gap:           5,
      }}
    >
      {/* Meta row (assistant only) */}
      {!isUser && !msg.isClarify && (
        <div style={{ display: "flex", alignItems: "center", gap: 7, flexWrap: "wrap" }}>
          <span style={{
            background:    modeBg,
            border:        `1px solid ${modeBorder}`,
            borderRadius:  4,
            padding:       "1px 8px",
            fontSize:      9,
            color:         modeCol,
            letterSpacing: "0.1em",
            textTransform: "uppercase",
          }}>
            {msg.mode === "deep" ? "🔬 Deep" : "⚡ Quick"}
          </span>
          {msg.latency && (
            <span style={{ color: "#1a2a3a", fontSize: 9, fontFamily: "monospace" }}>
              {(msg.latency / 1000).toFixed(1)}s
            </span>
          )}
          {msg.fileAttached && <Chip label={`📄 ${msg.fileAttached}`} color="#818cf8" />}
          {msg.memHints && <MemoryHints hints={msg.memHints} />}
        </div>
      )}

      {/* Bubble */}
      <div style={{
        maxWidth:     isUser ? "70%" : "96%",
        padding:      isUser ? "10px 15px" : "18px 20px",
        background:   isUser ? "#090e18" : "#060a10",
        borderRadius: isUser ? "12px 12px 4px 12px" : "4px 12px 12px 12px",
        border:       isUser ? "1px solid #12202e" : "1px solid #0d1520",
        lineHeight:   1.7,
      }}>
        {isUser ? (
          <div>
            <span style={{ color: "#b8cfe0", fontSize: 13 }}>{msg.content}</span>
            {msg.fileAttached && (
              <div style={{ marginTop: 6 }}>
                <FileBadge name={msg.fileAttached} />
              </div>
            )}
          </div>
        ) : (
          <div
            className="markdown-body"
            dangerouslySetInnerHTML={{ __html: renderMarkdown(msg.content) }}
          />
        )}
      </div>

      {/* Clarification card */}
      {msg.isClarify && msg.clarifyQuestions && (
        <ClarifyCard questions={msg.clarifyQuestions} onDismiss={onDismissClarify} />
      )}

      {/* Footer badges */}
      {!isUser && msg.cost     && <CostBadge     cost={msg.cost} />}
      {!isUser && msg.citations && <CitationPanel citations={msg.citations} />}
    </div>
  );
};

// ── MemoryPanel ───────────────────────────────────────────────────────────────

export const MemoryPanel = ({ memoryStats, allPrefs, recentHistory, onClose, onClear }) => (
  <div
    className="mem-slide"
    style={{
      position:   "fixed",
      right:      0,
      top:        0,
      bottom:     0,
      width:      320,
      background: "#050810",
      borderLeft: "1px solid #0d1520",
      zIndex:     100,
      padding:    "22px 18px",
      overflowY:  "auto",
      fontFamily: "JetBrains Mono, monospace",
    }}
  >
    {/* Header */}
    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
      <div>
        <div style={{ color: "#00ff88", fontSize: 11, fontWeight: 700, letterSpacing: "0.1em" }}>
          QDRANT MEMORY
        </div>
        <div style={{ color: "#1a2a38", fontSize: 9, marginTop: 1 }}>
          4 collections · {memoryStats.reduce((s, c) => s + c.count, 0)} total points
        </div>
      </div>
      <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
        <button
          onClick={onClear}
          style={{
            background:   "rgba(255,70,70,0.07)",
            border:       "1px solid rgba(255,70,70,0.18)",
            borderRadius: 4,
            padding:      "2px 9px",
            color:        "#f87171",
            cursor:       "pointer",
            fontSize:     9,
            fontFamily:   "JetBrains Mono, monospace",
          }}
        >
          Clear All
        </button>
        <button
          onClick={onClose}
          style={{
            background: "none",
            border:     "none",
            color:      "#1e3040",
            cursor:     "pointer",
            fontSize:   18,
            lineHeight: 1,
          }}
        >
          ×
        </button>
      </div>
    </div>

    {/* Collections */}
    <Section label="COLLECTIONS">
      {memoryStats.map((s) => (
        <Row key={s.name}>
          <span style={{ color: "#1e3040", fontSize: 10 }}>{s.name}</span>
          <span style={{ color: s.count > 0 ? "#00ff88" : "#111a25", fontSize: 10 }}>
            {s.count} pts
          </span>
        </Row>
      ))}
    </Section>

    {/* Preferences */}
    <Section label="LEARNED PREFERENCES">
      {allPrefs.length === 0 ? (
        <span style={{ color: "#111a25", fontSize: 10 }}>None yet — try "Remember I prefer Python"</span>
      ) : (
        allPrefs.map((p, i) => (
          <div key={i} style={{ padding: "5px 0", borderBottom: "1px solid #080c14" }}>
            <div style={{ display: "flex", justifyContent: "space-between" }}>
              <span style={{ color: "#334155", fontSize: 10 }}>{p.key}</span>
              <span style={{ color: "#a78bfa", fontSize: 10 }}>{JSON.stringify(p.value)}</span>
            </div>
            <div style={{ color: "#1a2535", fontSize: 9 }}>[{p.domain}]</div>
          </div>
        ))
      )}
    </Section>

    {/* History */}
    <Section label={`RESEARCH HISTORY (${recentHistory.length})`}>
      {recentHistory.length === 0 ? (
        <span style={{ color: "#111a25", fontSize: 10 }}>No history yet</span>
      ) : (
        recentHistory.map((h, i) => (
          <div key={i} style={{ padding: "7px 0", borderBottom: "1px solid #080c14" }}>
            <div style={{ display: "flex", gap: 6, alignItems: "flex-start" }}>
              <span style={{ color: h.mode === "deep" ? "#a78bfa" : "#00ff88", fontSize: 11, flexShrink: 0 }}>
                {h.mode === "deep" ? "🔬" : "⚡"}
              </span>
              <span style={{ color: "#334155", fontSize: 10, lineHeight: 1.5 }}>
                {h.query.slice(0, 48)}{h.query.length > 48 ? "…" : ""}
              </span>
            </div>
            {h.summary && (
              <div style={{ color: "#111a25", fontSize: 9, paddingLeft: 18, marginTop: 2, lineHeight: 1.5 }}>
                {h.summary.slice(0, 70)}{h.summary.length > 70 ? "…" : ""}
              </div>
            )}
          </div>
        ))
      )}
    </Section>
  </div>
);

// internal helpers for MemoryPanel
const Section = ({ label, children }) => (
  <div style={{ marginBottom: 20 }}>
    <div style={{ color: "#1a2a38", fontSize: 9, letterSpacing: "0.12em", marginBottom: 8 }}>
      {label}
    </div>
    {children}
  </div>
);

const Row = ({ children }) => (
  <div style={{ display: "flex", justifyContent: "space-between", padding: "5px 0", borderBottom: "1px solid #080c14" }}>
    {children}
  </div>
);

// ── InputBar ──────────────────────────────────────────────────────────────────

export const InputBar = ({
  input, setInput, onSubmit, onKeyDown,
  mode, setMode, loading, showMemory,
  inputRef, attachedFile, setAttachedFile,
  fileInputRef, onFileSelect,
}) => (
  <div style={{
    position:   "fixed",
    bottom:     0,
    left:       0,
    right:      showMemory ? 320 : 0,
    background: "linear-gradient(transparent, #040608 28%)",
    padding:    "14px 24px 22px",
    transition: "right 0.22s",
    zIndex:     40,
  }}>
    <div style={{ maxWidth: 860, margin: "0 auto" }}>

      {/* Mode row */}
      <div style={{ display: "flex", gap: 8, marginBottom: 8, alignItems: "center", flexWrap: "wrap" }}>
        <ModeSelector mode={mode} setMode={setMode} disabled={loading} />
        <span style={{ color: "#1a2a38", fontSize: 10 }}>
          {mode === "quick" ? "< 30s · focused" : "< 3min · comprehensive"}
        </span>
        {attachedFile && (
          <FileBadge name={attachedFile.name} onRemove={() => setAttachedFile(null)} />
        )}
      </div>

      {/* Input row */}
      <div style={{
        display:      "flex",
        gap:          6,
        background:   "#060a10",
        border:       "1px solid #0d1a28",
        borderRadius: 10,
        padding:      "3px 4px 3px 10px",
        alignItems:   "flex-end",
      }}>
        {/* Attach button */}
        <button
          onClick={() => fileInputRef.current?.click()}
          disabled={loading}
          title="Attach PDF or research paper"
          style={{
            background: "none",
            border:     "none",
            color:      attachedFile ? "#818cf8" : "#1a2535",
            cursor:     loading ? "not-allowed" : "pointer",
            fontSize:   18,
            padding:    "6px 3px",
            alignSelf:  "flex-end",
            transition: "color 0.15s",
            flexShrink: 0,
          }}
        >
          📎
        </button>
        <input
          ref={fileInputRef}
          type="file"
          accept=".pdf,image/*"
          onChange={onFileSelect}
          style={{ display: "none" }}
        />

        {/* Textarea */}
        <textarea
          ref={inputRef}
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={onKeyDown}
          placeholder={
            attachedFile
              ? `Ask about ${attachedFile.name}…`
              : mode === "quick"
              ? "Ask a focused technical question…"
              : "Ask for a deep technical analysis…"
          }
          rows={1}
          disabled={loading}
          style={{
            flex:       1,
            background: "transparent",
            border:     "none",
            color:      "#b8cfe0",
            fontSize:   13,
            fontFamily: "JetBrains Mono, monospace",
            lineHeight: 1.55,
            padding:    "8px 0",
            minHeight:  36,
            maxHeight:  120,
            resize:     "none",
            outline:    "none",
          }}
          onInput={(e) => {
            e.target.style.height = "auto";
            e.target.style.height = Math.min(e.target.scrollHeight, 120) + "px";
          }}
        />

        {/* Send */}
        <button
          className="send-btn"
          onClick={onSubmit}
          disabled={loading || (!input.trim() && !attachedFile)}
          style={{
            background: loading || (!input.trim() && !attachedFile)
              ? "#0a0f1a"
              : mode === "deep" ? "#7c3aed" : "#00ff88",
            color: loading || (!input.trim() && !attachedFile)
              ? "#1a2535"
              : mode === "deep" ? "#fff" : "#000",
          }}
        >
          {loading ? "…" : mode === "deep" ? "Research →" : "Ask →"}
        </button>
      </div>

      {/* Footer hint */}
      <div style={{ marginTop: 5, color: "#0d1a28", fontSize: 9, textAlign: "center" }}>
        ⏎ send · Shift+⏎ newline · 📎 attach PDF · memory persists across sessions
      </div>
    </div>
  </div>
);