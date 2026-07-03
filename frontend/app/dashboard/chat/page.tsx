"use client";

import { useState, useEffect, useRef } from "react";
import { useSearchParams } from "next/navigation";
import { getMessages, streamQuery, listDocuments, exportChat } from "@/lib/api";

interface Message {
  id?: string;
  role: "human" | "ai";
  content: string;
  streaming?: boolean;
  source_chunks?: {
    content: string;
    document_name: string;
    score: number;
  }[];
}

export default function ChatPage() {
  const searchParams = useSearchParams();
  const sessionId = searchParams.get("session");

  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [loadingMessages, setLoadingMessages] = useState(false);
  const [documents, setDocuments] = useState<{ id: string; original_name: string }[]>([]);
  const [selectedDocs, setSelectedDocs] = useState<string[]>([]);
  const [showDocFilter, setShowDocFilter] = useState(false);
  const [showExport, setShowExport] = useState(false);
  const [errorToast, setErrorToast] = useState<string | null>(null);
  const [sourcesPanel, setSourcesPanel] = useState<Message | null>(null);

  const messagesContainerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const filterRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    fetchDocs();
  }, []);

  useEffect(() => {
    if (sessionId) loadMessages(sessionId);
    else setMessages([]);
  }, [sessionId]);

  useEffect(() => {
    const container = messagesContainerRef.current;
    if (container) container.scrollTop = container.scrollHeight;
  }, [messages]);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (filterRef.current && !filterRef.current.contains(e.target as Node)) {
        setShowDocFilter(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  async function fetchDocs() {
    const docs = await listDocuments();
    setDocuments(docs.filter((d: any) => d.status === "ready"));
  }

  async function loadMessages(sid: string) {
    setLoadingMessages(true);
    const msgs = await getMessages(sid);
    setMessages(msgs);
    setLoadingMessages(false);
    setTimeout(() => inputRef.current?.focus(), 100);
  }

  async function handleSend() {
    if (!input.trim() || !sessionId || loading) return;

    const question = input.trim();
    setInput("");
    setLoading(true);
    setSourcesPanel(null);

    setMessages((prev) => [...prev, { role: "human", content: question }]);
    setMessages((prev) => [...prev, { role: "ai", content: "", streaming: true }]);

    try {
      await streamQuery(
        sessionId,
        question,
        (token) => {
          setMessages((prev) => {
            if (prev.length === 0) return prev;
            const updated = [...prev];
            const last = updated[updated.length - 1];
            if (last && last.streaming) {
              updated[updated.length - 1] = { ...last, content: last.content + token };
            }
            return updated;
          });
        },
        () => {
          setMessages((prev) => {
            const updated = [...prev];
            updated[updated.length - 1].streaming = false;
            return updated;
          });
          setLoading(false);
          // Reload messages to get source_chunks from DB
          if (sessionId) loadMessages(sessionId);
        },
        (error) => {
          setMessages((prev) => {
            const updated = [...prev];
            updated[updated.length - 1] = {
              role: "ai",
              content: error.includes("Invalid input")
                ? "⚠️ Invalid input detected. Please rephrase your question."
                : error.includes("Too many requests")
                ? "⚠️ Too many requests. Please wait a moment."
                : "Sorry, something went wrong. Please try again.",
              streaming: false,
            };
            return updated;
          });
          setErrorToast(error);
          setTimeout(() => setErrorToast(null), 4000);
          setLoading(false);
        },
        selectedDocs
      );
    } catch (err: any) {
      setMessages((prev) => {
        const updated = [...prev];
        updated[updated.length - 1] = {
          role: "ai",
          content: "Invalid input detected. Please rephrase your question.",
          streaming: false,
        };
        return updated;
      });
      setLoading(false);
    }
  }

  if (!sessionId) {
    return (
      <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", height: "100%" }}>
        <div style={{ textAlign: "center", maxWidth: "380px", padding: "24px" }}>
          <div style={{
            width: "48px", height: "48px", borderRadius: "12px",
            background: "var(--bg-secondary)", border: "1px solid var(--border)",
            display: "flex", alignItems: "center", justifyContent: "center",
            margin: "0 auto 16px"
          }}>
            <svg width="22" height="22" fill="none" viewBox="0 0 24 24" stroke="currentColor" style={{ color: "var(--text-muted)" }}>
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
            </svg>
          </div>
          <h2 style={{ fontSize: "18px", fontWeight: "600", color: "var(--text)", marginBottom: "8px" }}>
            How can I help you?
          </h2>
          <p style={{ fontSize: "13px", color: "var(--text-secondary)", lineHeight: "1.6", marginBottom: "20px" }}>
            Upload documents and start a new chat to ask questions about them.
          </p>
          <p style={{ fontSize: "12px", color: "var(--text-muted)" }}>
            Click <strong style={{ color: "var(--text-secondary)" }}>New Chat</strong> in the sidebar to begin
          </p>
        </div>
      </div>
    );
  }

  return (
    <div style={{ display: "flex", height: "100%", overflow: "hidden", position: "relative" }}>

      {/* ── Main chat area ── */}
      <div style={{
        flex: 1,
        display: "flex",
        flexDirection: "column",
        overflow: "hidden",
        transition: "all 0.3s ease"
      }}>

        {/* Header */}
        <div style={{
          padding: "10px 24px",
          borderBottom: "1px solid var(--border)",
          display: "flex",
          alignItems: "center",
          justifyContent: "flex-end"
        }}>
          <div style={{ position: "relative" }}>
            <button
              onClick={() => setShowExport(!showExport)}
              style={{
                display: "flex", alignItems: "center", gap: "6px",
                padding: "5px 12px", borderRadius: "7px",
                border: "1px solid var(--border)", background: "transparent",
                color: "var(--text-secondary)", fontSize: "12px",
                cursor: "pointer", transition: "all 0.15s"
              }}
              onMouseEnter={e => e.currentTarget.style.background = "var(--hover)"}
              onMouseLeave={e => e.currentTarget.style.background = "transparent"}
            >
              <svg width="13" height="13" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
              </svg>
              Export
            </button>

            {showExport && (
              <>
                <div style={{ position: "fixed", inset: 0, zIndex: 40 }} onClick={() => setShowExport(false)} />
                <div style={{
                  position: "absolute", top: "calc(100% + 6px)", right: 0,
                  background: "var(--bg-secondary)", border: "1px solid var(--border)",
                  borderRadius: "10px", padding: "6px", zIndex: 50,
                  minWidth: "140px", boxShadow: "0 4px 20px rgba(0,0,0,0.15)"
                }}>
                  {(["markdown", "pdf"] as const).map((fmt) => (
                    <button
                      key={fmt}
                      onClick={async () => { setShowExport(false); await exportChat(sessionId!, fmt); }}
                      style={{
                        width: "100%", padding: "7px 10px", borderRadius: "7px",
                        border: "none", background: "transparent", color: "var(--text)",
                        fontSize: "13px", cursor: "pointer", display: "flex",
                        alignItems: "center", gap: "8px", textAlign: "left"
                      }}
                      onMouseEnter={e => e.currentTarget.style.background = "var(--hover)"}
                      onMouseLeave={e => e.currentTarget.style.background = "transparent"}
                    >
                      {fmt === "markdown" ? "📝 Markdown (.md)" : "📄 PDF (.pdf)"}
                    </button>
                  ))}
                </div>
              </>
            )}
          </div>
        </div>

        {/* Messages */}
        <div
          ref={messagesContainerRef}
          style={{ flex: 1, overflowY: "auto", padding: "24px" }}
        >
          <div style={{ maxWidth: "720px", margin: "0 auto" }}>

            {loadingMessages ? (
              <div style={{ textAlign: "center", paddingTop: "60px" }}>
                <div style={{
                  width: "20px", height: "20px",
                  border: "2px solid var(--border)", borderTopColor: "var(--accent)",
                  borderRadius: "50%", animation: "spin 0.8s linear infinite",
                  margin: "0 auto 12px"
                }} />
                <p style={{ fontSize: "13px", color: "var(--text-muted)" }}>Loading messages...</p>
              </div>
            ) : messages.length === 0 ? (
              <div style={{ textAlign: "center", padding: "60px 0" }}>
                <svg width="48" height="48" fill="none" viewBox="0 0 24 24" stroke="currentColor"
                  style={{ color: "var(--border)", margin: "0 auto 16px", display: "block" }}>
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                </svg>
                <p style={{ fontSize: "15px", fontWeight: "600", color: "var(--text)", marginBottom: "6px" }}>No messages yet</p>
                <p style={{ fontSize: "13px", color: "var(--text-muted)" }}>Ask anything about your uploaded documents</p>
              </div>
            ) : null}

            <div style={{ display: "flex", flexDirection: "column", gap: "20px" }}>
              {messages.map((msg, i) => (
                <div key={i}>
                  {msg.role === "human" ? (
                    <div style={{ display: "flex", justifyContent: "flex-end" }}>
                      <div style={{
                        maxWidth: "80%",
                        background: "var(--bg-secondary)",
                        border: "1px solid var(--border)",
                        borderRadius: "16px 16px 4px 16px",
                        padding: "10px 14px",
                        fontSize: "14px", color: "var(--text)", lineHeight: "1.6"
                      }}>
                        {msg.content}
                      </div>
                    </div>
                  ) : (
                    <div style={{ display: "flex", gap: "12px", alignItems: "flex-start" }}>
                      {/* Avatar */}
                      <div style={{
                        width: "28px", height: "28px", borderRadius: "8px",
                        background: "var(--accent)",
                        display: "flex", alignItems: "center", justifyContent: "center",
                        flexShrink: 0, marginTop: "2px"
                      }}>
                        <span style={{ color: "white", fontSize: "11px", fontWeight: "700" }}>D</span>
                      </div>

                      <div style={{ flex: 1 }}>
                        {/* Message content */}
                        <div style={{
                          fontSize: "14px", color: "var(--text)",
                          lineHeight: "1.7", paddingTop: "4px"
                        }}>
                          {msg.content || (
                            <span style={{ display: "flex", gap: "4px", alignItems: "center" }}>
                              {[0, 150, 300].map(delay => (
                                <span key={delay} style={{
                                  width: "6px", height: "6px", borderRadius: "50%",
                                  background: "var(--text-muted)",
                                  animation: `bounce 1s infinite`,
                                  animationDelay: `${delay}ms`
                                }} />
                              ))}
                            </span>
                          )}
                          {msg.streaming && msg.content && (
                            <span style={{
                              display: "inline-block", width: "2px", height: "14px",
                              background: "var(--accent)", marginLeft: "2px",
                              animation: "pulse 1s infinite", borderRadius: "1px",
                              verticalAlign: "middle"
                            }} />
                          )}
                        </div>

                        {/* Sources button */}
                        {!msg.streaming && msg.source_chunks && msg.source_chunks.length > 0 && (
                          <button
                            onClick={() => setSourcesPanel(sourcesPanel === msg ? null : msg)}
                            style={{
                              marginTop: "8px",
                              display: "inline-flex",
                              alignItems: "center",
                              gap: "5px",
                              padding: "4px 10px",
                              borderRadius: "6px",
                              border: `1px solid ${sourcesPanel === msg ? "var(--accent)" : "var(--border)"}`,
                              background: sourcesPanel === msg ? "var(--active)" : "transparent",
                              color: sourcesPanel === msg ? "var(--accent)" : "var(--text-muted)",
                              fontSize: "11px",
                              fontWeight: "500",
                              cursor: "pointer",
                              transition: "all 0.15s"
                            }}
                          >
                            <svg width="11" height="11" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                            </svg>
                            {msg.source_chunks.length} source{msg.source_chunks.length > 1 ? "s" : ""}
                          </button>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
            <div style={{ height: "1px" }} />
          </div>
        </div>

        {/* Input */}
        <div style={{
          padding: "16px 24px 20px",
          borderTop: "1px solid var(--border)",
          background: "var(--bg)"
        }}>
          <div style={{ maxWidth: "720px", margin: "0 auto" }}>

            {/* Document filter */}
            {documents.length > 0 && (
              <div style={{ marginBottom: "10px", position: "relative", display: "inline-block" }} ref={filterRef}>
                <button
                  onClick={() => setShowDocFilter(!showDocFilter)}
                  style={{
                    display: "inline-flex", alignItems: "center", gap: "6px",
                    padding: "5px 12px", borderRadius: "20px",
                    border: `1px solid ${selectedDocs.length > 0 && selectedDocs.length < documents.length ? "var(--accent)" : "var(--border)"}`,
                    background: selectedDocs.length > 0 && selectedDocs.length < documents.length ? "var(--active)" : "transparent",
                    color: selectedDocs.length > 0 && selectedDocs.length < documents.length ? "var(--accent)" : "var(--text-muted)",
                    fontSize: "12px", fontWeight: "500", cursor: "pointer", transition: "all 0.15s"
                  }}
                >
                  <svg width="11" height="11" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2a1 1 0 01-.293.707L13 13.414V19a1 1 0 01-.553.894l-4 2A1 1 0 017 21v-7.586L3.293 6.707A1 1 0 013 6V4z" />
                  </svg>
                  {selectedDocs.length > 0 && selectedDocs.length < documents.length
                    ? `${selectedDocs.length} of ${documents.length} docs`
                    : "All docs"}
                  <svg width="10" height="10" fill="none" viewBox="0 0 24 24" stroke="currentColor"
                    style={{ transform: showDocFilter ? "rotate(180deg)" : "rotate(0)", transition: "transform 0.2s" }}>
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                  </svg>
                </button>

                {showDocFilter && (
                  <div style={{
                    position: "absolute", bottom: "calc(100% + 8px)", left: 0,
                    minWidth: "280px", maxWidth: "400px",
                    background: "var(--bg-secondary)", border: "1px solid var(--border)",
                    borderRadius: "12px", padding: "8px",
                    display: "flex", flexDirection: "column", gap: "2px",
                    maxHeight: "220px", overflowY: "auto",
                    boxShadow: "0 4px 24px rgba(0,0,0,0.15)", zIndex: 10
                  }}>
                    <div style={{
                      display: "flex", justifyContent: "space-between",
                      alignItems: "center", padding: "4px 8px", marginBottom: "4px"
                    }}>
                      <span style={{ fontSize: "11px", fontWeight: "600", color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.05em" }}>
                        Search in
                      </span>
                      {selectedDocs.length > 0 && selectedDocs.length < documents.length && (
                        <button
                          onClick={() => setSelectedDocs([])}
                          style={{ fontSize: "11px", color: "var(--accent)", border: "none", background: "transparent", cursor: "pointer" }}
                        >
                          Clear
                        </button>
                      )}
                    </div>

                    {/* All docs */}
                    <div
                      onClick={() => setSelectedDocs(
                        selectedDocs.length === documents.length ? [] : documents.map(d => d.id)
                      )}
                      style={{
                        display: "flex", alignItems: "center", gap: "8px",
                        padding: "6px 8px", borderRadius: "7px", cursor: "pointer",
                        background: selectedDocs.length === documents.length || selectedDocs.length === 0 ? "var(--active)" : "transparent"
                      }}
                    >
                      <div style={{
                        width: "14px", height: "14px", borderRadius: "3px", flexShrink: 0,
                        border: `2px solid ${selectedDocs.length === documents.length || selectedDocs.length === 0 ? "var(--accent)" : "var(--border)"}`,
                        background: selectedDocs.length === documents.length || selectedDocs.length === 0 ? "var(--accent)" : "transparent",
                        display: "flex", alignItems: "center", justifyContent: "center"
                      }}>
                        {(selectedDocs.length === documents.length || selectedDocs.length === 0) && (
                          <svg width="8" height="8" viewBox="0 0 24 24" fill="none">
                            <path d="M20 6L9 17l-5-5" stroke="white" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
                          </svg>
                        )}
                      </div>
                      <span style={{ fontSize: "12px", color: "var(--text)", fontWeight: "500" }}>All documents</span>
                    </div>

                    {/* Individual docs */}
                    {documents.map(doc => {
                      const isSelected = selectedDocs.includes(doc.id);
                      return (
                        <div
                          key={doc.id}
                          onClick={() => setSelectedDocs(prev =>
                            isSelected ? prev.filter(id => id !== doc.id) : [...prev, doc.id]
                          )}
                          style={{
                            display: "flex", alignItems: "center", gap: "8px",
                            padding: "6px 8px", borderRadius: "7px", cursor: "pointer",
                            background: isSelected ? "var(--active)" : "transparent"
                          }}
                        >
                          <div style={{
                            width: "14px", height: "14px", borderRadius: "3px", flexShrink: 0,
                            border: `2px solid ${isSelected ? "var(--accent)" : "var(--border)"}`,
                            background: isSelected ? "var(--accent)" : "transparent",
                            display: "flex", alignItems: "center", justifyContent: "center"
                          }}>
                            {isSelected && (
                              <svg width="8" height="8" viewBox="0 0 24 24" fill="none">
                                <path d="M20 6L9 17l-5-5" stroke="white" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
                              </svg>
                            )}
                          </div>
                          <span style={{
                            fontSize: "12px", color: "var(--text)",
                            overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
                            fontWeight: isSelected ? "500" : "400", maxWidth: "280px"
                          }}>
                            {doc.original_name.length > 35 ? doc.original_name.substring(0, 35) + "..." : doc.original_name}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            )}

            {/* Input box */}
            <div style={{
              display: "flex", gap: "10px", alignItems: "flex-end",
              background: "var(--bg-secondary)", border: "1px solid var(--border)",
              borderRadius: "12px", padding: "10px 12px"
            }}>
              <textarea
                ref={inputRef}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleSend(); }
                }}
                placeholder="Ask about your documents..."
                disabled={loading}
                rows={1}
                style={{
                  flex: 1, background: "transparent", border: "none", outline: "none",
                  resize: "none", fontSize: "14px", color: "var(--text)",
                  lineHeight: "1.5", minHeight: "24px", maxHeight: "120px",
                  fontFamily: "inherit"
                }}
              />
              <button
                onClick={handleSend}
                disabled={loading || !input.trim()}
                style={{
                  width: "32px", height: "32px", borderRadius: "8px", border: "none",
                  background: input.trim() && !loading ? "var(--accent)" : "var(--bg-tertiary)",
                  color: input.trim() && !loading ? "white" : "var(--text-muted)",
                  cursor: input.trim() && !loading ? "pointer" : "not-allowed",
                  display: "flex", alignItems: "center", justifyContent: "center",
                  flexShrink: 0, transition: "all 0.15s"
                }}
              >
                {loading ? (
                  <div style={{
                    width: "14px", height: "14px",
                    border: "2px solid currentColor", borderTopColor: "transparent",
                    borderRadius: "50%", animation: "spin 0.8s linear infinite"
                  }} />
                ) : (
                  <svg width="14" height="14" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
                  </svg>
                )}
              </button>
            </div>
            <p style={{ fontSize: "11px", color: "var(--text-muted)", textAlign: "center", marginTop: "8px" }}>
              Enter to send · Shift+Enter for new line
            </p>
          </div>
        </div>
      </div>

      {/* ── Sources Panel ── */}
      {sourcesPanel && (
        <div style={{
          width: "320px",
          flexShrink: 0,
          borderLeft: "1px solid var(--border)",
          background: "var(--bg-secondary)",
          display: "flex",
          flexDirection: "column",
          overflow: "hidden",
          animation: "slideIn 0.2s ease"
        }}>
          {/* Panel header */}
          <div style={{
            padding: "14px 16px",
            borderBottom: "1px solid var(--border)",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between"
          }}>
            <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
              <svg width="14" height="14" fill="none" viewBox="0 0 24 24" stroke="currentColor" style={{ color: "var(--accent)" }}>
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
              <span style={{ fontSize: "13px", fontWeight: "600", color: "var(--text)" }}>
                Sources
              </span>
              <span style={{
                fontSize: "11px", color: "var(--text-muted)",
                background: "var(--bg-tertiary)", border: "1px solid var(--border)",
                borderRadius: "10px", padding: "1px 6px"
              }}>
                {sourcesPanel.source_chunks?.length}
              </span>
            </div>
            <button
              onClick={() => setSourcesPanel(null)}
              style={{
                width: "24px", height: "24px", borderRadius: "6px",
                border: "none", background: "transparent",
                color: "var(--text-muted)", cursor: "pointer",
                display: "flex", alignItems: "center", justifyContent: "center"
              }}
              onMouseEnter={e => e.currentTarget.style.background = "var(--hover)"}
              onMouseLeave={e => e.currentTarget.style.background = "transparent"}
            >
              <svg width="13" height="13" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          {/* Sources list */}
          <div style={{ flex: 1, overflowY: "auto", padding: "12px" }}>
            <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
              {sourcesPanel.source_chunks?.map((chunk, idx) => (
                <div
                  key={idx}
                  style={{
                    padding: "12px",
                    borderRadius: "10px",
                    border: "1px solid var(--border)",
                    background: "var(--bg)",
                  }}
                >
                  {/* Source header */}
                  <div style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    marginBottom: "8px"
                  }}>
                    <div style={{
                      display: "flex", alignItems: "center", gap: "6px",
                      flex: 1, minWidth: 0
                    }}>
                      <svg width="12" height="12" fill="none" viewBox="0 0 24 24" stroke="currentColor" style={{ color: "var(--accent)", flexShrink: 0 }}>
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                      </svg>
                      <span style={{
                        fontSize: "11px", fontWeight: "600", color: "var(--text)",
                        overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap"
                      }}>
                        {chunk.document_name}
                      </span>
                    </div>
                    <span style={{
                      fontSize: "10px", color: "var(--accent)",
                      background: "var(--active)", border: "1px solid var(--accent)",
                      borderRadius: "10px", padding: "1px 6px",
                      flexShrink: 0, marginLeft: "6px"
                    }}>
                      {Math.round(chunk.score * 100)}%
                    </span>
                  </div>

                  {/* Source content */}
                  <p style={{
                    fontSize: "12px", color: "var(--text-secondary)",
                    lineHeight: "1.6", margin: 0
                  }}>
                    {chunk.content}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Error toast */}
      {errorToast && (
        <div style={{
          position: "fixed", bottom: "20px", right: "20px",
          padding: "10px 16px", borderRadius: "10px",
          border: "1px solid rgba(239,68,68,0.2)",
          background: "rgba(239,68,68,0.08)", color: "#ef4444",
          fontSize: "13px", fontWeight: "500", zIndex: 50,
          display: "flex", alignItems: "center", gap: "8px"
        }}>
          ⚠️ {errorToast}
        </div>
      )}

      <style>{`
        @keyframes bounce {
          0%, 100% { transform: translateY(0); }
          50% { transform: translateY(-4px); }
        }
        @keyframes pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0; }
        }
        @keyframes spin {
          to { transform: rotate(360deg); }
        }
        @keyframes slideIn {
          from { transform: translateX(100%); opacity: 0; }
          to { transform: translateX(0); opacity: 1; }
        }
      `}</style>
    </div>
  );
}