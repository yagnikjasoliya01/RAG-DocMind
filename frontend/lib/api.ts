const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

async function getToken(): Promise<string | null> {
  const { createClient } = await import("@/lib/supabase");
  const supabase = createClient();
  const { data } = await supabase.auth.getSession();
  return data.session?.access_token || null;
}

async function authFetch(path: string, options: RequestInit = {}) {
  const token = await getToken();
  try {
    return fetch(`${API_URL}${path}`, {
      ...options,
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
        ...options.headers,
      },
    });
  } catch (error) {
    console.error("Fetch error:", error);
    throw error;
  }
}

// ── Documents ─────────────────────────────────────────────────
export async function uploadDocument(file: File) {
  const token = await getToken();
  const formData = new FormData();
  formData.append("file", file);

  const res = await fetch(`${API_URL}/documents/upload`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}` },
    body: formData,
  });
  return res.json();
}

export async function listDocuments() {
  const res = await authFetch("/documents/");
  return res.json();
}

export async function deleteDocument(docId: string) {
  const res = await authFetch(`/documents/${docId}`, { method: "DELETE" });
  return res.json();
}

export async function getDocumentStatus(docId: string) {
  const res = await authFetch(`/documents/${docId}/status`);
  return res.json();
}

// ── Chat ──────────────────────────────────────────────────────
export async function createSession(title: string = "New Chat") {
  const res = await authFetch("/chat/sessions", {
    method: "POST",
    body: JSON.stringify({ title }),
  });
  return res.json();
}

export async function listSessions() {
  const res = await authFetch("/chat/sessions");
  return res.json();
}

export async function getMessages(sessionId: string) {
  const res = await authFetch(`/chat/sessions/${sessionId}/messages`);
  return res.json();
}

export async function deleteSession(sessionId: string) {
  const res = await authFetch(`/chat/sessions/${sessionId}`, {
    method: "DELETE",
  });
  return res.json();
}

export async function streamQuery(
  sessionId: string,
  question: string,
  onToken: (token: string) => void,
  onDone: () => void,
  onError: (error: string) => void,
  documentIds: string[] = []
) {
  const token = await getToken();

  const res = await fetch(
    `${API_URL}/chat/sessions/${sessionId}/query`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ question, document_ids: documentIds }),
    }
  );

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
          if (data.token !== undefined) onToken(data.token);
          if (data.done) onDone();
          if (data.error) onError(data.error);
        } catch {}
      }
    }
  }
}

export async function getDocumentPreviewUrl(docId: string) {
  const res = await authFetch(`/documents/${docId}/preview-url`);
  return res.json();
}