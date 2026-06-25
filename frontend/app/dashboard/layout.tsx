"use client";

import { useEffect, useState } from "react";
import { useRouter, usePathname } from "next/navigation";
import { createClient } from "@/lib/supabase";
import Link from "next/link";

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const [email, setEmail] = useState("");

  useEffect(() => {
    async function checkAuth() {
      const supabase = createClient();
      const { data } = await supabase.auth.getSession();
      if (!data.session) {
        router.push("/auth/login");
        return;
      }
      setEmail(data.session.user.email || "");
    }
    checkAuth();
  }, [router]);

  async function handleSignOut() {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push("/auth/login");
  }

  return (
    <div className="min-h-screen bg-[#0A0A0F] flex">

      {/* Sidebar */}
      <aside className="w-60 bg-[#111118] border-r border-white/5 flex flex-col">

        {/* Logo */}
        <div className="p-5 border-b border-white/5">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center">
              <span className="text-white text-sm font-bold">D</span>
            </div>
            <span className="text-white font-semibold">DocMind</span>
          </div>
        </div>

        {/* Nav */}
        <nav className="flex-1 p-3 space-y-1">
          <Link
            href="/dashboard/documents"
            className={`flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm transition ${
              pathname === "/dashboard/documents"
                ? "bg-blue-600/20 text-blue-400"
                : "text-gray-400 hover:text-white hover:bg-white/5"
            }`}
          >
            <span>📄</span>
            Documents
          </Link>

          <Link
            href="/dashboard/chat"
            className={`flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm transition ${
              pathname.startsWith("/dashboard/chat")
                ? "bg-blue-600/20 text-blue-400"
                : "text-gray-400 hover:text-white hover:bg-white/5"
            }`}
          >
            <span>💬</span>
            Chat
          </Link>
        </nav>

        {/* User */}
        <div className="p-3 border-t border-white/5">
          <div className="px-3 py-2.5 rounded-xl bg-white/3">
            <p className="text-xs text-gray-500 truncate">{email}</p>
            <button
              onClick={handleSignOut}
              className="text-xs text-red-400 hover:text-red-300 mt-1 transition"
            >
              Sign out
            </button>
          </div>
        </div>

      </aside>

      {/* Main content */}
      <main className="flex-1 overflow-auto">
        {children}
      </main>

    </div>
  );
}