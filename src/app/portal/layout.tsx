import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Veritax Portal",
  description: "External reviewer portal",
};

/** Minimal portal layout — no shell rail or top bar. Separate auth context. */
export default function PortalLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-background">
      {/* Minimal header — no nav rail, no Ask overlay */}
      <header className="flex h-12 items-center border-b border-border bg-background px-6">
        <span className="text-sm font-semibold text-muted-foreground">Veritax · External Portal</span>
      </header>
      <main className="mx-auto max-w-4xl px-6 py-8">{children}</main>
    </div>
  );
}
