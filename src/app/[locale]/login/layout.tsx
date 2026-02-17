import type { ReactNode } from "react";

interface Props {
  children: ReactNode;
  params: Promise<{ locale: string }>;
}

export default async function LoginLayout({ children, params }: Props) {
  // We strictly await params to satisfy Next.js 15+ patterns, even if unused here.
  await params;

  return (
    <main className="min-h-screen bg-slate-50 text-slate-900 dark:bg-slate-950 dark:text-slate-100">
      {children}
    </main>
  );
}
