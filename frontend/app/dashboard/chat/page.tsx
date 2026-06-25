"use client";

import { useState, useEffect, useRef } from "react";
import {
  createSession,
  listSessions,
  getMessages,
  deleteSession,
  streamQuery,
} from "@/lib/api";

interface Session {
  id: string;
  title: string;
  updated_at: string;
}

interface Message {
  id?: string;
  role: "human" | "ai";
  content: string;
  streaming?: boolean;
}

export default function ChatPage() {
  const [sessions, setSessions] = useState<Session[]>([]);
  const [activeSession, setActiveSession] = useState<string | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    fetchSessions();
  }, []);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  async function fetchSessions() {
    const data = await listSessions();
    setSessions(data);
  }

  async function handleNewSession() {
    const session = await createSession("New Chat");
    setSessions((prev) => [session, ...prev]);
    setActiveSession(session.id);
    setMessages([]);
  }

  async function handleSelectSession(sessionId: string) {
    setActiveSession(sessionId);
    const msgs = await getMessages(sessionId);
    setMessages(msgs);
  }

  async function handleDeleteSession(sessionId: string) {
    await deleteSession(sessionId);
    setSessions((prev) => prev.filter((s) => s.id !== sessionId));
    if (activeSession === sessionId) {
      setActiveSession(null);
      setMessages([]);
    }
  }

  async function handleSend() {
    if (!input.trim() || !activeSession || loading) return;

    const question = input.trim();
    setInput("");
    setLoading(true);

    // Add human message
    setMessages((prev) => [...prev, { role: "human", content: question }]);

    // Add empty AI message for streaming
    setMessages((prev) => [
      ...prev,
      { role: "ai", content: "", streaming: true },
    ]);

    await streamQuery(
      activeSession,
      question,
      (token) => {
        setMessages((prev) => {
          const updated = [...prev];
          const last = updated[updated.length - 1];
          if (last.streaming) {
            updated[updated.length - 1] = {
              ...last,
              content: last.content + token,
            };
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
        fetchSessions();
      },
      (error) => {
        setMessages((prev) => {
          const updated = [...prev];
          updated[updated.length - 1] = {
            role: "ai",
            content: `Error: ${error}`,
            streaming: false,
          };
          return updated;
        });
        setLoading(false);
      }
    );
  }

  return (
    <div className="flex h-screen">

      {/* Sessions sidebar */}
      <div className="w-64 bg-[#0D0D14] border-r border-white/5 flex flex-col">
        <div className="p-4 border-b border-white/5">
          <button
            onClick={handleNewSession}
            className="w-full bg-blue-600 hover:bg-blue-500 text-white text-sm font-medium rounded-xl py-2.5 transition"
          >
            + New Chat
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-2 space-y-1">
          {sessions.length === 0 && (
            <p className="text-gray-600 text-xs text-center mt-8">
              No chats yet
            </p>
          )}
          {sessions.map((session) => (
            <div
              key={session.id}
              onClick={() => handleSelectSession(session.id)}
              className={`group flex items-center justify-between px-3 py-2.5 rounded-xl cursor-pointer transition ${
                activeSession === session.id
                  ? "bg-blue-600/20 text-blue-400"
                  : "text-gray-400 hover:bg-white/5 hover:text-white"
              }`}
            >
              <span className="text-xs truncate flex-1">{session.title}</span>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  handleDeleteSession(session.id);
                }}
                className="opacity-0 group-hover:opacity-100 text-gray-600 hover:text-red-400 transition ml-2"
              >
                ✕
              </button>
            </div>
          ))}
        </div>
      </div>

      {/* Chat area */}
      <div className="flex-1 flex flex-col">

        {!activeSession ? (
          <div className="flex-1 flex items-center justify-center">
            <div className="text-center">
              <div className="text-4xl mb-4">💬</div>
              <h2 className="text-white font-semibold text-lg mb-2">
                Start a conversation
              </h2>
              <p className="text-gray-500 text-sm mb-6">
                Create a new chat and ask questions about your documents
              </p>
              <button
                onClick={handleNewSession}
                className="bg-blue-600 hover:bg-blue-500 text-white text-sm font-medium rounded-xl px-6 py-2.5 transition"
              >
                + New Chat
              </button>
            </div>
          </div>
        ) : (
          <>
            {/* Messages */}
            <div className="flex-1 overflow-y-auto p-6 space-y-6">
              {messages.length === 0 && (
                <div className="text-center text-gray-600 text-sm mt-20">
                  Ask anything about your uploaded documents
                </div>
              )}

              {messages.map((msg, i) => (
                <div
                  key={i}
                  className={`flex ${msg.role === "human" ? "justify-end" : "justify-start"}`}
                >
                  {msg.role === "ai" && (
                    <div className="w-7 h-7 bg-blue-600 rounded-lg flex items-center justify-center mr-3 mt-1 shrink-0">
                      <span className="text-white text-xs font-bold">D</span>
                    </div>
                  )}

                  <div
                    className={`max-w-2xl rounded-2xl px-4 py-3 text-sm leading-relaxed ${
                      msg.role === "human"
                        ? "bg-blue-600 text-white rounded-tr-sm"
                        : "bg-[#111118] border border-white/5 text-gray-200 rounded-tl-sm"
                    }`}
                  >
                    {msg.content}
                    {msg.streaming && (
                      <span className="inline-block w-1.5 h-4 bg-blue-400 ml-1 animate-pulse rounded-sm" />
                    )}
                  </div>
                </div>
              ))}
              <div ref={messagesEndRef} />
            </div>

            {/* Input */}
            <div className="p-4 border-t border-white/5">
              <div className="flex gap-3 bg-[#111118] border border-white/10 rounded-2xl p-2">
                <input
                  type="text"
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && !e.shiftKey && handleSend()}
                  placeholder="Ask about your documents..."
                  disabled={loading}
                  className="flex-1 bg-transparent text-white placeholder-gray-600 text-sm px-3 py-2 focus:outline-none"
                />
                <button
                  onClick={handleSend}
                  disabled={loading || !input.trim()}
                  className="bg-blue-600 hover:bg-blue-500 disabled:opacity-40 disabled:cursor-not-allowed text-white rounded-xl px-4 py-2 text-sm font-medium transition"
                >
                  {loading ? (
                    <span className="flex items-center gap-2">
                      <svg className="animate-spin h-3 w-3" viewBox="0 0 24 24" fill="none">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/>
                      </svg>
                      ...
                    </span>
                  ) : "Send"}
                </button>
              </div>
              <p className="text-xs text-gray-700 text-center mt-2">
                Press Enter to send
              </p>
            </div>
          </>
        )}
      </div>
    </div>
  );
}