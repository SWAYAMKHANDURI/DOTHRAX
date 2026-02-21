import { useResearch, EXAMPLE_QUERIES } from "../hooks/useResearch.js";
import { GlobalStyles, Message, ThinkingIndicator, MemoryPanel, InputBar } from "./components.jsx";

export default function App() {
  const {
    messages, input, setInput, mode, setMode, loading, memoryReady,
    attachedFile, setAttachedFile, fileInputRef, handleFileSelect,
    memoryStats, allPrefs, recentHistory,
    showMemory, setShowMemory, error, totalCost,
    clarifyQs, dismissClarify,
    messagesEndRef, inputRef,
    handleSubmit, handleKeyDown, clearMemory,
  } = useResearch();

  const totalMemPoints = memoryStats.reduce((s, c) => s + c.count, 0);

  return (
    <>
      <GlobalStyles />
      <div style={{ minHeight: "100vh", background: "#050505", fontFamily: "'JetBrains Mono', monospace", color: "#ccc" }}>

        <div style={{ borderBottom: "1px solid #111", padding: "12px 24px", display: "flex", alignItems: "center", justifyContent: "space-between", background: "#080808", position: "sticky", top: 0, zIndex: 50 }}>
          <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
            <div style={{ width: "8px", height: "8px", borderRadius: "50%", background: memoryReady ? "#00ff88" : "#555", boxShadow: memoryReady ? "0 0 8px #00ff88" : "none", transition: "all 0.5s" }} />
            <span style={{ fontFamily: "'Syne', sans-serif", fontWeight: 800, fontSize: "16px", color: "#fff", letterSpacing: "-0.02em" }}>
              Research<span style={{ color: "#00ff88" }}>Agent</span>
            </span>
            <span style={{ color: "#333", fontSize: "11px" }}>v4.0 · claude-sonnet-4 · qdrant</span>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
            {totalCost > 0 && <span style={{ color: "#444", fontSize: "11px", fontFamily: "monospace" }}>Session: ${totalCost.toFixed(5)}</span>}
            <button onClick={() => setShowMemory(!showMemory)} style={{ background: showMemory ? "rgba(0,255,136,0.1)" : "transparent", border: `1px solid ${showMemory ? "rgba(0,255,136,0.3)" : "#1e1e1e"}`, borderRadius: "6px", padding: "4px 12px", color: showMemory ? "#00ff88" : "#555", cursor: "pointer", fontSize: "11px" }}>
              🧠 Qdrant ({totalMemPoints} pts)
            </button>
          </div>
        </div>

        <div style={{ maxWidth: "900px", margin: "0 auto", padding: "24px 24px 180px", paddingRight: showMemory ? "380px" : "24px", transition: "padding-right 0.3s" }}>
          {messages.map(msg => (
            <Message key={msg.id} msg={msg} onDismissClarify={dismissClarify} />
          ))}
          {loading && <ThinkingIndicator mode={mode} />}
          {error && (
            <div style={{ background: "#1a0808", border: "1px solid #3a1111", borderRadius: "8px", padding: "12px 16px", color: "#ff6b6b", fontSize: "13px", margin: "8px 0" }}>⚠️ {error}</div>
          )}
          {messages.length <= 1 && !loading && (
            <div style={{ margin: "24px 0" }}>
              <div style={{ color: "#333", fontSize: "11px", letterSpacing: "0.1em", marginBottom: "12px" }}>EXAMPLE QUERIES</div>
              <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
                {EXAMPLE_QUERIES.map((q, i) => (
                  <button key={i} className="example-chip" onClick={() => { setInput(q.label.replace(/^[⚡🔬]\s*/, "")); setMode(q.mode); }} style={{ background: "#0a0a0a", border: "1px solid #1a1a1a", borderRadius: "6px", padding: "8px 14px", color: "#555", fontSize: "12px", textAlign: "left", transition: "all 0.15s", fontFamily: "'JetBrains Mono', monospace" }}>
                    {q.label}
                  </button>
                ))}
              </div>
            </div>
          )}
          <div ref={messagesEndRef} />
        </div>

        <InputBar
          input={input} setInput={setInput} onSubmit={handleSubmit} onKeyDown={handleKeyDown}
          mode={mode} setMode={setMode} loading={loading} showMemory={showMemory}
          inputRef={inputRef} attachedFile={attachedFile} setAttachedFile={setAttachedFile}
          fileInputRef={fileInputRef} onFileSelect={handleFileSelect}
        />

        {showMemory && (
          <MemoryPanel memoryStats={memoryStats} allPrefs={allPrefs} recentHistory={recentHistory} onClose={() => setShowMemory(false)} onClear={clearMemory} />
        )}
      </div>
    </>
  );
}