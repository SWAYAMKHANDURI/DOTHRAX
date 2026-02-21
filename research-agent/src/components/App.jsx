/**
 * App.jsx
 * Root application component — pure orchestration, zero business logic.
 *
 * Responsibilities:
 *   - Wire useResearch() hook → UI components
 *   - Render header, message list, memory panel, input bar
 *   - No fetch(), no math, no state beyond what the hook provides
 */

import { useResearch, EXAMPLE_QUERIES } from "../hooks/useResearch.js";
import {
  GlobalStyles,
  Message,
  ThinkingIndicator,
  MemoryPanel,
  InputBar,
} from "./components.jsx";

export default function App() {
  const {
    messages, input, setInput,
    mode, setMode,
    loading, memoryReady,
    attachedFile, setAttachedFile,
    fileInputRef, handleFileSelect,
    memoryStats, allPrefs, recentHistory,
    showMemory, setShowMemory,
    error, totalCost,
    clarifyQs, dismissClarify,
    messagesEndRef, inputRef,
    handleSubmit, handleKeyDown,
    clearMemory,
  } = useResearch();

  const totalPoints = memoryStats.reduce((s, c) => s + c.count, 0);

  return (
    <>
      <GlobalStyles />

      <div style={{
        minHeight:  "100vh",
        background: "#040608",
        fontFamily: "'JetBrains Mono', monospace",
        color:      "#e2e8f0",
      }}>

        {/* ── HEADER ─────────────────────────────────────────────────────── */}
        <div style={{
          position:     "sticky",
          top:          0,
          zIndex:       50,
          borderBottom: "1px solid #0d1520",
          padding:      "11px 24px",
          display:      "flex",
          alignItems:   "center",
          justifyContent: "space-between",
          background:   "#060a10",
        }}>
          {/* Brand */}
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <div style={{
              width:      7,
              height:     7,
              borderRadius: "50%",
              background: memoryReady ? "#00ff88" : "#1a2535",
              transition: "all 0.6s",
              className:  memoryReady ? "pulse-ready" : "",
              boxShadow:  memoryReady ? "0 0 6px #00ff8866" : "none",
            }} />
            <span style={{
              fontFamily:    "'Syne', sans-serif",
              fontWeight:    800,
              fontSize:      17,
              color:         "#f8fafc",
              letterSpacing: "-0.02em",
            }}>
              Research<span style={{ color: "#00ff88" }}>Agent</span>
            </span>
            <span style={{ color: "#1a2a3a", fontSize: 10 }}>
              v4.0 · claude-sonnet-4 · qdrant
            </span>
          </div>

          {/* Right controls */}
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            {totalCost > 0 && (
              <span style={{ color: "#1a2a3a", fontSize: 10, fontFamily: "monospace" }}>
                Session: ${totalCost.toFixed(5)}
              </span>
            )}
            <button
              onClick={() => setShowMemory((m) => !m)}
              style={{
                background:   showMemory ? "rgba(0,255,136,0.07)" : "transparent",
                border:       `1px solid ${showMemory ? "rgba(0,255,136,0.22)" : "#0d1a28"}`,
                borderRadius: 7,
                padding:      "5px 13px",
                color:        showMemory ? "#00ff88" : "#1e3040",
                cursor:       "pointer",
                fontSize:     10,
                fontFamily:   "JetBrains Mono, monospace",
                transition:   "all 0.15s",
              }}
            >
              🧠 Qdrant ({totalPoints} pts)
            </button>
          </div>
        </div>

        {/* ── MESSAGES ───────────────────────────────────────────────────── */}
        <div style={{
          maxWidth:     860,
          margin:       "0 auto",
          padding:      `24px 24px 190px`,
          paddingRight: showMemory ? 344 : 24,
          transition:   "padding-right 0.22s",
        }}>
          {messages.map((msg) => (
            <Message
              key={msg.id}
              msg={msg}
              onDismissClarify={dismissClarify}
            />
          ))}

          {loading && <ThinkingIndicator mode={mode} />}

          {error && (
            <div style={{
              background:   "#0a0608",
              border:       "1px solid rgba(239,68,68,0.25)",
              borderRadius: 8,
              padding:      "11px 16px",
              color:        "#f87171",
              fontSize:     12,
              margin:       "8px 0",
              fontFamily:   "monospace",
            }}>
              ⚠ {error}
            </div>
          )}

          {/* Example queries — shown only on fresh start */}
          {messages.length <= 1 && !loading && (
            <div style={{ marginTop: 24 }}>
              <div style={{
                color:         "#111a25",
                fontSize:      10,
                letterSpacing: "0.12em",
                marginBottom:  10,
              }}>
                EXAMPLE QUERIES
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>
                {EXAMPLE_QUERIES.map((q, i) => (
                  <button
                    key={i}
                    className="example-btn"
                    onClick={() => {
                      setInput(q.label.replace(/^[⚡🔬]\s*/, ""));
                      setMode(q.mode);
                      setTimeout(() => inputRef.current?.focus(), 50);
                    }}
                  >
                    {q.label}
                  </button>
                ))}
              </div>
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>

        {/* ── INPUT BAR ──────────────────────────────────────────────────── */}
        <InputBar
          input={input}
          setInput={setInput}
          onSubmit={handleSubmit}
          onKeyDown={handleKeyDown}
          mode={mode}
          setMode={setMode}
          loading={loading}
          showMemory={showMemory}
          inputRef={inputRef}
          attachedFile={attachedFile}
          setAttachedFile={setAttachedFile}
          fileInputRef={fileInputRef}
          onFileSelect={handleFileSelect}
        />

        {/* ── MEMORY PANEL ───────────────────────────────────────────────── */}
        {showMemory && (
          <MemoryPanel
            memoryStats={memoryStats}
            allPrefs={allPrefs}
            recentHistory={recentHistory}
            onClose={() => setShowMemory(false)}
            onClear={clearMemory}
          />
        )}
      </div>
    </>
  );
}