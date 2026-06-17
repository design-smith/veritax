import { LeftRail } from "@/components/shell/left-rail";
import { TopBar } from "@/components/shell/top-bar";
import { PastFYBanner } from "@/contexts/fy-lens-context";

export default function DesignSystemLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-[100dvh]">
      <LeftRail />
      <div className="flex flex-1 flex-col overflow-hidden">
        <TopBar />
        <PastFYBanner />
        <main className="flex-1 overflow-auto">{children}</main>
      </div>
    </div>
  );
}
