"use client";

import { useEffect, useState } from "react";
import { LeftRail } from "@/components/shell/left-rail";
import { TopBar } from "@/components/shell/top-bar";
import { PastFYBanner } from "@/contexts/fy-lens-context";
import { AskRecord } from "@/components/ask/ask-record";
import { mockGateRequests, mockUsers } from "@/lib/mock";

const demoUser = mockUsers[1];
const demoGateCount = mockGateRequests.length;

export default function ShellLayout({ children }: { children: React.ReactNode }) {
  const [askOpen, setAskOpen] = useState(false);

  // ⌘K / Ctrl+K global trigger
  useEffect(() => {
    function handleKey(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        setAskOpen((o) => !o);
      }
    }
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, []);

  return (
    <div className="flex min-h-[100dvh]">
      <LeftRail badges={{ findings: 7, gates: demoGateCount }} />
      <div className="flex flex-1 flex-col overflow-hidden">
        <TopBar
          gateCount={demoGateCount}
          notificationCount={3}
          user={demoUser}
          onAskOpen={() => setAskOpen(true)}
        />
        <PastFYBanner />
        <main className="flex-1 overflow-auto">{children}</main>
      </div>

      <AskRecord open={askOpen} onClose={() => setAskOpen(false)} />
    </div>
  );
}
