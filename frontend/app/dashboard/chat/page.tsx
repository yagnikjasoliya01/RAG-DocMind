"use client";

import { useState, useEffect, useRef } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import {
  getMessages,
  streamQuery,
  listDocuments,
} from "@/lib/api";

interface Message {
  id?: string;
  role: "human" | "ai";
  content: string;
  streaming?: boolean;
}

export default function ChatPage() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const sessionId = searchParams.get("session");

  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [documents, setDocuments] = useState<{ id: string, original_name: string }[]>([]);
  const [selectedDocs, setSelectedDocs] = useState<string[]>([]);
  const [showDocFilter, setShowDocFilter] = useState(false);

  const filterRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (filterRef.current && !filterRef.current.contains(e.target as Node)) {
        setShowDocFilter(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const messagesContainerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    fetchDocs();
  }, []);

  async function fetchDocs() {
    const docs = await listDocuments();
    setDocuments(docs.filter((d: any) => d.status === "ready"));
  }

  useEffect(() => {
    if (sessionId) {
      loadMessages(sessionId);
    } else {
      setMessages([]);
    }
  }, [sessionId]);

  useEffect(() => {
    const container = messagesContainerRef.current;
    if (container) {
      container.scrollTop = container.scrollHeight;
    }
  }, [messages]);

  async function loadMessages(sid: string) {
    const msgs = await getMessages(sid);
    setMessages(msgs);
    setTimeout(() => inputRef.current?.focus(), 100);
  }

  async function handleSend() {
    if (!input.trim() || !sessionId || loading) return;

    const question = input.trim();
    setInput("");
    setLoading(true);

    setMessages((prev) => [...prev, { role: "human", content: question }]);
    setMessages((prev) => [...prev, { role: "ai", content: "", streaming: true }]);

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
      },
      (error) => {
        setMessages((prev) => {
          const updated = [...prev];
          updated[updated.length - 1] = {
            role: "ai",
            content: `Sorry, something went wrong: ${error}`,
            streaming: false,
          };
          return updated;
        });
        setLoading(false);
      },
      selectedDocs
    );
  }

  if (!sessionId) {
    return (
      <div style={{
        flex: 1,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        height: "100%"
      }}>
        <div style={{ textAlign: "center", maxWidth: "380px", padding: "24px" }}>
          <div style={{
            width: "48px", height: "48px",
            borderRadius: "12px",
            background: "var(--bg-secondary)",
            border: "1px solid var(--border)",
            display: "flex", alignItems: "center", justifyContent: "center",
            margin: "0 auto 16px"
          }}>
            <svg width="22" height="22" fill="none" viewBox="0 0 24 24" stroke="currentColor" style={{ color: "var(--text-muted)" }}>
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
            </svg>
          </div>
          <h2 style={{
            fontSize: "18px",
            fontWeight: "600",
            color: "var(--text)",
            marginBottom: "8px"
          }}>
            How can I help you?
          </h2>
          <p style={{
            fontSize: "13px",
            color: "var(--text-secondary)",
            lineHeight: "1.6",
            marginBottom: "20px"
          }}>
            Upload documents and start a new chat to ask questions about them.
          </p>
          <p style={{
            fontSize: "12px",
            color: "var(--text-muted)"
          }}>
            Click <strong style={{ color: "var(--text-secondary)" }}>New Chat</strong> in the sidebar to begin
          </p>
        </div>
      </div>
    );
  }

  return (
    <div style={{
      display: "flex",
      flexDirection: "column",
      height: "100%",
      overflow: "hidden"
    }}>

      {/* Messages */}
      <div
        ref={messagesContainerRef}
        style={{
          flex: 1,
          overflowY: "auto",
          padding: "24px",
        }}
      >
        <div style={{ maxWidth: "720px", margin: "0 auto" }}>

          {messages.length === 0 && (
            <div style={{ textAlign: "center", paddingTop: "60px" }}>
              <div style={{ textAlign: "center", padding: "60px 0" }}>
                <svg width="48" height="48" fill="none" viewBox="0 0 24 24" stroke="currentColor"
                  style={{ color: "var(--border)", margin: "0 auto 16px", display: "block" }}>
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                </svg>
                <p style={{ fontSize: "15px", fontWeight: "600", color: "var(--text)", marginBottom: "6px" }}>
                  No messages yet
                </p>
                <p style={{ fontSize: "13px", color: "var(--text-muted)" }}>
                  Ask anything about your uploaded documents
                </p>
              </div>
            </div>
          )}

          <div style={{ display: "flex", flexDirection: "column", gap: "20px" }}>
            {messages.map((msg, i) => (
              <div key={i}>
                {msg.role === "human" ? (
                  /* Human message */
                  <div style={{ display: "flex", justifyContent: "flex-end" }}>
                    <div style={{
                      maxWidth: "80%",
                      background: "var(--bg-secondary)",
                      border: "1px solid var(--border)",
                      borderRadius: "16px 16px 4px 16px",
                      padding: "10px 14px",
                      fontSize: "14px",
                      color: "var(--text)",
                      lineHeight: "1.6"
                    }}>
                      {msg.content}
                    </div>
                  </div>
                ) : (
                  /* AI message */
                  <div style={{ display: "flex", gap: "12px", alignItems: "flex-start" }}>
                    <div style={{
                      width: "28px", height: "28px",
                      borderRadius: "8px",
                      background: "var(--accent)",
                      display: "flex", alignItems: "center", justifyContent: "center",
                      flexShrink: 0,
                      marginTop: "2px"
                    }}>
                      <span style={{ color: "white", fontSize: "11px", fontWeight: "700" }}>D</span>
                    </div>
                    <div style={{
                      flex: 1,
                      fontSize: "14px",
                      color: "var(--text)",
                      lineHeight: "1.7",
                      paddingTop: "4px"
                    }}>
                      {msg.content || (
                        <span style={{ display: "flex", gap: "4px", alignItems: "center" }}>
                          <span style={{
                            width: "6px", height: "6px",
                            borderRadius: "50%",
                            background: "var(--text-muted)",
                            animation: "bounce 1s infinite",
                            animationDelay: "0ms"
                          }} />
                          <span style={{
                            width: "6px", height: "6px",
                            borderRadius: "50%",
                            background: "var(--text-muted)",
                            animation: "bounce 1s infinite",
                            animationDelay: "150ms"
                          }} />
                          <span style={{
                            width: "6px", height: "6px",
                            borderRadius: "50%",
                            background: "var(--text-muted)",
                            animation: "bounce 1s infinite",
                            animationDelay: "300ms"
                          }} />
                        </span>
                      )}
                      {msg.streaming && msg.content && (
                        <span style={{
                          display: "inline-block",
                          width: "2px", height: "14px",
                          background: "var(--accent)",
                          marginLeft: "2px",
                          animation: "pulse 1s infinite",
                          borderRadius: "1px",
                          verticalAlign: "middle"
                        }} />
                      )}
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
          <div ref={messagesEndRef} />
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
            <div ref={filterRef} style={{ marginBottom: "10px", position: "relative", display: "inline-block" }}>              <button
              onClick={() => setShowDocFilter(!showDocFilter)}
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: "6px",
                padding: "5px 12px",
                borderRadius: "20px",
                border: `1px solid ${selectedDocs.length > 0 ? "var(--accent)" : "var(--border)"}`,
                background: selectedDocs.length > 0 ? "var(--active)" : "transparent",
                color: selectedDocs.length > 0 ? "var(--accent)" : "var(--text-muted)",
                fontSize: "12px",
                fontWeight: "500",
                cursor: "pointer",
                transition: "all 0.15s"
              }}
            >
              <svg width="11" height="11" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2a1 1 0 01-.293.707L13 13.414V19a1 1 0 01-.553.894l-4 2A1 1 0 017 21v-7.586L3.293 6.707A1 1 0 013 6V4z" />
              </svg>
              {selectedDocs.length === 0 || selectedDocs.length === documents.length
                ? "All docs"
                : `${selectedDocs.length} of ${documents.length} docs`}                <svg
                  width="10" height="10" fill="none" viewBox="0 0 24 24" stroke="currentColor"
                  style={{ transform: showDocFilter ? "rotate(180deg)" : "rotate(0)", transition: "transform 0.2s" }}
                >
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
              </svg>
            </button>

              {/* Filter dropdown */}
              {showDocFilter && (
                <div style={{
                  position: "absolute",
                  bottom: "calc(100% + 8px)",
                  left: 0,
                  minWidth: "280px",
                  maxWidth: "400px",
                  background: "var(--bg-secondary)",
                  border: "1px solid var(--border)",
                  borderRadius: "12px",
                  padding: "8px",
                  display: "flex",
                  flexDirection: "column",
                  gap: "2px",
                  maxHeight: "220px",
                  overflowY: "auto",
                  boxShadow: "0 4px 24px rgba(0,0,0,0.15)",
                  zIndex: 10
                }}>
                  <div style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    padding: "4px 8px",
                    marginBottom: "4px"
                  }}>
                    <span style={{ fontSize: "11px", fontWeight: "600", color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.05em" }}>
                      Search in
                    </span>
                    {selectedDocs.length > 0 && (
                      <button
                        onClick={() => setSelectedDocs([])}
                        style={{
                          fontSize: "11px",
                          color: "var(--accent)",
                          border: "none",
                          background: "transparent",
                          cursor: "pointer"
                        }}
                      >
                        Clear all
                      </button>
                    )}
                  </div>

                  {/* All documents option */}
                  <div
                    onClick={() => {
                      if (selectedDocs.length === documents.length) {
                        setSelectedDocs([]);
                      } else {
                        setSelectedDocs(documents.map(d => d.id));
                      }
                    }}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: "8px",
                      padding: "6px 8px",
                      borderRadius: "7px",
                      cursor: "pointer",
                      background: selectedDocs.length === documents.length ? "var(--active)" : "transparent", transition: "all 0.15s"
                    }}
                  >
                    <div style={{
                      width: "14px", height: "14px",
                      borderRadius: "3px",
                      border: `2px solid ${selectedDocs.length === documents.length ? "var(--accent)" : "var(--border)"}`,
                      background: selectedDocs.length === documents.length ? "var(--accent)" : "transparent",
                      display: "flex", alignItems: "center", justifyContent: "center",
                      flexShrink: 0
                    }}>
                      {selectedDocs.length === documents.length && (
                        <svg width="8" height="8" fill="white" viewBox="0 0 24 24">
                          <path d="M20 6L9 17l-5-5" stroke="white" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" fill="none" />
                        </svg>
                      )}
                    </div>
                    <span style={{ fontSize: "12px", color: "var(--text)", fontWeight: selectedDocs.length === 0 ? "500" : "400" }}>
                      All documents
                    </span>
                  </div>

                  {/* Individual documents */}
                  {documents.map(doc => {
                    const isSelected = selectedDocs.includes(doc.id);
                    return (
                      <div
                        key={doc.id}
                        onClick={() => {
                          setSelectedDocs(prev =>
                            isSelected
                              ? prev.filter(id => id !== doc.id)
                              : [...prev, doc.id]
                          );
                        }}
                        style={{
                          display: "flex",
                          alignItems: "center",
                          gap: "8px",
                          padding: "6px 8px",
                          borderRadius: "7px",
                          cursor: "pointer",
                          background: isSelected ? "var(--active)" : "transparent",
                          transition: "all 0.15s"
                        }}
                      >
                        <div style={{
                          width: "14px", height: "14px",
                          borderRadius: "3px",
                          border: `2px solid ${isSelected ? "var(--accent)" : "var(--border)"}`,
                          background: isSelected ? "var(--accent)" : "transparent",
                          display: "flex", alignItems: "center", justifyContent: "center",
                          flexShrink: 0
                        }}>
                          {isSelected && (
                            <svg width="8" height="8" viewBox="0 0 24 24" fill="none">
                              <path d="M20 6L9 17l-5-5" stroke="white" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
                            </svg>
                          )}
                        </div>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <span style={{
                            fontSize: "12px",
                            color: "var(--text)",
                            display: "block",
                            overflow: "hidden",
                            textOverflow: "ellipsis",
                            whiteSpace: "nowrap",
                            fontWeight: isSelected ? "500" : "400",
                            maxWidth: "280px"
                          }}>
                            {doc.original_name.length > 35
                              ? doc.original_name.substring(0, 35) + "..."
                              : doc.original_name}
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}
        </div>
        <div style={{ maxWidth: "720px", margin: "0 auto" }}>
          <div style={{
            display: "flex",
            gap: "10px",
            alignItems: "flex-end",
            background: "var(--bg-secondary)",
            border: "1px solid var(--border)",
            borderRadius: "12px",
            padding: "10px 12px",
          }}>
            <textarea
              ref={inputRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  handleSend();
                }
              }}
              placeholder="Ask about your documents..."
              disabled={loading}
              rows={1}
              style={{
                flex: 1,
                background: "transparent",
                border: "none",
                outline: "none",
                resize: "none",
                fontSize: "14px",
                color: "var(--text)",
                lineHeight: "1.5",
                minHeight: "24px",
                maxHeight: "120px",
                fontFamily: "inherit",
              }}
            />
            <button
              onClick={handleSend}
              disabled={loading || !input.trim()}
              style={{
                width: "32px", height: "32px",
                borderRadius: "8px",
                border: "none",
                background: input.trim() && !loading ? "var(--accent)" : "var(--bg-tertiary)",
                color: input.trim() && !loading ? "white" : "var(--text-muted)",
                cursor: input.trim() && !loading ? "pointer" : "not-allowed",
                display: "flex", alignItems: "center", justifyContent: "center",
                flexShrink: 0,
                transition: "all 0.15s"
              }}
            >
              {loading ? (
                <div style={{
                  width: "14px", height: "14px",
                  border: "2px solid currentColor",
                  borderTopColor: "transparent",
                  borderRadius: "50%",
                  animation: "spin 0.8s linear infinite"
                }} />
              ) : (
                <svg width="14" height="14" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
                </svg>
              )}
            </button>
          </div>
          <p style={{
            fontSize: "11px",
            color: "var(--text-muted)",
            textAlign: "center",
            marginTop: "8px"
          }}>
            Enter to send · Shift+Enter for new line
          </p>
        </div>
      </div>

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
      `}</style>

    </div>
  );
}