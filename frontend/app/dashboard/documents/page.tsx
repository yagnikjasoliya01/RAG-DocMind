"use client";

import { useState, useEffect, useRef } from "react";
import {
  uploadDocument,
  listDocuments,
  deleteDocument,
  getDocumentStatus,
  getDocumentPreviewUrl
} from "@/lib/api";


interface Document {
  id: string;
  original_name: string;
  status: string;
  chunk_count: number;
  created_at: string;
  error_message?: string;
}

interface Toast {
  message: string;
  type: "success" | "error" | "info";
}

interface ConfirmDialog {
  docId: string;
  docName: string;
}

export default function DocumentsPage() {
  const [documents, setDocuments] = useState<Document[]>([]);
  const [uploading, setUploading] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const [toast, setToast] = useState<Toast | null>(null);
  const [processingDocs, setProcessingDocs] = useState<Record<string, { step: string; step_index: number; total_steps: number }>>({});
  const [confirm, setConfirm] = useState<ConfirmDialog | null>(null);
  const [previewDoc, setPreviewDoc] = useState<{ url: string, name: string } | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const pollingRef = useRef<Record<string, NodeJS.Timeout>>({});

  useEffect(() => {
    fetchDocuments();
    return () => Object.values(pollingRef.current).forEach(clearInterval);
  }, []);

  async function handlePreview(docId: string) {
    setPreviewLoading(true);
    const data = await getDocumentPreviewUrl(docId);
    setPreviewDoc(data);
    setPreviewLoading(false);
  }

  async function fetchDocuments() {
    const docs = await listDocuments();
    setDocuments(docs);
    docs.forEach((doc: Document) => {
      if (doc.status === "pending" || doc.status === "processing") {
        startPolling(doc.id);
      }
    });
  }

  function startPolling(docId: string) {
    if (pollingRef.current[docId]) return;
    pollingRef.current[docId] = setInterval(async () => {
      const status = await getDocumentStatus(docId);
      setDocuments((prev) =>
        prev.map((d) => (d.id === docId ? { ...d, ...status } : d))
      );
      if (status.status === "ready" || status.status === "error") {
        clearInterval(pollingRef.current[docId]);
        delete pollingRef.current[docId];
      }
    }, 3000);
  }

  function showToast(message: string, type: Toast["type"] = "info") {
    setToast({ message, type });
    setTimeout(() => setToast(null), 4000);
  }

  async function handleUpload(file: File) {
    const allowed = [".pdf", ".jpg", ".jpeg", ".png", ".webp", ".txt", ".md"];
    const ext = "." + file.name.split(".").pop()?.toLowerCase();
    if (!allowed.includes(ext)) {
      showToast("Supported: PDF, JPG, PNG, WEBP, TXT, MD", "error");
      return;
    }
    setUploading(true);
    const result = await uploadDocument(file);
    if (result.status === "already_processed") {
      showToast("This document was already uploaded!", "info");
    } else if (result.document_id) {
      showToast("Uploaded! Processing started...", "success");
      await fetchDocuments();
      startProgressStream(result.document_id);
    }
    setUploading(false);
  }

  async function startProgressStream(docId: string) {
    const { createClient } = await import("@/lib/supabase");
    const supabase = createClient();
    const { data } = await supabase.auth.getSession();
    const token = data.session?.access_token;

    const res = await fetch(`http://localhost:8000/documents/${docId}/progress`, {
      headers: { Authorization: `Bearer ${token}` }
    });

    const reader = res.body!.getReader();
    const decoder = new TextDecoder();

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      const chunk = decoder.decode(value);
      const lines = chunk.split("\n");

      for (const line of lines) {
        if (line.startsWith("data: ")) {
          try {
            const data = JSON.parse(line.slice(6));
            if (data.status === "ready" || data.status === "error") {
              setProcessingDocs(prev => {
                const updated = { ...prev };
                delete updated[docId];
                return updated;
              });
              await fetchDocuments();
            } else {
              setProcessingDocs(prev => ({
                ...prev,
                [docId]: {
                  step: data.step,
                  step_index: data.step_index,
                  total_steps: data.total_steps
                }
              }));
            }
          } catch { }
        }
      }
    }
  }

  async function handleDeleteConfirmed() {
    if (!confirm) return;
    await deleteDocument(confirm.docId);
    setDocuments((prev) => prev.filter((d) => d.id !== confirm.docId));
    setConfirm(null);
    showToast("Document deleted", "success");
  }

  function formatDate(dateStr: string) {
    return new Date(dateStr).toLocaleDateString("en-US", {
      month: "short", day: "numeric", year: "numeric"
    });
  }

  const statusConfig: Record<string, { label: string; color: string; dot: string }> = {
    pending: { label: "Pending", color: "#d97706", dot: "#f59e0b" },
    processing: { label: "Processing", color: "#2563eb", dot: "#3b82f6" },
    ready: { label: "Ready", color: "#16a34a", dot: "#22c55e" },
    error: { label: "Error", color: "#dc2626", dot: "#ef4444" },
  };

  return (
    <div style={{
      height: "100%",
      overflowY: "auto",
      padding: "32px",
    }}>
      <div style={{ maxWidth: "680px", margin: "0 auto" }}>

        {/* Header */}
        <div style={{ marginBottom: "28px" }}>
          <h1 style={{
            fontSize: "20px",
            fontWeight: "600",
            color: "var(--text)",
            marginBottom: "4px"
          }}>
            Documents
          </h1>
          <p style={{ fontSize: "13px", color: "var(--text-secondary)" }}>
            Upload PDFs to ask questions about them
          </p>
        </div>

        {/* Upload area */}
        <div
          onClick={() => fileInputRef.current?.click()}
          onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
          onDragLeave={() => setDragOver(false)}
          onDrop={(e) => {
            e.preventDefault();
            setDragOver(false);
            const file = e.dataTransfer.files[0];
            if (file) handleUpload(file);
          }}
          style={{
            border: `2px dashed ${dragOver ? "var(--accent)" : "var(--border)"}`,
            borderRadius: "12px",
            padding: "36px",
            textAlign: "center",
            cursor: "pointer",
            background: dragOver ? "var(--active)" : "var(--bg-secondary)",
            transition: "all 0.15s",
            marginBottom: "24px"
          }}
        >
          <input
            ref={fileInputRef}
            type="file"
            accept=".pdf,.jpg,.jpeg,.png,.webp,.txt,.md"
            style={{ display: "none" }}
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) handleUpload(file);
            }}
          />

          {uploading ? (
            <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "12px" }}>
              <div style={{
                width: "20px", height: "20px",
                border: "2px solid var(--border)",
                borderTopColor: "var(--accent)",
                borderRadius: "50%",
                animation: "spin 0.8s linear infinite"
              }} />
              <p style={{ fontSize: "13px", color: "var(--text-secondary)" }}>Uploading...</p>
            </div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "10px" }}>
              <div style={{
                width: "40px", height: "40px",
                borderRadius: "10px",
                background: "var(--bg-tertiary)",
                border: "1px solid var(--border)",
                display: "flex", alignItems: "center", justifyContent: "center"
              }}>
                <svg width="18" height="18" fill="none" viewBox="0 0 24 24" stroke="currentColor" style={{ color: "var(--text-muted)" }}>
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                </svg>
              </div>
              <div>
                <p style={{ fontSize: "14px", fontWeight: "500", color: "var(--text)" }}>
                  {dragOver ? "Drop to upload" : "Upload PDF"}
                </p>
                <p style={{ fontSize: "12px", color: "var(--text-muted)", marginTop: "2px" }}>
                  PDF, JPG, PNG, TXT, MD · Max 20MB
                </p>
              </div>
            </div>
          )}
        </div>

        {/* Documents list */}
        {documents.length === 0 ? (
          <div style={{ textAlign: "center", padding: "60px 0" }}>
            <svg width="48" height="48" fill="none" viewBox="0 0 24 24" stroke="currentColor"
              style={{ color: "var(--border)", margin: "0 auto 16px", display: "block" }}>
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M9 13h6m-3-3v6m-9 1V7a2 2 0 012-2h6l2 2h6a2 2 0 012 2v8a2 2 0 01-2 2H5a2 2 0 01-2-2z" />
            </svg>
            <p style={{ fontSize: "15px", fontWeight: "600", color: "var(--text)", marginBottom: "6px" }}>
              No documents yet
            </p>
            <p style={{ fontSize: "13px", color: "var(--text-muted)", maxWidth: "280px", margin: "0 auto" }}>
              Upload a PDF above to start asking questions about your documents
            </p>
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
            {documents.map((doc) => {
              const s = statusConfig[doc.status] || statusConfig.pending;
              return (
                <div
                  key={doc.id}
                  className="doc-row"
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: "12px",
                    padding: "12px 14px",
                    borderRadius: "10px",
                    border: "1px solid var(--border)",
                    background: "var(--bg-secondary)",
                    transition: "all 0.15s"
                  }}
                >
                  {/* PDF icon */}
                  <div style={{
                    width: "36px", height: "36px",
                    borderRadius: "8px",
                    background: "var(--bg-tertiary)",
                    border: "1px solid var(--border)",
                    display: "flex", alignItems: "center", justifyContent: "center",
                    flexShrink: 0
                  }}>
                    <svg width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="currentColor" style={{ color: "var(--text-muted)" }}>
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                    </svg>
                  </div>

                  {/* Info */}
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <p style={{
                      fontSize: "13px",
                      fontWeight: "500",
                      color: "var(--text)",
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                      whiteSpace: "nowrap"
                    }}>
                      {doc.original_name}
                    </p>
                    <div style={{ display: "flex", alignItems: "center", gap: "10px", marginTop: "3px" }}>
                      <span style={{ display: "flex", alignItems: "center", gap: "4px", fontSize: "11px", color: s.color }}>
                        <span style={{
                          width: "5px", height: "5px",
                          borderRadius: "50%",
                          background: s.dot,
                          animation: doc.status === "processing" ? "pulse2 1.5s infinite" : "none"
                        }} />
                        {s.label}
                      </span>
                      {doc.status === "ready" && (
                        <span style={{ fontSize: "11px", color: "var(--text-muted)" }}>
                          {doc.chunk_count} chunks
                        </span>
                      )}
                      <span style={{ fontSize: "11px", color: "var(--text-muted)" }}>
                        {formatDate(doc.created_at)}
                      </span>
                    </div>

                    {/* Progress bar */}
                    {processingDocs[doc.id] && (
                      <div style={{ marginTop: "8px" }}>
                        <div style={{
                          display: "flex",
                          justifyContent: "space-between",
                          marginBottom: "4px"
                        }}>
                          <span style={{ fontSize: "11px", color: "var(--text-muted)" }}>
                            {processingDocs[doc.id].step}
                          </span>
                          <span style={{ fontSize: "11px", color: "var(--text-muted)" }}>
                            {processingDocs[doc.id].step_index}/{processingDocs[doc.id].total_steps}
                          </span>
                        </div>
                        <div style={{
                          height: "3px",
                          background: "var(--border)",
                          borderRadius: "2px",
                          overflow: "hidden"
                        }}>
                          <div style={{
                            height: "100%",
                            background: "var(--accent)",
                            borderRadius: "2px",
                            width: `${(processingDocs[doc.id].step_index / processingDocs[doc.id].total_steps) * 100}%`,
                            transition: "width 0.5s ease"
                          }} />
                        </div>
                      </div>
                    )}
                  </div>

                  {doc.status === "ready" && (
                    <button
                      onClick={() => handlePreview(doc.id)}
                      className="preview-doc-btn"
                      style={{
                        width: "28px", height: "28px",
                        borderRadius: "6px",
                        border: "none",
                        background: "transparent",
                        cursor: "pointer",
                        display: "flex", alignItems: "center", justifyContent: "center",
                        color: "var(--text-muted)",
                        opacity: 0,
                        transition: "all 0.15s",
                        flexShrink: 0
                      }}
                      onMouseEnter={e => {
                        e.currentTarget.style.color = "var(--accent)";
                        e.currentTarget.style.background = "var(--active)";
                      }}
                      onMouseLeave={e => {
                        e.currentTarget.style.color = "var(--text-muted)";
                        e.currentTarget.style.background = "transparent";
                      }}
                    >
                      <svg width="14" height="14" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                      </svg>
                    </button>
                  )}

                  {/* Delete */}
                  <button
                    onClick={() => setConfirm({ docId: doc.id, docName: doc.original_name })}
                    className="delete-doc-btn"
                    style={{
                      width: "28px", height: "28px",
                      borderRadius: "6px",
                      border: "none",
                      background: "transparent",
                      cursor: "pointer",
                      display: "flex", alignItems: "center", justifyContent: "center",
                      color: "var(--text-muted)",
                      opacity: 0,
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
                    <svg width="14" height="14" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                    </svg>
                  </button>
                </div>
              );
            })}
          </div>
        )}

      </div>

      {/* Confirm dialog */}
      {confirm && (
        <div style={{
          position: "fixed", inset: 0,
          background: "rgba(0,0,0,0.5)",
          backdropFilter: "blur(4px)",
          display: "flex", alignItems: "center", justifyContent: "center",
          zIndex: 50
        }}
          onClick={() => setConfirm(null)}
        >
          <div
            onClick={e => e.stopPropagation()}
            style={{
              background: "var(--bg-secondary)",
              border: "1px solid var(--border)",
              borderRadius: "14px",
              padding: "24px",
              maxWidth: "360px",
              width: "100%",
              margin: "16px",
              boxShadow: "var(--shadow)"
            }}
          >
            <h3 style={{ fontSize: "15px", fontWeight: "600", color: "var(--text)", marginBottom: "8px" }}>
              Delete document?
            </h3>
            <p style={{ fontSize: "13px", color: "var(--text-secondary)", lineHeight: "1.6", marginBottom: "20px" }}>
              <strong style={{
                color: "var(--text)",
                wordBreak: "break-all",
                display: "inline-block"
              }}>
                "{confirm.docName}"
              </strong>
            </p>
            <div style={{ display: "flex", gap: "10px" }}>
              <button
                onClick={() => setConfirm(null)}
                style={{
                  flex: 1, padding: "8px",
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
                onClick={handleDeleteConfirmed}
                style={{
                  flex: 1, padding: "8px",
                  borderRadius: "8px",
                  border: "none",
                  background: "#ef4444",
                  color: "white",
                  cursor: "pointer",
                  fontSize: "13px",
                  fontWeight: "500"
                }}
              >
                Delete
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
          color: "var(--text)",
          fontSize: "13px",
          fontWeight: "500",
          boxShadow: "var(--shadow)",
          display: "flex",
          alignItems: "center",
          gap: "8px",
          zIndex: 50
        }}>
          <span>
            {toast.type === "success" ? "✓" : toast.type === "error" ? "✕" : "i"}
          </span>
          {toast.message}
        </div>
      )}

      {/* PDF Preview Panel */}
      {previewDoc && (
        <div style={{
          position: "fixed",
          inset: 0,
          background: "rgba(0,0,0,0.6)",
          backdropFilter: "blur(4px)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          zIndex: 50
        }}
          onClick={() => setPreviewDoc(null)}
        >
          <div
            onClick={e => e.stopPropagation()}
            style={{
              background: "var(--bg-secondary)",
              border: "1px solid var(--border)",
              borderRadius: "14px",
              width: "90vw",
              height: "90vh",
              maxWidth: "900px",
              display: "flex",
              flexDirection: "column",
              overflow: "hidden"
            }}
          >
            {/* Header */}
            <div style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              padding: "14px 20px",
              borderBottom: "1px solid var(--border)"
            }}>
              <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                <svg width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="currentColor" style={{ color: "var(--text-muted)" }}>
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
                <span style={{
                  fontSize: "14px",
                  fontWeight: "500",
                  color: "var(--text)",
                  maxWidth: "500px",
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                  whiteSpace: "nowrap"
                }}>
                  {previewDoc.name}
                </span>
              </div>
              <div style={{ display: "flex", gap: "8px" }}>

                <a href={previewDoc.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  style={{
                    padding: "6px 12px",
                    borderRadius: "7px",
                    border: "1px solid var(--border)",
                    background: "var(--bg)",
                    color: "var(--text-secondary)",
                    fontSize: "12px",
                    textDecoration: "none",
                    display: "flex",
                    alignItems: "center",
                    gap: "5px"
                  }}
                >
                  <svg width="12" height="12" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                  </svg>
                  Open
                </a>
                <button
                  onClick={() => setPreviewDoc(null)}
                  style={{
                    width: "30px", height: "30px",
                    borderRadius: "7px",
                    border: "1px solid var(--border)",
                    background: "var(--bg)",
                    color: "var(--text-secondary)",
                    cursor: "pointer",
                    display: "flex", alignItems: "center", justifyContent: "center"
                  }}
                >
                  <svg width="14" height="14" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
            </div>

            {/* PDF iframe */}
            <iframe
              src={previewDoc.url}
              style={{
                flex: 1,
                border: "none",
                width: "100%"
              }}
              title={previewDoc.name}
            />
          </div>
        </div>
      )}

      <style>{`
        .doc-row:hover .delete-doc-btn {
          opacity: 1 !important;
        }
        .doc-row:hover .preview-doc-btn {
          opacity: 1 !important;
        }
        @keyframes spin {
          to { transform: rotate(360deg); }
        }
        @keyframes pulse2 {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.4; }
        }
      `}</style>

    </div>
  );
}