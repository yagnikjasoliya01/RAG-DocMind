"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase";

export default function DebugPage() {
  const [token, setToken] = useState("");

  useEffect(() => {
    async function getToken() {
      const supabase = createClient();
      const { data } = await supabase.auth.getSession();
      setToken(data.session?.access_token || "No session found");
    }
    getToken();
  }, []);

  return (
    <div className="p-8 bg-gray-950 min-h-screen">
      <h1 className="text-white text-xl mb-4">Debug — Access Token</h1>
      <textarea
        className="w-full h-48 bg-gray-800 text-green-400 p-4 rounded text-xs"
        value={token}
        readOnly
      />
      <button
        onClick={() => navigator.clipboard.writeText(token)}
        className="mt-4 bg-blue-600 text-white px-4 py-2 rounded"
      >
        Copy Token
      </button>
    </div>
  );
}