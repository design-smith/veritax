"use client";

import { useEffect, useState } from "react";
import type { ReactNode } from "react";
import { TopBar } from "@/components/shell/top-bar";
import { AskRecord } from "@/components/ask/ask-record";
import { shouldToggleAskFromKeyboardEvent } from "@/components/shell/ask-shortcuts";

export function DemoShellClient({ children }: { children: ReactNode }) {
  const [askOpen, setAskOpen] = useState(false);

  useEffect(() => {
    function handle(e: KeyboardEvent) {
      if (shouldToggleAskFromKeyboardEvent(e)) {
        e.preventDefault();
        setAskOpen((o) => !o);
      }
    }
    window.addEventListener("keydown", handle);
    return () => window.removeEventListener("keydown", handle);
  }, []);

  return (
    <div className="flex flex-1 flex-col overflow-hidden">
      <TopBar onAskOpen={() => setAskOpen(true)} />
      <main className="flex-1 overflow-auto">{children}</main>
      <AskRecord open={askOpen} onClose={() => setAskOpen(false)} />
    </div>
  );
}
