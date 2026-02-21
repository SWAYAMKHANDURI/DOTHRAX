/**
 * useResearch.js — Full pipeline with PDF upload, clarification flow, citation extraction.
 *
 * Pipeline:
 *   1. PDF/file processing (if attached)
 *   2. Qdrant semantic retrieval
 *   3. Clarification gate — PAUSES if needsClarification=true, shows questions in UI
 *   4. Research generation (memory-enriched, with paper context if uploaded)
 *   5. Cost + latency accounting
 *   6. Citation extraction (async, non-blocking)
 *   7. Memory write-back (async, non-blocking)
 */

import { useState, useEffect, useRef, useCallback } from "react";
import { estimateCost } from "../lib/cost.js";
import { callClaude, callClaudeJSON } from "../lib/api.js";
import {
  QUICK_SYSTEM, DEEP_SYSTEM, CLARIFY_SYSTEM,
  MEMORY_EXTRACT_SYSTEM, CITATION_EXTRACT_SYSTEM
} from "../lib/prompts.js";
import {
  initMemory, retrieveContext, formatContextForPrompt,
  storeResearch, storePreference, storeInsight, storeConversationTurn,
  getAllPreferences, getRecentHistory, getMemoryStats, clearAllMemory,
} from "../lib/vectorMemory.js";

const DEEP_KEYWORDS = ["deep", "comprehensive", "compare", "comparison", "tradeoff", "versus", " vs ", "architecture", "internals", "under the hood", "survey"];

const WELCOME_MESSAGE = {
  role: "assistant", id: "welcome", mode: "quick",
  content: `# Deep Research Agent

**Quick Mode** ⚡ — high-signal answer in <30s
**Deep Mode** 🔬 — multi-source synthesis with citations in <3min

**Capabilities:**
- Upload PDFs / research papers — I'll read and synthesize them
- Semantic memory across sessions (Qdrant)
- Clarifying questions for ambiguous queries
- Citation extraction with arxiv links
- Follow-up refinements — just keep chatting

What are you researching?`,
};

export const EXAMPLE_QUERIES = [
  { label: "⚡ Quick overview of LLM hallucination reduction", mode: "quick" },
  { label: "🔬 Deep dive: RAG chunking strategies with tradeoffs", mode: "deep" },
  { label: "🔬 Compare LoRA vs full fine-tuning vs prompt tuning with numbers", mode: "deep" },
  { label: "⚡ Remember I prefer Python. Explain attention mechanisms", mode: "quick" },
  { label: "🔬 Production vector DB: Qdrant vs Pinecone vs Weaviate", mode: "deep" },
];

// ── PDF / file helpers ────────────────────────────────────────────────────

const readFileAsBase64 = (file) => new Promise((resolve, reject) => {
  const reader = new FileReader();
  reader.onload = () => resolve(reader.result.split(",")[1]);
  reader.onerror = () => reject(new Error("File read failed"));
  reader.readAsDataURL(file);
});

const buildMessagesWithFile = async (history, query, file) => {
  if (!file) return history;

  const base64 = await readFileAsBase64(file);
  const isPDF  = file.type === "application/pdf";

  // Replace the last user message with a multi-part message including the document
  const withoutLast = history.slice(0, -1);
  return [
    ...withoutLast,
    {
      role: "user",
      content: [
        isPDF
          ? { type: "document", source: { type: "base64", media_type: "application/pdf", data: base64 } }
          : { type: "image",    source: { type: "base64", media_type: file.type, data: base64 } },
        { type: "text", text: query || "Please analyze this document and provide a technical summary." },
      ],
    },
  ];
};

