"use client";

import { useEffect, useState } from "react";
import { useRouter, usePathname } from "next/navigation";
import { createClient } from "@/lib/supabase";
import {
  createSession,
  listSessions,
  deleteSession,
} from "@/lib/api";
import Link from "next/link";

interface Session {
  id: string;
  title: string;
  updated_at: string;
}

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const [email, setEmail] = useState("");
  const [username, setUsername] = useState("");
  const [mounted, setMounted] = useState(false);
  const [theme, setTheme] = useState("dark");
  const [sessions, setSessions] = useState<Session[]>([]);
  const [activeSession, setActiveSession] = useState<string | null>(null);

  useEffect(() => {
    setMounted(true);
    const saved = localStorage.getItem("theme") || "dark";
    setTheme(saved);
    document.documentElement.setAttribute("data-theme", saved);

    async function init() {
      const supabase = createClient();
      const { data } = await supabase.auth.getSession();
      if (!data.session) {
        router.push("/auth/login");
        return;
      }
      setEmail(data.session.user.email || "");

      // Fetch username from backend
      const res = await fetch("http://localhost:8000/auth/me", {
        headers: {
          Authorization: `Bearer ${data.session.access_token}`
        }
      });
      const profile = await res.json();
      setUsername(profile.username || "");
    }
    init();
    fetchSessions();
  }, [router]);

  async function fetchSessions() {
    const data = await listSessions();
    setSessions(data);
  }

  function toggleTheme() {
    const next = theme === "dark" ? "light" : "dark";
    setTheme(next);
    localStorage.setItem("theme", next);
    document.documentElement.setAttribute("data-theme", next);
  }

  async function handleSignOut() {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push("/auth/login");
  }

  async function handleNewChat() {
    const session = await createSession("New Chat");
    setSessions((prev) => [session, ...prev]);
    setActiveSession(session.id);
    router.push(`/dashboard/chat?session=${session.id}`);
  }

  async function handleDeleteSession(e: React.MouseEvent, sessionId: string) {
    e.stopPropagation();
    await deleteSession(sessionId);
    setSessions((prev) => prev.filter((s) => s.id !== sessionId));
    if (activeSession === sessionId) {
      setActiveSession(null);
      router.push("/dashboard/chat");
    }
  }

  function handleSelectSession(sessionId: string) {
    setActiveSession(sessionId);
    router.push(`/dashboard/chat?session=${sessionId}`);
  }

  if (!mounted) return null;

  const isChat = pathname.startsWith("/dashboard/chat");

  return (
    <div style={{
      position: "fixed", inset: 0,
      display: "flex",
      background: "var(--bg)",
      overflow: "hidden"
    }}>

      {/* Sidebar */}
      <aside style={{
        width: "260px",
        flexShrink: 0,
        display: "flex",
        flexDirection: "column",
        background: "var(--sidebar)",
        borderRight: "1px solid var(--border)",
        overflow: "hidden"
      }}>

        {/* Logo + Theme toggle */}
        <div style={{
          padding: "16px",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          borderBottom: "1px solid var(--border)"
        }}>
          <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
            <div style={{
              width: "32px", height: "32px",
              background: "var(--accent)",
              borderRadius: "8px",
              display: "flex", alignItems: "center", justifyContent: "center"
            }}>
              <span style={{ color: "white", fontWeight: "700", fontSize: "14px" }}>D</span>
            </div>
            <span style={{ fontWeight: "600", fontSize: "15px", color: "var(--text)" }}>
              DocMind
            </span>
          </div>

          {/* Theme toggle */}
          <button
            onClick={toggleTheme}
            style={{
              width: "32px", height: "32px",
              borderRadius: "8px",
              border: "1px solid var(--border)",
              background: "var(--hover)",
              cursor: "pointer",
              display: "flex", alignItems: "center", justifyContent: "center",
              color: "var(--text-secondary)",
              transition: "all 0.15s"
            }}
          >
            {theme === "dark" ? (
              <svg width="15" height="15" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364-6.364l-.707.707M6.343 17.657l-.707.707M17.657 17.657l-.707-.707M6.343 6.343l-.707-.707M12 8a4 4 0 100 8 4 4 0 000-8z" />
              </svg>
            ) : (
              <svg width="15" height="15" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z" />
              </svg>
            )}
          </button>
        </div>

        {/* New Chat button */}
        <div style={{ padding: "12px" }}>
          <button
            onClick={handleNewChat}
            style={{
              width: "100%",
              padding: "8px 12px",
              borderRadius: "8px",
              border: "1px solid var(--border)",
              background: "var(--bg)",
              color: "var(--text)",
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              gap: "8px",
              fontSize: "13px",
              fontWeight: "500",
              transition: "all 0.15s"
            }}
            onMouseEnter={e => (e.currentTarget.style.background = "var(--hover)")}
            onMouseLeave={e => (e.currentTarget.style.background = "var(--bg)")}
          >
            <svg width="14" height="14" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            New Chat
          </button>
        </div>

        {/* Nav links */}
        <div style={{ padding: "0 12px 8px" }}>
          <Link
            href="/dashboard/documents"
            style={{
              display: "flex",
              alignItems: "center",
              gap: "8px",
              padding: "8px 10px",
              borderRadius: "8px",
              fontSize: "13px",
              fontWeight: "500",
              color: pathname === "/dashboard/documents" ? "var(--accent)" : "var(--text-secondary)",
              background: pathname === "/dashboard/documents" ? "var(--active)" : "transparent",
              textDecoration: "none",
              transition: "all 0.15s"
            }}
          >
            <svg width="15" height="15" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
            Documents
          </Link>
        </div>

        {/* Divider */}
        <div style={{ padding: "0 12px 8px" }}>
          <p style={{
            fontSize: "11px",
            fontWeight: "600",
            color: "var(--text-muted)",
            textTransform: "uppercase",
            letterSpacing: "0.08em",
            padding: "4px 10px"
          }}>
            Recent Chats
          </p>
        </div>

        {/* Sessions list */}
        <div style={{ flex: 1, overflowY: "auto", padding: "0 12px" }}>
          {sessions.length === 0 && (
            <p style={{
              fontSize: "12px",
              color: "var(--text-muted)",
              textAlign: "center",
              padding: "16px 0"
            }}>
              No chats yet
            </p>
          )}

          {sessions.map((session) => {
            const isActive = activeSession === session.id ||
              (isChat && pathname.includes(session.id));
            return (
              <div
                key={session.id}
                onClick={() => handleSelectSession(session.id)}
                className="group"
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "8px",
                  padding: "7px 10px",
                  borderRadius: "8px",
                  cursor: "pointer",
                  marginBottom: "2px",
                  background: isActive ? "var(--active)" : "transparent",
                  transition: "all 0.15s"
                }}
                onMouseEnter={e => {
                  if (!isActive) e.currentTarget.style.background = "var(--hover)";
                }}
                onMouseLeave={e => {
                  if (!isActive) e.currentTarget.style.background = "transparent";
                }}
              >
                <svg
                  width="13" height="13"
                  fill="none" viewBox="0 0 24 24"
                  stroke="currentColor"
                  style={{ color: "var(--text-muted)", flexShrink: 0 }}
                >
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                </svg>

                <span style={{
                  flex: 1,
                  fontSize: "13px",
                  color: isActive ? "var(--accent)" : "var(--text-secondary)",
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                  whiteSpace: "nowrap",
                  fontWeight: isActive ? "500" : "400"
                }}>
                  {session.title}
                </span>

                <button
                  onClick={(e) => handleDeleteSession(e, session.id)}
                  style={{
                    opacity: 0,
                    width: "20px", height: "20px",
                    borderRadius: "4px",
                    border: "none",
                    background: "transparent",
                    cursor: "pointer",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    color: "var(--text-muted)",
                    flexShrink: 0,
                    transition: "all 0.15s"
                  }}
                  className="delete-btn"
                  onMouseEnter={e => {
                    e.currentTarget.style.color = "#ef4444";
                    e.currentTarget.style.background = "rgba(239,68,68,0.1)";
                  }}
                  onMouseLeave={e => {
                    e.currentTarget.style.color = "var(--text-muted)";
                    e.currentTarget.style.background = "transparent";
                  }}
                >
                  <svg width="11" height="11" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
            );
          })}
        </div>

        {/* User */}
        <div style={{
          padding: "12px",
          borderTop: "1px solid var(--border)"
        }}>
          <div style={{
            display: "flex",
            alignItems: "center",
            gap: "10px",
            padding: "8px 10px",
            borderRadius: "8px",
            background: "var(--hover)"
          }}>
            <div style={{
              width: "28px", height: "28px",
              borderRadius: "50%",
              background: "var(--accent)",
              display: "flex", alignItems: "center", justifyContent: "center",
              flexShrink: 0
            }}>
              <span style={{ color: "white", fontSize: "11px", fontWeight: "600" }}>
                {(username || email).charAt(0).toUpperCase()}
              </span>
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              {username && (
                <p style={{
                  fontSize: "13px",
                  fontWeight: "500",
                  color: "var(--text)",
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                  whiteSpace: "nowrap"
                }}>
                  @{username}
                </p>
              )}
              <p style={{
                fontSize: "11px",
                color: "var(--text-muted)",
                overflow: "hidden",
                textOverflow: "ellipsis",
                whiteSpace: "nowrap"
              }}>
                {email}
              </p>
            </div>
            <button
              onClick={handleSignOut}
              title="Sign out"
              style={{
                width: "24px", height: "24px",
                borderRadius: "6px",
                border: "none",
                background: "transparent",
                cursor: "pointer",
                display: "flex", alignItems: "center", justifyContent: "center",
                color: "var(--text-muted)",
                transition: "all 0.15s",
                flexShrink: 0
              }}
              onMouseEnter={e => {
                e.currentTarget.style.color = "#ef4444";
                e.currentTarget.style.background = "rgba(239,68,68,0.1)";
              }}
              onMouseLeave={e => {
                e.currentTarget.style.color = "var(--text-muted)";
                e.currentTarget.style.background = "transparent";
              }}
            >
              <svg width="13" height="13" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
              </svg>
            </button>
          </div>
        </div>

      </aside>

      {/* Main */}
      <main style={{
        flex: 1,
        overflow: "hidden",
        display: "flex",
        flexDirection: "column",
        background: "var(--bg)"
      }}>
        {children}
      </main>

      <style>{`
        .group:hover .delete-btn {
          opacity: 1 !important;
        }
      `}</style>

    </div>
  );
}