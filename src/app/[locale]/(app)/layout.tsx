import { SidebarProvider, SidebarInset, SidebarTrigger } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/app-sidebar";
import { NotesBell } from "@/components/notes-bell";
import { ThemeInit } from "@/components/theme-init";

export default function AppLayout({ children }: { children: React.ReactNode }) {
    return (
        <SidebarProvider>
            <ThemeInit />
            <AppSidebar />
            <SidebarInset className="bg-slate-50 dark:bg-slate-950 overflow-hidden flex flex-col h-screen">
                <header className="flex h-16 shrink-0 items-center gap-2 border-b bg-background px-4 shadow-sm z-10">
                    <SidebarTrigger className="-ml-1" />
                    <div className="mr-2 h-4 w-px bg-border/40" />
                    <div className="flex-1" />
                    <NotesBell />
                </header>
                <div className="flex-1 overflow-auto p-4 md:p-6 lg:p-8">
                    <main className="mx-auto max-w-7xl animate-in fade-in space-y-4">
                        {children}
                    </main>
                    <footer className="mt-8 text-center text-xs text-muted-foreground py-4">
                        PMS Lite © 2026 - Secure Property Management System
                        Made with 💙 by The developer Mohamed Alromaihi
                    </footer>
                </div>
            </SidebarInset>
        </SidebarProvider>
    );
}
