"use client";

import * as React from "react";
import { AppSidebar } from "@/components/app-sidebar";

export default function AppShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen w-full bg-gradient-to-b from-slate-950 via-slate-950 to-slate-900 text-slate-100">
      <AppSidebar />

      <div className="min-w-0 flex-1 p-4">
        {children}

        <div className="mt-10 pb-6 text-center text-xs text-slate-500">
          Local-only (no auth). Add auth before public hosting.
        </div>
      </div>
    </div>
  );
}
