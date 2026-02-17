import { NextIntlClientProvider } from 'next-intl';
import { getMessages, getTranslations } from 'next-intl/server';
import "../globals.css";
import { SidebarProvider, SidebarInset, SidebarTrigger } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/app-sidebar";

export const metadata = {
  title: "PMS Lite",
  description: "Simple PMS with iCal sync",
};

interface Props {
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
}

export default async function LocaleLayout({ children, params }: Props) {
  const { locale } = await params;
  const messages = await getMessages();

  // No need for t() here as navigation is moved to AppSidebar

  return (
    <html lang={locale} dir={locale === 'ar' ? 'rtl' : 'ltr'}>
      <body className="min-h-screen bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 font-sans antialiased overflow-hidden">
        <NextIntlClientProvider messages={messages}>
          <SidebarProvider>
            <AppSidebar />
            <SidebarInset className="bg-slate-50 dark:bg-slate-950 overflow-hidden flex flex-col h-screen">
              <header className="flex h-16 shrink-0 items-center gap-2 border-b bg-background px-4 shadow-sm z-10">
                <SidebarTrigger className="-ml-1" />
                <div className="mr-2 h-4 w-px bg-border/40" />
                {/* We can add breadcrumbs or page title here later */}
                <div className="flex-1" />
              </header>
              <div className="flex-1 overflow-auto p-4 md:p-6 lg:p-8">
                <main className="mx-auto max-w-7xl animate-in fade-in space-y-4">
                  {children}
                </main>
                <footer className="mt-8 text-center text-xs text-muted-foreground py-4">
                  Local-only (no auth). Add auth before public hosting 🙂
                </footer>
              </div>
            </SidebarInset>
          </SidebarProvider>
        </NextIntlClientProvider>
      </body>
    </html>
  );
}

