"use client";

import { useState, useEffect, useRef } from "react";
import {
  uploadDocument,
  listDocuments,
  deleteDocument,
  getDocumentStatus,
} from "@/lib/api";

interface Document {
  id: string;
  original_name: string;
  status: string;
  chunk_count: number;
  created_at: string;
  error_message?: string;
}

export default function DocumentsPage() {
  const [documents, setDocuments] = useState<Document[]>([]);
  const [uploading, setUploading] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const pollingRef = useRef<Record<string, NodeJS.Timeout>>({});

  useEffect(() => {
    fetchDocuments();
    return () => {
      Object.values(pollingRef.current).forEach(clearInterval);
    };
  }, []);

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

  async function handleUpload(file: File) {
    if (!file.name.endsWith(".pdf")) {
      alert("Only PDF files are allowed");
      return;
    }
    setUploading(true);
    const result = await uploadDocument(file);
    if (result.document_id) {
      await fetchDocuments();
      startPolling(result.document_id);
    }
    setUploading(false);
  }

  async function handleDelete(docId: string) {
    if (!confirm("Delete this document?")) return;
    await deleteDocument(docId);
    setDocuments((prev) => prev.filter((d) => d.id !== docId));
  }

  function getStatusBadge(status: string) {
    const map: Record<string, { color: string; label: string }> = {
      pending:    { color: "bg-yellow-500/10 text-yellow-400 border-yellow-500/20", label: "⏳ Pending" },
      processing: { color: "bg-blue-500/10 text-blue-400 border-blue-500/20",      label: "⚙️ Processing" },
      ready:      { color: "bg-green-500/10 text-green-400 border-green-500/20",   label: "✅ Ready" },
      error:      { color: "bg-red-500/10 text-red-400 border-red-500/20",         label: "❌ Error" },
    };
    const s = map[status] || map.pending;
    return (
      <span className={`text-xs px-2 py-1 rounded-lg border ${s.color}`}>
        {s.label}
      </span>
    );
  }

  return (
    <div className="p-8 max-w-4xl mx-auto">

      {/* Header */}
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-white">Documents</h1>
        <p className="text-gray-500 mt-1 text-sm">
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
        className={`border-2 border-dashed rounded-2xl p-12 text-center cursor-pointer transition mb-8 ${
          dragOver
            ? "border-blue-500 bg-blue-500/5"
            : "border-white/10 hover:border-white/20 hover:bg-white/3"
        }`}
      >
        <input
          ref={fileInputRef}
          type="file"
          accept=".pdf"
          className="hidden"
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) handleUpload(file);
          }}
        />
        {uploading ? (
          <div className="flex flex-col items-center gap-3">
            <div className="w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
            <p className="text-gray-400 text-sm">Uploading...</p>
          </div>
        ) : (
          <div className="flex flex-col items-center gap-3">
            <div className="w-12 h-12 bg-blue-600/10 rounded-xl flex items-center justify-center border border-blue-500/20">
              <span className="text-2xl">📄</span>
            </div>
            <div>
              <p className="text-white font-medium">Drop PDF here</p>
              <p className="text-gray-500 text-sm mt-1">or click to browse • Max 10MB</p>
            </div>
          </div>
        )}
      </div>

      {/* Documents list */}
      {documents.length === 0 ? (
        <div className="text-center py-12 text-gray-600">
          No documents yet — upload your first PDF above
        </div>
      ) : (
        <div className="space-y-3">
          {documents.map((doc) => (
            <div
              key={doc.id}
              className="bg-[#111118] border border-white/5 rounded-xl p-4 flex items-center justify-between"
            >
              <div className="flex items-center gap-4">
                <div className="w-10 h-10 bg-red-500/10 rounded-lg flex items-center justify-center border border-red-500/20">
                  <span>📄</span>
                </div>
                <div>
                  <p className="text-white text-sm font-medium">
                    {doc.original_name}
                  </p>
                  <div className="flex items-center gap-3 mt-1">
                    {getStatusBadge(doc.status)}
                    {doc.status === "ready" && (
                      <span className="text-xs text-gray-600">
                        {doc.chunk_count} chunks
                      </span>
                    )}
                  </div>
                </div>
              </div>

              <button
                onClick={() => handleDelete(doc.id)}
                className="text-gray-600 hover:text-red-400 transition text-sm px-3 py-1.5 rounded-lg hover:bg-red-500/10"
              >
                Delete
              </button>
            </div>
          ))}
        </div>
      )}

    </div>
  );
}