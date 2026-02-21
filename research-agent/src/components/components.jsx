/**
 * components.jsx — Updated with PDF attachment UI, citation panel, clarify card.
 */
import { useState, useEffect } from "react";
import { renderMarkdown } from "../lib/markdown.js";
import { formatCost } from "../lib/cost.js";

export const CostBadge = ({ cost }) => (
  <div style={{ display: "flex", gap: "8px", alignItems: "center", flexWrap: "wrap" }}>
    <span style={{ background: "rgba(0,255,136,0.1)", border: "1px solid rgba(0,255,136,0.3)", borderRadius: "4px", padding: "2px 8px", fontSize: "11px", color: "#00ff88", fontFamily: "monospace" }}>
      ~{formatCost(cost.total)}
    </span>
    <span style={{ color: "#555", fontSize: "11px", fontFamily: "monospace" }}>
      {cost.inputTokens}↑ {cost.outputTokens}↓ tokens
    </span>
  </div>
);

export const MemoryHints = ({ hints }) => {
  if (!hints) return null;
  const total = hints.similarResearch + hints.relevantPrefs + hints.relevantInsights + hints.relatedConversations;
  if (total === 0) return <span style={{ color: "#333", fontSize: "10px", fontFamily: "monospace" }}>🔍 0 memory hits</span>;
  return (
    <div style={{ display: "flex", gap: "6px", flexWrap: "wrap", alignItems: "center" }}>
      <span style={{ color: "#444", fontSize: "10px", fontFamily: "monospace" }}>🧠 Qdrant:</span>
      {hints.relevantPrefs > 0 && <Chip label={`${hints.relevantPrefs} pref`} color="#7c3aed" />}
      {hints.similarResearch > 0 && <Chip label={`${hints.similarResearch} research`} color="#0ea5e9" />}
      {hints.relevantInsights > 0 && <Chip label={`${hints.relevantInsights} insight`} color="#f59e0b" />}
      {hints.relatedConversations > 0 && <Chip label={`${hints.relatedConversations} conv`} color="#10b981" />}
    </div>
  );
};

const Chip = ({ label, color }) => (
  <span style={{ background: `${color}18`, border: `1px solid ${color}44`, borderRadius: "3px", padding: "1px 6px", fontSize: "10px", color, fontFamily: "monospace" }}>{label}</span>
);

// ── Citation Panel ──────────────────────────────────────────────────────────

