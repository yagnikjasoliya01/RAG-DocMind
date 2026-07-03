"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase";
import Link from "next/link";

export default function SignupPage() {
  const router = useRouter();
  const supabase = createClient();

  const [email, setEmail] = useState("");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [theme, setTheme] = useState("dark");

  useEffect(() => {
    const saved = localStorage.getItem("theme") || "dark";
    setTheme(saved);
    document.documentElement.setAttribute("data-theme", saved);
  }, []);

  function toggleTheme() {
    const next = theme === "dark" ? "light" : "dark";
    setTheme(next);
    localStorage.setItem("theme", next);
    document.documentElement.setAttribute("data-theme", next);
  }

  async function handleSignup(e: React.FormEvent) {
    e.preventDefault();
    setError("");

    // Validate username
    if (!username.trim()) {
      setError("Please enter a username");
      return;
    }
    if (username.length < 3) {
      setError("Username must be at least 3 characters");
      return;
    }
    if (username.length > 20) {
      setError("Username must be less than 20 characters");
      return;
    }
    if (!/^[a-zA-Z0-9_]+$/.test(username)) {
      setError("Username can only contain letters, numbers and underscores");
      return;
    }

    // Validate email
    if (!email.trim()) {
      setError("Please enter your email");
      return;
    }

    // Validate password
    if (!password) {
      setError("Please enter a password");
      return;
    }
    if (password.length < 6) {
      setError("Password must be at least 6 characters");
      return;
    }
    if (password !== confirmPassword) {
      setError("Passwords do not match");
      return;
    }

    setLoading(true);

    const { data, error } = await supabase.auth.signUp({
      email: email.trim(),
      password,
      options: {
        emailRedirectTo: `${window.location.origin}/auth/callback?username=${encodeURIComponent(username)}`,
      },
    });

    if (error) {
      switch (error.message) {
        case "User already registered":
          setError("An account with this email already exists. Try signing in.");
          break;
        case "Password should be at least 6 characters":
          setError("Password must be at least 6 characters");
          break;
        case "Unable to validate email address: invalid format":
          setError("Please enter a valid email address");
          break;
        case "Too many requests":
          setError("Too many attempts. Please wait a few minutes.");
          break;
        default:
          setError(error.message);
      }
      setLoading(false);
      return;
    }

    // Create profile
    if (data.session) {
      try {
        const profileRes = await fetch(`${process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000"}/auth/profile`, {
          method: "POST",
          headers: {
            Authorization: `Bearer ${data.session.access_token}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ username }),
        });

        if (!profileRes.ok) {
          const err = await profileRes.json();
          if (err.detail?.includes("username")) {
            setError("This username is already taken. Please choose another.");
            // Rollback: delete the auth user
            await supabase.auth.signOut();
            setLoading(false);
            return;
          }
        }
      } catch (e) {
        console.error("Profile creation error:", e);
      }
      router.push("/dashboard/documents");
    } else {
      // Email confirmation required
      localStorage.setItem("pending_username", username);
      setSuccess(true);
    }

    setLoading(false);
  }

  const inputStyle = {
    width: "100%",
    padding: "9px 12px",
    borderRadius: "8px",
    border: "1px solid var(--border)",
    background: "var(--bg)",
    color: "var(--text)",
    fontSize: "14px",
    outline: "none",
    transition: "border-color 0.15s",
    boxSizing: "border-box" as const
  };

  const labelStyle = {
    display: "block",
    fontSize: "12px",
    fontWeight: "500" as const,
    color: "var(--text-secondary)",
    marginBottom: "6px"
  };

  const EyeBtn = ({ show, onToggle }: { show: boolean; onToggle: () => void }) => (
    <button
      type="button"
      onClick={onToggle}
      style={{
        position: "absolute" as const,
        right: "10px", top: "50%",
        transform: "translateY(-50%)",
        border: "none",
        background: "transparent",
        cursor: "pointer",
        color: "var(--text-muted)",
        display: "flex", alignItems: "center",
        padding: "4px"
      }}
    >
      {show ? (
        <svg width="15" height="15" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 4.411m0 0L21 21" />
        </svg>
      ) : (
        <svg width="15" height="15" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
        </svg>
      )}
    </button>
  );

  if (success) {
    return (
      <div style={{
        minHeight: "100vh",
        background: "var(--bg)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: "24px"
      }}>
        <div style={{ textAlign: "center", maxWidth: "360px" }}>
          <div style={{
            width: "48px", height: "48px",
            borderRadius: "12px",
            background: "var(--bg-secondary)",
            border: "1px solid var(--border)",
            display: "flex", alignItems: "center", justifyContent: "center",
            margin: "0 auto 16px",
            fontSize: "22px"
          }}>
            📧
          </div>
          <h2 style={{ fontSize: "18px", fontWeight: "600", color: "var(--text)", marginBottom: "8px" }}>
            Check your email
          </h2>
          <p style={{ fontSize: "13px", color: "var(--text-secondary)", lineHeight: "1.6" }}>
            We sent a confirmation link to{" "}
            <strong style={{ color: "var(--text)" }}>{email}</strong>.
            Click it and you'll be redirected to your dashboard.
          </p>
          <Link href="/auth/login" style={{
            display: "inline-block",
            marginTop: "20px",
            fontSize: "13px",
            color: "var(--accent)",
            textDecoration: "none"
          }}>
            ← Back to sign in
          </Link>
        </div>
      </div>
    );
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

      {/* Theme toggle */}
      <button
        onClick={toggleTheme}
        style={{
          position: "fixed",
          top: "16px", right: "16px",
          width: "36px", height: "36px",
          borderRadius: "8px",
          border: "1px solid var(--border)",
          background: "var(--bg-secondary)",
          cursor: "pointer",
          display: "flex", alignItems: "center", justifyContent: "center",
          color: "var(--text-secondary)"
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

      <div style={{ width: "100%", maxWidth: "380px" }}>

        {/* Logo */}
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
          <h1 style={{
            fontSize: "22px",
            fontWeight: "600",
            color: "var(--text)",
            marginBottom: "6px"
          }}>
            Create account
          </h1>
          <p style={{ fontSize: "13px", color: "var(--text-secondary)" }}>
            Start using DocMind for free
          </p>
        </div>

        {/* Card */}
        <div style={{
          background: "var(--bg-secondary)",
          border: "1px solid var(--border)",
          borderRadius: "14px",
          padding: "24px"
        }}>
          <form onSubmit={handleSignup}>

            {/* Username */}
            <div style={{ marginBottom: "14px" }}>
              <label style={labelStyle}>Username</label>
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
                  style={{ ...inputStyle, paddingLeft: "28px" }}
                  onFocus={e => e.target.style.borderColor = "var(--accent)"}
                  onBlur={e => e.target.style.borderColor = "var(--border)"}
                />
              </div>
              <p style={{ fontSize: "11px", color: "var(--text-muted)", marginTop: "4px" }}>
                Letters, numbers and underscores only
              </p>
            </div>

            {/* Email */}
            <div style={{ marginBottom: "14px" }}>
              <label style={labelStyle}>Email</label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                style={inputStyle}
                onFocus={e => e.target.style.borderColor = "var(--accent)"}
                onBlur={e => e.target.style.borderColor = "var(--border)"}
              />
            </div>

            {/* Password */}
            <div style={{ marginBottom: "14px" }}>
              <label style={labelStyle}>Password</label>
              <div style={{ position: "relative" }}>
                <input
                  type={showPassword ? "text" : "password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  style={{ ...inputStyle, paddingRight: "40px" }}
                  onFocus={e => e.target.style.borderColor = "var(--accent)"}
                  onBlur={e => e.target.style.borderColor = "var(--border)"}
                />
                <EyeBtn show={showPassword} onToggle={() => setShowPassword(!showPassword)} />
              </div>
            </div>

            {/* Confirm Password */}
            <div style={{ marginBottom: "16px" }}>
              <label style={labelStyle}>Confirm Password</label>
              <div style={{ position: "relative" }}>
                <input
                  type={showConfirm ? "text" : "password"}
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  required
                  style={{ ...inputStyle, paddingRight: "40px" }}
                  onFocus={e => e.target.style.borderColor = "var(--accent)"}
                  onBlur={e => e.target.style.borderColor = "var(--border)"}
                />
                <EyeBtn show={showConfirm} onToggle={() => setShowConfirm(!showConfirm)} />
              </div>
              {confirmPassword && (
                <p style={{
                  fontSize: "11px",
                  marginTop: "5px",
                  color: password === confirmPassword ? "#16a34a" : "#ef4444"
                }}>
                  {password === confirmPassword ? "✓ Passwords match" : "✗ Passwords do not match"}
                </p>
              )}
            </div>

            {/* Error */}
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

            {/* Submit */}
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
                transition: "all 0.15s",
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
              {loading ? "Creating account..." : "Create account"}
            </button>

          </form>

          <div style={{
            textAlign: "center",
            marginTop: "20px",
            paddingTop: "20px",
            borderTop: "1px solid var(--border)"
          }}>
            <span style={{ fontSize: "13px", color: "var(--text-muted)" }}>
              Already have an account?{" "}
            </span>
            <Link href="/auth/login" style={{
              fontSize: "13px",
              color: "var(--accent)",
              textDecoration: "none",
              fontWeight: "500"
            }}>
              Sign in
            </Link>
          </div>
        </div>

      </div>

      <style>{`
        @keyframes spin {
          to { transform: rotate(360deg); }
        }
      `}</style>

    </div>
  );
}