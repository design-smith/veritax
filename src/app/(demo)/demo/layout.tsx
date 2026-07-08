import type { ReactNode } from "react";
import { FileText } from "lucide-react";
import { DemoNav } from "@/components/demo/demo-nav";
import { DemoShellClient } from "@/components/demo/demo-shell-client";

export default function DemoLayout({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-[100dvh]">
      <aside className="sticky top-0 flex h-[100dvh] w-14 shrink-0 flex-col border-r border-sidebar-border bg-sidebar text-sidebar-foreground tablet:w-52">
        <div className="flex h-14 items-center border-b border-border px-3">
          <FileText className="h-5 w-5 shrink-0 text-sidebar-primary" />
          <span className="ml-2 hidden text-sm font-semibold tracking-tight tablet:inline">
            Veritax
          </span>
        </div>
        <div className="flex-1 overflow-y-auto p-2">
          <DemoNav />
        </div>
      </aside>
      <DemoShellClient>{children}</DemoShellClient>
    </div>
  );
}