export const CitationPanel = ({ citations }) => {
  const [open, setOpen] = useState(false);
  if (!citations?.length) return null;
  return (
    <div style={{ marginTop: "8px", maxWidth: "95%" }}>
      <button onClick={() => setOpen(!open)} style={{
        background: "rgba(129,140,248,0.1)", border: "1px solid rgba(129,140,248,0.3)",
        borderRadius: "6px", padding: "4px 12px", color: "#818cf8",
        cursor: "pointer", fontSize: "11px", fontFamily: "monospace",
        display: "flex", alignItems: "center", gap: "6px",
      }}>
        📚 {citations.length} citation{citations.length > 1 ? "s" : ""} extracted {open ? "▲" : "▼"}
      </button>
      {open && (
        <div style={{ background: "#0a0f1e", border: "1px solid #1e293b", borderRadius: "8px", padding: "12px", marginTop: "6px" }}>
          {citations.map((c, i) => (
            <div key={i} style={{ padding: "6px 0", borderBottom: i < citations.length - 1 ? "1px solid #111" : "none" }}>
              <div style={{ color: "#e2e8f0", fontSize: "12px", fontWeight: 600 }}>[{c.id}] {c.title}</div>
              <div style={{ color: "#475569", fontSize: "11px" }}>{c.authors} · {c.year}</div>
              {c.arxivId && (
                <a href={`https://arxiv.org/abs/${c.arxivId}`} target="_blank" rel="noopener" style={{ color: "#818cf8", fontSize: "11px", textDecoration: "none" }}>
                  arxiv:{c.arxivId} ↗
                </a>
              )}
              {c.url && !c.arxivId && (
                <a href={c.url} target="_blank" rel="noopener" style={{ color: "#6ee7b7", fontSize: "11px", textDecoration: "none" }}>
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

// ── Clarify Card ────────────────────────────────────────────────────────────

export const ClarifyCard = ({ questions, onDismiss }) => (
  <div style={{ background: "#0f172a", border: "1px solid rgba(253,230,138,0.3)", borderRadius: "10px", padding: "14px 18px", maxWidth: "90%", marginTop: "4px" }}>
    <div style={{ color: "#fde68a", fontSize: "11px", fontWeight: 700, marginBottom: "8px", letterSpacing: "0.05em" }}>
      ❓ CLARIFYING QUESTION{questions.length > 1 ? "S" : ""}
    </div>
    {questions.map((q, i) => (
      <div key={i} style={{ color: "#cbd5e1", fontSize: "13px", marginBottom: i < questions.length - 1 ? "6px" : "0", lineHeight: 1.5 }}>
        {i + 1}. {q}
      </div>
    ))}
    <div style={{ marginTop: "10px", display: "flex", gap: "8px" }}>
      <span style={{ color: "#475569", fontSize: "11px" }}>Type your answer below, or</span>
      <button onClick={onDismiss} style={{ background: "none", border: "none", color: "#64748b", cursor: "pointer", fontSize: "11px", textDecoration: "underline" }}>
        skip and proceed
      </button>
    </div>
  </div>
);

// ── File Attachment Badge ───────────────────────────────────────────────────

export const FileBadge = ({ name, onRemove }) => (
  <div style={{ display: "flex", alignItems: "center", gap: "6px", background: "rgba(129,140,248,0.1)", border: "1px solid rgba(129,140,248,0.3)", borderRadius: "6px", padding: "3px 10px", fontSize: "11px" }}>
    <span style={{ color: "#818cf8" }}>📄</span>
    <span style={{ color: "#a5b4fc", maxWidth: "160px", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{name}</span>
    {onRemove && (
      <button onClick={onRemove} style={{ background: "none", border: "none", color: "#475569", cursor: "pointer", fontSize: "14px", lineHeight: 1, padding: "0 2px" }}>×</button>
    )}
  </div>
);

// ── ModeSelector ────────────────────────────────────────────────────────────

export const ModeSelector = ({ mode, setMode, disabled }) => (
  <div style={{ display: "flex", gap: "4px", background: "#0a0a0a", borderRadius: "8px", padding: "3px", border: "1px solid #1a1a1a" }}>
    {["quick", "deep"].map((m) => (
      <button key={m} onClick={() => setMode(m)} disabled={disabled} style={{
        padding: "6px 16px", borderRadius: "6px", border: "none", cursor: disabled ? "not-allowed" : "pointer",
        background: mode === m ? (m === "quick" ? "#00ff88" : "#7c3aed") : "transparent",
        color: mode === m ? (m === "quick" ? "#000" : "#fff") : "#666",
        fontFamily: "'JetBrains Mono', monospace", fontSize: "12px", fontWeight: 600,
        transition: "all 0.2s", letterSpacing: "0.05em", textTransform: "uppercase",
      }}>
        {m === "quick" ? "⚡ Quick" : "🔬 Deep"}
      </button>
    ))}
  </div>
);

// ── ThinkingIndicator ────────────────────────────────────────────────────────

const FRAMES = ["⠋","⠙","⠹","⠸","⠼","⠴","⠦","⠧","⠇","⠏"];

export const ThinkingIndicator = ({ mode }) => {
  const [frame, setFrame] = useState(0);
  useEffect(() => {
    const t = setInterval(() => setFrame(f => (f + 1) % FRAMES.length), 100);
    return () => clearInterval(t);
  }, []);
  const color  = mode === "deep" ? "#7c3aed" : "#00ff88";
  const border = mode === "deep" ? "rgba(124,58,237,0.3)" : "rgba(0,255,136,0.2)";
  return (
    <div style={{ display: "flex", alignItems: "center", gap: "12px", padding: "16px 20px", background: "#0d0d0d", borderRadius: "12px", border: `1px solid ${border}` }}>
      <span style={{ fontSize: "18px", color, fontFamily: "monospace" }}>{FRAMES[frame]}</span>
      <div>
        <div style={{ color: "#ccc", fontSize: "13px", fontWeight: 600 }}>
          {mode === "deep" ? "Deep research in progress..." : "Synthesizing answer..."}
        </div>
        <div style={{ color: "#555", fontSize: "11px", marginTop: "2px" }}>
          Querying Qdrant · Injecting memory context · Generating response
        </div>
      </div>
    </div>
  );
};

// ── Message ──────────────────────────────────────────────────────────────────

export const Message = ({ msg, onDismissClarify }) => {
  const isUser   = msg.role === "user";
  const isSystem = msg.role === "system";

  if (isSystem) return (
    <div style={{ padding: "10px 16px", background: "#0d0d0d", borderRadius: "8px", border: "1px solid #1a1a1a", margin: "8px 0" }}>
      <span style={{ color: "#555", fontSize: "11px", fontFamily: "monospace" }}>⚙ {msg.content}</span>
    </div>
  );

  const modeColor  = msg.mode === "deep" ? "#a855f7" : "#00ff88";
  const modeBg     = msg.mode === "deep" ? "rgba(124,58,237,0.2)" : "rgba(0,255,136,0.1)";
  const modeBorder = msg.mode === "deep" ? "rgba(124,58,237,0.4)" : "rgba(0,255,136,0.3)";

  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: isUser ? "flex-end" : "flex-start", margin: "12px 0", gap: "6px" }}>
      {!isUser && !msg.isClarify && (
        <div style={{ display: "flex", alignItems: "center", gap: "8px", flexWrap: "wrap" }}>
          <span style={{ background: modeBg, border: `1px solid ${modeBorder}`, borderRadius: "4px", padding: "1px 8px", fontSize: "10px", color: modeColor, fontFamily: "monospace", textTransform: "uppercase", letterSpacing: "0.1em" }}>
            {msg.mode === "deep" ? "🔬 Deep" : "⚡ Quick"}
          </span>
          {msg.latency && <span style={{ color: "#444", fontSize: "10px", fontFamily: "monospace" }}>{msg.latency}ms</span>}
          {msg.fileAttached && <Chip label={`📄 ${msg.fileAttached}`} color="#818cf8" />}
          {msg.memHints && <MemoryHints hints={msg.memHints} />}
        </div>
      )}

      <div style={{
        maxWidth: isUser ? "70%" : "95%",
        padding: isUser ? "10px 16px" : "20px",
        background: isUser ? "#1a1a2e" : "#0d0d0d",
        borderRadius: isUser ? "12px 12px 4px 12px" : "4px 12px 12px 12px",
        border: isUser ? "1px solid #2a2a4a" : "1px solid #1a1a1a",
        color: "#ddd", fontSize: "14px", lineHeight: "1.7",
      }}>
        {isUser ? (
          <div>
            <span style={{ color: "#e0e0ff" }}>{msg.content}</span>
            {msg.fileAttached && (
              <div style={{ marginTop: "6px" }}><FileBadge name={msg.fileAttached} /></div>
            )}
          </div>
        ) : (
          <div className="markdown-body" dangerouslySetInnerHTML={{ __html: renderMarkdown(msg.content) }} />
        )}
      </div>

      {msg.isClarify && msg.clarifyQuestions && (
        <ClarifyCard questions={msg.clarifyQuestions} onDismiss={onDismissClarify} />
      )}

      {!isUser && msg.cost && <CostBadge cost={msg.cost} />}
      {!isUser && msg.citations && <CitationPanel citations={msg.citations} />}
    </div>
  );
};

// ── MemoryPanel ───────────────────────────────────────────────────────────────

export const MemoryPanel = ({ memoryStats, allPrefs, recentHistory, onClose, onClear }) => (
  <div style={{ position: "fixed", right: 0, top: 0, bottom: 0, width: "340px", background: "#080808", borderLeft: "1px solid #1a1a1a", zIndex: 100, padding: "24px", overflowY: "auto", fontFamily: "'JetBrains Mono', monospace" }}>
    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "20px" }}>
      <span style={{ color: "#00ff88", fontSize: "13px", fontWeight: 700, letterSpacing: "0.1em" }}>QDRANT MEMORY</span>
      <div style={{ display: "flex", gap: "8px" }}>
        <button onClick={onClear} style={{ background: "rgba(255,80,80,0.1)", border: "1px solid rgba(255,80,80,0.3)", borderRadius: "4px", padding: "2px 8px", color: "#ff5050", cursor: "pointer", fontSize: "10px" }}>Clear All</button>
        <button onClick={onClose} style={{ background: "none", border: "none", color: "#555", cursor: "pointer", fontSize: "18px" }}>×</button>
      </div>
    </div>
    <div style={{ marginBottom: "20px" }}>
      <div style={{ color: "#555", fontSize: "11px", marginBottom: "8px", letterSpacing: "0.1em" }}>COLLECTIONS</div>
      {memoryStats.map(s => (
        <div key={s.name} style={{ display: "flex", justifyContent: "space-between", padding: "5px 0", borderBottom: "1px solid #0e0e0e" }}>
          <span style={{ color: "#555", fontSize: "11px" }}>{s.name}</span>
          <span style={{ color: s.count > 0 ? "#00ff88" : "#333", fontSize: "11px" }}>{s.count} pts</span>
        </div>
      ))}
    </div>
    <div style={{ marginBottom: "20px" }}>
      <div style={{ color: "#555", fontSize: "11px", marginBottom: "8px", letterSpacing: "0.1em" }}>PREFERENCES</div>
      {allPrefs.length === 0
        ? <span style={{ color: "#2a2a2a", fontSize: "11px" }}>None yet</span>
        : allPrefs.map((p, i) => (
          <div key={i} style={{ padding: "5px 0", borderBottom: "1px solid #0e0e0e" }}>
            <div style={{ display: "flex", justifyContent: "space-between" }}>
              <span style={{ color: "#777", fontSize: "11px" }}>{p.key}</span>
              <span style={{ color: "#7c3aed", fontSize: "11px" }}>{JSON.stringify(p.value)}</span>
            </div>
            <div style={{ color: "#333", fontSize: "10px" }}>[{p.domain}]</div>
          </div>
        ))
      }
    </div>
    <div>
      <div style={{ color: "#555", fontSize: "11px", marginBottom: "8px", letterSpacing: "0.1em" }}>HISTORY ({recentHistory.length})</div>
      {recentHistory.map((h, i) => (
        <div key={i} style={{ padding: "7px 0", borderBottom: "1px solid #0e0e0e" }}>
          <div style={{ display: "flex", gap: "6px" }}>
            <span style={{ color: h.mode === "deep" ? "#7c3aed" : "#00ff88" }}>{h.mode === "deep" ? "🔬" : "⚡"}</span>
            <span style={{ color: "#bbb", fontSize: "11px" }}>{h.query.slice(0, 50)}{h.query.length > 50 ? "…" : ""}</span>
          </div>
          {h.summary && <div style={{ color: "#333", fontSize: "10px", paddingLeft: "18px" }}>{h.summary}</div>}
        </div>
      ))}
    </div>
  </div>
);

// ── InputBar ──────────────────────────────────────────────────────────────────

export const InputBar = ({ input, setInput, onSubmit, onKeyDown, mode, setMode, loading, showMemory, inputRef, attachedFile, setAttachedFile, fileInputRef, onFileSelect }) => (
  <div style={{ position: "fixed", bottom: 0, left: 0, right: showMemory ? "340px" : 0, background: "linear-gradient(transparent, #050505 30%)", padding: "16px 24px 24px", transition: "right 0.3s" }}>
    <div style={{ maxWidth: "900px", margin: "0 auto" }}>
      <div style={{ display: "flex", gap: "8px", marginBottom: "8px", alignItems: "center", flexWrap: "wrap" }}>
        <ModeSelector mode={mode} setMode={setMode} disabled={loading} />
        <span style={{ color: "#333", fontSize: "11px" }}>{mode === "quick" ? "< 30s · focused" : "< 3min · comprehensive"}</span>
        {attachedFile && <FileBadge name={attachedFile.name} onRemove={() => setAttachedFile(null)} />}
      </div>
      <div style={{ display: "flex", gap: "8px", background: "#0a0a0a", border: "1px solid #1e1e1e", borderRadius: "10px", padding: "4px 4px 4px 8px", alignItems: "flex-end" }}>
        {/* PDF / file attach button */}
        <button
          onClick={() => fileInputRef.current?.click()}
          disabled={loading}
          title="Attach PDF or research paper"
          style={{ background: "none", border: "none", color: attachedFile ? "#818cf8" : "#333", cursor: "pointer", fontSize: "18px", padding: "6px 4px", alignSelf: "flex-end", transition: "color 0.15s" }}
        >📎</button>
        <input ref={fileInputRef} type="file" accept=".pdf,image/*" onChange={onFileSelect} style={{ display: "none" }} />

        <textarea
          ref={inputRef} value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={onKeyDown}
          placeholder={attachedFile ? `Ask about ${attachedFile.name}...` : mode === "quick" ? "Ask a focused technical question..." : "Ask for a deep technical analysis..."}
          rows={1} disabled={loading}
          style={{ flex: 1, background: "transparent", border: "none", color: "#e0e0e0", fontSize: "14px", fontFamily: "'JetBrains Mono', monospace", lineHeight: "1.5", padding: "8px 0", minHeight: "36px", maxHeight: "120px", resize: "none", outline: "none" }}
          onInput={e => { e.target.style.height = "auto"; e.target.style.height = Math.min(e.target.scrollHeight, 120) + "px"; }}
        />
        <button onClick={onSubmit} disabled={loading || (!input.trim() && !attachedFile)} style={{
          background: loading || (!input.trim() && !attachedFile) ? "#111" : mode === "deep" ? "#7c3aed" : "#00ff88",
          color: loading || (!input.trim() && !attachedFile) ? "#333" : mode === "deep" ? "#fff" : "#000",
          border: "none", borderRadius: "7px", padding: "8px 16px",
          cursor: loading || (!input.trim() && !attachedFile) ? "not-allowed" : "pointer",
          fontFamily: "'JetBrains Mono', monospace", fontWeight: 700, fontSize: "13px",
          transition: "all 0.2s", whiteSpace: "nowrap", alignSelf: "flex-end",
        }}>
          {loading ? "..." : mode === "deep" ? "Research →" : "Ask →"}
        </button>
      </div>
      <div style={{ marginTop: "6px", color: "#252525", fontSize: "10px", textAlign: "center" }}>
        ⏎ send · Shift+⏎ newline · 📎 attach PDF · memory persists across sessions
      </div>
    </div>
  </div>
);

// ── GlobalStyles ───────────────────────────────────────────────────────────────

export const GlobalStyles = () => (
  <style>{`
    @import url('https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@300;400;600;700&family=Syne:wght@400;600;700;800&display=swap');
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { background: #050505; }
    .markdown-body h1.md-h1 { font-size: 20px; font-weight: 700; color: #fff; margin: 16px 0 8px; font-family: 'Syne', sans-serif; }
    .markdown-body h2.md-h2 { font-size: 16px; font-weight: 700; color: #e0e0e0; margin: 14px 0 6px; padding-bottom: 4px; border-bottom: 1px solid #1e1e1e; font-family: 'Syne', sans-serif; }
    .markdown-body h3.md-h3 { font-size: 14px; font-weight: 600; color: #ccc; margin: 12px 0 4px; font-family: 'Syne', sans-serif; }
    .markdown-body p { margin: 8px 0; }
    .code-block { background: #0a0a0a; border: 1px solid #1e1e1e; border-radius: 8px; padding: 16px; margin: 12px 0; overflow-x: auto; position: relative; }
    .code-lang { position: absolute; top: 6px; right: 10px; font-size: 10px; color: #444; font-family: 'JetBrains Mono', monospace; text-transform: uppercase; letter-spacing: 0.1em; }
    .code-block code { font-family: 'JetBrains Mono', monospace; font-size: 12px; color: #a8ff78; line-height: 1.6; }
    .inline-code { background: #111; border: 1px solid #222; border-radius: 3px; padding: 1px 5px; font-family: 'JetBrains Mono', monospace; font-size: 12px; color: #78c8ff; }
    .md-table { width: 100%; border-collapse: collapse; margin: 12px 0; font-size: 12px; }
    .md-table td { border: 1px solid #1e1e1e; padding: 6px 10px; color: #ccc; }
    .md-table tr:first-child td { background: #0d0d0d; color: #fff; font-weight: 600; }
    .md-table tr:hover td { background: #0d0d0d; }
    .md-list { padding-left: 20px; margin: 8px 0; }
    .md-list li { color: #ccc; margin: 4px 0; }
    .md-link { color: #78c8ff; text-decoration: none; }
    .md-link:hover { text-decoration: underline; }
    ::-webkit-scrollbar { width: 4px; }
    ::-webkit-scrollbar-track { background: #050505; }
    ::-webkit-scrollbar-thumb { background: #1a1a1a; border-radius: 2px; }
    textarea { resize: none; outline: none; }
    .example-chip:hover { background: #0f0f0f !important; border-color: #333 !important; color: #aaa !important; cursor: pointer; }
  `}</style>
);