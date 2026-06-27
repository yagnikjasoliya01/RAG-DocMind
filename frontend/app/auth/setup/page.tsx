"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase";

export default function SetupPage() {
  const router = useRouter();
  const supabase = createClient();
  const [username, setUsername] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSetup(e: React.FormEvent) {
    e.preventDefault();
    setError("");

    if (username.length < 3) {
      setError("Username must be at least 3 characters");
      return;
    }
    if (username.length > 20) {
      setError("Username must be less than 20 characters");
      return;
    }
    if (!/^[a-zA-Z0-9_]+$/.test(username)) {
      setError("Letters, numbers and underscores only");
      return;
    }

    setLoading(true);

    const { data } = await supabase.auth.getSession();
    if (!data.session) {
      router.push("/auth/login");
      return;
    }

    const res = await fetch("http://localhost:8000/auth/profile", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${data.session.access_token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ username }),
    });

    if (!res.ok) {
      const err = await res.json();
      setError(err.detail || "Something went wrong");
      setLoading(false);
      return;
    }

    router.push("/dashboard/documents");
  }

  return (
    <div style={{
      minHeight: "100vh",
      background: "var(--bg)",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      padding: "24px"
    }}>
      <div style={{ width: "100%", maxWidth: "380px" }}>

        <div style={{ textAlign: "center", marginBottom: "32px" }}>
          <div style={{
            width: "40px", height: "40px",
            borderRadius: "10px",
            background: "var(--accent)",
            display: "flex", alignItems: "center", justifyContent: "center",
            margin: "0 auto 14px"
          }}>
            <span style={{ color: "white", fontWeight: "700", fontSize: "16px" }}>D</span>
          </div>
          <h1 style={{ fontSize: "22px", fontWeight: "600", color: "var(--text)", marginBottom: "6px" }}>
            One last step
          </h1>
          <p style={{ fontSize: "13px", color: "var(--text-secondary)" }}>
            Choose a username to complete your profile
          </p>
        </div>

        <div style={{
          background: "var(--bg-secondary)",
          border: "1px solid var(--border)",
          borderRadius: "14px",
          padding: "24px"
        }}>
          <form onSubmit={handleSetup}>
            <div style={{ marginBottom: "16px" }}>
              <label style={{
                display: "block",
                fontSize: "12px",
                fontWeight: "500",
                color: "var(--text-secondary)",
                marginBottom: "6px"
              }}>
                Username
              </label>
              <div style={{ position: "relative" }}>
                <span style={{
                  position: "absolute",
                  left: "12px", top: "50%",
                  transform: "translateY(-50%)",
                  fontSize: "14px",
                  color: "var(--text-muted)"
                }}>@</span>
                <input
                  type="text"
                  value={username}
                  onChange={(e) => setUsername(e.target.value.toLowerCase())}
                  required
                  placeholder="yourname"
                  style={{
                    width: "100%",
                    padding: "9px 12px 9px 28px",
                    borderRadius: "8px",
                    border: "1px solid var(--border)",
                    background: "var(--bg)",
                    color: "var(--text)",
                    fontSize: "14px",
                    outline: "none",
                    boxSizing: "border-box" as const
                  }}
                  onFocus={e => e.target.style.borderColor = "var(--accent)"}
                  onBlur={e => e.target.style.borderColor = "var(--border)"}
                />
              </div>
            </div>

            {error && (
              <div style={{
                padding: "10px 12px",
                borderRadius: "8px",
                background: "rgba(239,68,68,0.08)",
                border: "1px solid rgba(239,68,68,0.2)",
                color: "#ef4444",
                fontSize: "13px",
                marginBottom: "16px"
              }}>
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              style={{
                width: "100%",
                padding: "10px",
                borderRadius: "8px",
                border: "none",
                background: "var(--accent)",
                color: "white",
                fontSize: "14px",
                fontWeight: "500",
                cursor: loading ? "not-allowed" : "pointer",
                opacity: loading ? 0.7 : 1,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                gap: "8px"
              }}
            >
              {loading && (
                <div style={{
                  width: "14px", height: "14px",
                  border: "2px solid rgba(255,255,255,0.3)",
                  borderTopColor: "white",
                  borderRadius: "50%",
                  animation: "spin 0.8s linear infinite"
                }} />
              )}
              {loading ? "Saving..." : "Complete setup"}
            </button>
          </form>
        </div>
      </div>

      <style>{`
        @keyframes spin { to { transform: rotate(360deg); } }
      `}</style>
    </div>
  );
}