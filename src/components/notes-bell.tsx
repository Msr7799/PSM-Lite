"use client";

import { Bell } from "lucide-react";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

interface Note {
  id: string;
  title: string;
  priority: string;
  isResolved: boolean;
  createdAt: string;
}

export function NotesBell() {
  const [unreadCount, setUnreadCount] = useState(0);
  const router = useRouter();

  useEffect(() => {
    fetchUnreadCount();
    const interval = setInterval(fetchUnreadCount, 30000); // Refresh every 30s
    return () => clearInterval(interval);
  }, []);

  const fetchUnreadCount = async () => {
    try {
      const res = await fetch("/api/notes?isResolved=false");
      if (res.ok) {
        const notes: Note[] = await res.json();
        setUnreadCount(notes.length);
      }
    } catch (error) {
      console.error("Failed to fetch notes count:", error);
    }
  };

  return (
    <button
      onClick={() => router.push("/notes")}
      className="relative p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-md transition-colors"
      title="الملاحظات والتنبيهات"
    >
      <Bell className="w-5 h-5" />
      {unreadCount > 0 && (
        <span className="absolute -top-1 -right-1 bg-red-500 text-white text-xs font-bold rounded-full w-5 h-5 flex items-center justify-center">
          {unreadCount > 9 ? "9+" : unreadCount}
        </span>
      )}
    </button>
  );
}
