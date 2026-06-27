"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { getMessages, streamQuery } from "@/lib/api";

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
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const messagesContainerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

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
      }
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
              <p style={{ fontSize: "13px", color: "var(--text-muted)" }}>
                Ask anything about your uploaded documents
              </p>
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