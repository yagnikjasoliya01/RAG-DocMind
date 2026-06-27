"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase";

export default function ProfilePage() {
  const router = useRouter();
  const supabase = createClient();

  const [email, setEmail] = useState("");
  const [username, setUsername] = useState("");
  const [newUsername, setNewUsername] = useState("");
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [passwordLoading, setPasswordLoading] = useState(false);
  const [deleteLoading, setDeleteLoading] = useState(false);
  const [toast, setToast] = useState<{ message: string; type: "success" | "error" } | null>(null);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deleteConfirmText, setDeleteConfirmText] = useState("");

  useEffect(() => {
    fetchProfile();
  }, []);

  async function fetchProfile() {
    const { data } = await supabase.auth.getSession();
    if (!data.session) {
      router.push("/auth/login");
      return;
    }
    setEmail(data.session.user.email || "");

    const res = await fetch("http://localhost:8000/auth/me", {
      headers: { Authorization: `Bearer ${data.session.access_token}` }
    });
    const profile = await res.json();
    setUsername(profile.username || "");
    setNewUsername(profile.username || "");
  }

  function showToast(message: string, type: "success" | "error") {
    setToast({ message, type });
    setTimeout(() => setToast(null), 4000);
  }

  async function handleUpdateUsername(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);

    if (newUsername.length < 3) {
      showToast("Username must be at least 3 characters", "error");
      setLoading(false);
      return;
    }
    if (newUsername.length > 20) {
      showToast("Username must be less than 20 characters", "error");
      setLoading(false);
      return;
    }
    if (!/^[a-zA-Z0-9_]+$/.test(newUsername)) {
      showToast("Letters, numbers and underscores only", "error");
      setLoading(false);
      return;
    }

    const { data } = await supabase.auth.getSession();
    const res = await fetch("http://localhost:8000/auth/profile", {
      method: "PATCH",
      headers: {
        Authorization: `Bearer ${data.session?.access_token}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({ username: newUsername })
    });

    if (res.ok) {
      setUsername(newUsername);
      showToast("Username updated successfully!", "success");
    } else {
      const err = await res.json();
      showToast(err.detail || "Failed to update username", "error");
    }

    setLoading(false);
  }

  async function handleUpdatePassword(e: React.FormEvent) {
    e.preventDefault();
    setPasswordLoading(true);

    if (newPassword.length < 6) {
      showToast("Password must be at least 6 characters", "error");
      setPasswordLoading(false);
      return;
    }
    if (newPassword !== confirmPassword) {
      showToast("Passwords do not match", "error");
      setPasswordLoading(false);
      return;
    }

    const { error } = await supabase.auth.updateUser({
      password: newPassword
    });

    if (error) {
      showToast(error.message, "error");
    } else {
      showToast("Password updated successfully!", "success");
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
    }

    setPasswordLoading(false);
  }

  async function handleDeleteAccount() {
    if (deleteConfirmText !== username) {
      showToast("Username doesn't match", "error");
      return;
    }

    setDeleteLoading(true);

    const { data } = await supabase.auth.getSession();

    // Delete all user data from backend
    try {
      await fetch("http://localhost:8000/auth/account", {
        method: "DELETE",
        headers: {
          Authorization: `Bearer ${data.session?.access_token}`
        }
      });
    } catch (e) {
      console.error("Delete account error:", e);
    }

    await supabase.auth.signOut();
    router.push("/auth/login");
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
    boxSizing: "border-box" as const,
    transition: "border-color 0.15s"
  };

  const labelStyle = {
    display: "block",
    fontSize: "12px",
    fontWeight: "500" as const,
    color: "var(--text-secondary)",
    marginBottom: "6px"
  };

  const sectionStyle = {
    background: "var(--bg-secondary)",
    border: "1px solid var(--border)",
    borderRadius: "14px",
    padding: "24px",
    marginBottom: "16px"
  };

  return (
    <div style={{ height: "100%", overflowY: "auto", padding: "32px" }}>
      <div style={{ maxWidth: "560px", margin: "0 auto" }}>

        {/* Header */}
        <div style={{ marginBottom: "28px" }}>
          <h1 style={{ fontSize: "20px", fontWeight: "600", color: "var(--text)", marginBottom: "4px" }}>
            Profile
          </h1>
          <p style={{ fontSize: "13px", color: "var(--text-secondary)" }}>
            Manage your account settings
          </p>
        </div>

        {/* Avatar + info */}
        <div style={{ ...sectionStyle, display: "flex", alignItems: "center", gap: "16px" }}>
          <div style={{
            width: "56px", height: "56px",
            borderRadius: "50%",
            background: "var(--accent)",
            display: "flex", alignItems: "center", justifyContent: "center",
            flexShrink: 0
          }}>
            <span style={{ color: "white", fontSize: "22px", fontWeight: "600" }}>
              {(username || email).charAt(0).toUpperCase()}
            </span>
          </div>
          <div>
            <p style={{ fontSize: "16px", fontWeight: "600", color: "var(--text)" }}>
              @{username || "—"}
            </p>
            <p style={{ fontSize: "13px", color: "var(--text-secondary)", marginTop: "2px" }}>
              {email}
            </p>
          </div>
        </div>

        {/* Update username */}
        <div style={sectionStyle}>
          <h2 style={{ fontSize: "15px", fontWeight: "600", color: "var(--text)", marginBottom: "16px" }}>
            Username
          </h2>
          <form onSubmit={handleUpdateUsername}>
            <div style={{ marginBottom: "16px" }}>
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
                  value={newUsername}
                  onChange={(e) => setNewUsername(e.target.value.toLowerCase())}
                  style={{ ...inputStyle, paddingLeft: "28px" }}
                  onFocus={e => e.target.style.borderColor = "var(--accent)"}
                  onBlur={e => e.target.style.borderColor = "var(--border)"}
                />
              </div>
              <p style={{ fontSize: "11px", color: "var(--text-muted)", marginTop: "4px" }}>
                Letters, numbers and underscores only · 3-20 characters
              </p>
            </div>
            <button
              type="submit"
              disabled={loading || newUsername === username}
              style={{
                padding: "8px 16px",
                borderRadius: "8px",
                border: "none",
                background: newUsername !== username ? "var(--accent)" : "var(--bg-tertiary)",
                color: newUsername !== username ? "white" : "var(--text-muted)",
                fontSize: "13px",
                fontWeight: "500",
                cursor: loading || newUsername === username ? "not-allowed" : "pointer",
                opacity: loading ? 0.7 : 1,
                transition: "all 0.15s"
              }}
            >
              {loading ? "Saving..." : "Save username"}
            </button>
          </form>
        </div>

        {/* Update password */}
        <div style={sectionStyle}>
          <h2 style={{ fontSize: "15px", fontWeight: "600", color: "var(--text)", marginBottom: "16px" }}>
            Password
          </h2>
          <form onSubmit={handleUpdatePassword}>
            <div style={{ marginBottom: "14px" }}>
              <label style={labelStyle}>New Password</label>
              <input
                type="password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                placeholder="Min. 6 characters"
                style={inputStyle}
                onFocus={e => e.target.style.borderColor = "var(--accent)"}
                onBlur={e => e.target.style.borderColor = "var(--border)"}
              />
            </div>
            <div style={{ marginBottom: "16px" }}>
              <label style={labelStyle}>Confirm New Password</label>
              <input
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="Repeat new password"
                style={inputStyle}
                onFocus={e => e.target.style.borderColor = "var(--accent)"}
                onBlur={e => e.target.style.borderColor = "var(--border)"}
              />
              {confirmPassword && (
                <p style={{
                  fontSize: "11px", marginTop: "4px",
                  color: newPassword === confirmPassword ? "#16a34a" : "#ef4444"
                }}>
                  {newPassword === confirmPassword ? "✓ Passwords match" : "✗ Passwords do not match"}
                </p>
              )}
            </div>
            <button
              type="submit"
              disabled={passwordLoading || !newPassword || !confirmPassword}
              style={{
                padding: "8px 16px",
                borderRadius: "8px",
                border: "none",
                background: newPassword && confirmPassword ? "var(--accent)" : "var(--bg-tertiary)",
                color: newPassword && confirmPassword ? "white" : "var(--text-muted)",
                fontSize: "13px",
                fontWeight: "500",
                cursor: passwordLoading || !newPassword ? "not-allowed" : "pointer",
                opacity: passwordLoading ? 0.7 : 1,
                transition: "all 0.15s"
              }}
            >
              {passwordLoading ? "Updating..." : "Update password"}
            </button>
          </form>
        </div>

        {/* Danger zone */}
        <div style={{
          ...sectionStyle,
          borderColor: "rgba(239,68,68,0.2)",
          marginBottom: 0
        }}>
          <h2 style={{ fontSize: "15px", fontWeight: "600", color: "#ef4444", marginBottom: "8px" }}>
            Danger Zone
          </h2>
          <p style={{ fontSize: "13px", color: "var(--text-secondary)", marginBottom: "16px" }}>
            Permanently delete your account and all your data including documents, embeddings and chat history.
          </p>
          <button
            onClick={() => setShowDeleteConfirm(true)}
            style={{
              padding: "8px 16px",
              borderRadius: "8px",
              border: "1px solid rgba(239,68,68,0.3)",
              background: "rgba(239,68,68,0.08)",
              color: "#ef4444",
              fontSize: "13px",
              fontWeight: "500",
              cursor: "pointer",
              transition: "all 0.15s"
            }}
          >
            Delete account
          </button>
        </div>

      </div>

      {/* Delete confirm modal */}
      {showDeleteConfirm && (
        <div style={{
          position: "fixed", inset: 0,
          background: "rgba(0,0,0,0.5)",
          backdropFilter: "blur(4px)",
          display: "flex", alignItems: "center", justifyContent: "center",
          zIndex: 50
        }}
          onClick={() => setShowDeleteConfirm(false)}
        >
          <div
            onClick={e => e.stopPropagation()}
            style={{
              background: "var(--bg-secondary)",
              border: "1px solid rgba(239,68,68,0.2)",
              borderRadius: "14px",
              padding: "24px",
              maxWidth: "380px",
              width: "100%",
              margin: "16px"
            }}
          >
            <h3 style={{ fontSize: "16px", fontWeight: "600", color: "var(--text)", marginBottom: "8px" }}>
              Delete account
            </h3>
            <p style={{ fontSize: "13px", color: "var(--text-secondary)", lineHeight: "1.6", marginBottom: "16px" }}>
              This action is <strong style={{ color: "var(--text)" }}>permanent and irreversible</strong>.
              All your documents, embeddings and chats will be deleted.
            </p>
            <div style={{ marginBottom: "16px" }}>
              <label style={labelStyle}>
                Type <strong style={{ color: "var(--text)" }}>@{username}</strong> to confirm
              </label>
              <input
                type="text"
                value={deleteConfirmText}
                onChange={(e) => setDeleteConfirmText(e.target.value)}
                placeholder={username}
                style={inputStyle}
              />
            </div>
            <div style={{ display: "flex", gap: "10px" }}>
              <button
                onClick={() => {
                  setShowDeleteConfirm(false);
                  setDeleteConfirmText("");
                }}
                style={{
                  flex: 1, padding: "9px",
                  borderRadius: "8px",
                  border: "1px solid var(--border)",
                  background: "var(--bg)",
                  color: "var(--text-secondary)",
                  cursor: "pointer",
                  fontSize: "13px",
                  fontWeight: "500"
                }}
              >
                Cancel
              </button>
              <button
                onClick={handleDeleteAccount}
                disabled={deleteConfirmText !== username || deleteLoading}
                style={{
                  flex: 1, padding: "9px",
                  borderRadius: "8px",
                  border: "none",
                  background: deleteConfirmText === username ? "#ef4444" : "var(--bg-tertiary)",
                  color: deleteConfirmText === username ? "white" : "var(--text-muted)",
                  cursor: deleteConfirmText === username ? "pointer" : "not-allowed",
                  fontSize: "13px",
                  fontWeight: "500",
                  transition: "all 0.15s"
                }}
              >
                {deleteLoading ? "Deleting..." : "Delete account"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Toast */}
      {toast && (
        <div style={{
          position: "fixed",
          bottom: "20px", right: "20px",
          padding: "10px 16px",
          borderRadius: "10px",
          border: "1px solid var(--border)",
          background: "var(--bg-secondary)",
          color: toast.type === "success" ? "#16a34a" : "#ef4444",
          fontSize: "13px",
          fontWeight: "500",
          boxShadow: "var(--shadow)",
          zIndex: 50
        }}>
          {toast.type === "success" ? "✓" : "✕"} {toast.message}
        </div>
      )}

    </div>
  );
}