export function useResearch() {
  const [messages, setMessages]         = useState([WELCOME_MESSAGE]);
  const [input, setInput]               = useState("");
  const [mode, setMode]                 = useState("quick");
  const [loading, setLoading]           = useState(false);
  const [attachedFile, setAttachedFile] = useState(null);   // File object
  const [memoryStats, setMemoryStats]   = useState([]);
  const [allPrefs, setAllPrefs]         = useState([]);
  const [recentHistory, setRecentHistory] = useState([]);
  const [showMemory, setShowMemory]     = useState(false);
  const [error, setError]               = useState(null);
  const [totalCost, setTotalCost]       = useState(0);
  const [memoryReady, setMemoryReady]   = useState(false);
  // Clarification state
  const [pendingQuery, setPendingQuery] = useState(null);   // paused query
  const [pendingMode, setPendingMode]   = useState(null);
  const [clarifyQs, setClarifyQs]       = useState([]);     // questions to show
  const messagesEndRef = useRef(null);
  const inputRef       = useRef(null);
  const fileInputRef   = useRef(null);

  useEffect(() => {
    (async () => {
      await initMemory();
      await refreshMemoryUI();
      setMemoryReady(true);
    })();
  }, []);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, loading]);

  const refreshMemoryUI = async () => {
    const [stats, prefs, history] = await Promise.all([
      getMemoryStats(), getAllPreferences(), getRecentHistory(20),
    ]);
    setMemoryStats(stats); setAllPrefs(prefs); setRecentHistory(history);
  };

  // ── Async: extract citations from deep response ──────────────────────────
  const extractCitations = useCallback(async (responseText, msgId) => {
    try {
      const { data } = await callClaudeJSON([{
        role: "user",
        content: `Extract citations from:\n\n${responseText.slice(0, 2000)}`,
      }], CITATION_EXTRACT_SYSTEM, 600);

      if (data.citations?.length) {
        setMessages(prev => prev.map(m =>
          m.id === msgId ? { ...m, citations: data.citations } : m
        ));
      }
    } catch (e) {
      console.warn("[Citations] Extraction failed:", e);
    }
  }, []);

  // ── Async: write-back memory ─────────────────────────────────────────────
  const writeBackMemory = useCallback(async (query, responseText, detectedMode) => {
    try {
      const { data } = await callClaudeJSON([{
        role: "user",
        content: `Query: "${query}"\nResponse (first 800 chars): "${responseText.slice(0, 800)}"`,
      }], MEMORY_EXTRACT_SYSTEM, 400);

      await Promise.all([
        ...(data.preferences || []).map(p => storePreference(p)),
        ...(data.insights    || []).map(i => storeInsight({ ...i, sourceQuery: query })),
        storeResearch({ query, summary: data.summary || "", mode: detectedMode, tags: data.tags || [], responsePreview: responseText.slice(0, 400) }),
        storeConversationTurn({ userMessage: query, assistantMessage: responseText, mode: detectedMode }),
      ]);
      await refreshMemoryUI();
    } catch (e) {
      console.warn("[Memory] Write-back failed:", e);
    }
  }, []);

  // ── Core research execution (called after clarification resolved) ────────
  const executeResearch = useCallback(async (query, finalMode, file = null, clarificationContext = "") => {
    setLoading(true);
    const startTime = Date.now();

    try {
      // Step 1: Qdrant retrieval
      const memCtx = await retrieveContext(query, { limit: 4, minScore: 0.2 });
      const memoryContextStr = formatContextForPrompt(memCtx);

      // Step 2: Build conversation history
      let history = messages
        .filter(m => m.id !== "welcome" && m.role !== "system" && !m.isClarify)
        .slice(-8)
        .map(m => ({ role: m.role === "assistant" ? "assistant" : "user", content: m.content }));

      const queryWithContext = clarificationContext
        ? `${query}\n\n[Clarification provided: ${clarificationContext}]`
        : query;

      history.push({ role: "user", content: queryWithContext });

      // Step 3: Attach file if present
      if (file) {
        history = await buildMessagesWithFile(history, queryWithContext, file);
      }

      // Step 4: Generate research response
      const fileNote = file ? `\n\n[User has uploaded: ${file.name} (${(file.size/1024).toFixed(1)}KB) — analyse it as a primary source.]` : "";
      const system   = finalMode === "deep"
        ? DEEP_SYSTEM(memoryContextStr) + fileNote
        : QUICK_SYSTEM(memoryContextStr) + fileNote;
      const maxTokens = finalMode === "deep" ? 3000 : 1500;

      const { text, usage } = await callClaude(history, system, maxTokens);

      const latency = Date.now() - startTime;
      const cost    = estimateCost(usage.input_tokens, usage.output_tokens);
      setTotalCost(prev => prev + cost.total);

      const memHints = {
        similarResearch:      memCtx.similarResearch.length,
        relevantPrefs:        memCtx.relevantPrefs.length,
        relevantInsights:     memCtx.relevantInsights.length,
        relatedConversations: memCtx.relatedConversations.length,
      };

      const msgId = Date.now();
      setMessages(prev => [...prev, {
        role: "assistant", content: text,
        mode: finalMode, cost, latency, memHints,
        fileAttached: file?.name || null,
        id: msgId,
      }]);

      // Step 5: Async non-blocking post-processing
      if (finalMode === "deep") extractCitations(text, msgId);
      writeBackMemory(query, text, finalMode);
      setAttachedFile(null);

    } catch (err) {
      setError(err.message);
      setMessages(prev => [...prev, {
        role: "assistant",
        content: `⚠️ **Research failed**\n\n\`${err.message}\`\n\nPlease try again.`,
        mode: "system", id: Date.now(),
      }]);
    } finally {
      setLoading(false);
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  }, [messages, extractCitations, writeBackMemory]);

  // ── Main submit handler ─────────────────────────────────────────────────
  const handleSubmit = useCallback(async () => {
    const query = input.trim();
    if (!query || loading) return;

    setInput("");
    setError(null);

    // If we're answering a clarification, resume with context
    if (clarifyQs.length > 0 && pendingQuery) {
      setClarifyQs([]);
      setMessages(prev => [...prev, { role: "user", content: query, id: Date.now() }]);
      await executeResearch(pendingQuery, pendingMode, attachedFile, query);
      setPendingQuery(null); setPendingMode(null);
      return;
    }

    // Normal flow
    let finalMode = mode;
    if (DEEP_KEYWORDS.some(kw => query.toLowerCase().includes(kw))) finalMode = "deep";

    setMessages(prev => [
      ...prev,
      { role: "user", content: query, id: Date.now(), fileAttached: attachedFile?.name },
    ]);

    // Clarification check
    try {
      const { data: clarify } = await callClaudeJSON([{
        role: "user", content: `Query: "${query}"\nMode: ${finalMode}`,
      }], CLARIFY_SYSTEM, 200);

      if (clarify.suggestedMode && !DEEP_KEYWORDS.some(kw => query.toLowerCase().includes(kw))) {
        finalMode = clarify.suggestedMode;
      }

      // ✓ NOW ACTUALLY HANDLE needsClarification
      if (clarify.needsClarification && clarify.questions?.length > 0) {
        setPendingQuery(query);
        setPendingMode(finalMode);
        setClarifyQs(clarify.questions);
        setMessages(prev => [...prev, {
          role: "assistant",
          content: "To give you the most targeted answer, a quick question:",
          isClarify: true,
          clarifyQuestions: clarify.questions,
          id: Date.now(),
          mode: "quick",
        }]);
        setLoading(false);
        return;
      }
    } catch { /* non-critical */ }

    await executeResearch(query, finalMode, attachedFile);
  }, [input, loading, mode, clarifyQs, pendingQuery, pendingMode, attachedFile, executeResearch]);

  const handleKeyDown = useCallback((e) => {
    if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleSubmit(); }
  }, [handleSubmit]);

  const handleFileSelect = useCallback((e) => {
    const file = e.target.files?.[0];
    if (file) setAttachedFile(file);
    e.target.value = "";
  }, []);

  const clearMemory = useCallback(async () => {
    await clearAllMemory(); await initMemory(); await refreshMemoryUI(); setTotalCost(0);
  }, []);

  const dismissClarify = useCallback(() => {
    setClarifyQs([]); setPendingQuery(null); setPendingMode(null);
  }, []);

  return {
    messages, input, setInput,
    mode, setMode, loading, memoryReady,
    attachedFile, setAttachedFile, fileInputRef, handleFileSelect,
    memoryStats, allPrefs, recentHistory,
    showMemory, setShowMemory,
    error, totalCost,
    clarifyQs, dismissClarify,
    messagesEndRef, inputRef,
    handleSubmit, handleKeyDown, clearMemory,
  };
}