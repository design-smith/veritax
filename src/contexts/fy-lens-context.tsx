"use client";

import {
  cloneElement,
  createContext,
  useContext,
  useState,
  type HTMLAttributes,
  type ReactElement,
  type ReactNode,
} from "react";
import { Info } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";

const CURRENT_FY = `FY${new Date().getFullYear()}`;

interface FYLensContextValue {
  fy: string;
  period: string | null;
  isPast: boolean;
  setFY: (fy: string) => void;
  setPeriod: (period: string | null) => void;
}

const FYLensContext = createContext<FYLensContextValue | null>(null);

export function FYLensProvider({ children }: { children: ReactNode }) {
  const [fy, setFYState] = useState(CURRENT_FY);
  const [period, setPeriod] = useState<string | null>(null);

  const currentYear = new Date().getFullYear();
  const lensYear = parseInt(fy.replace("FY", ""), 10);
  const isPast = !isNaN(lensYear) && lensYear < currentYear;

  const setFY = (next: string) => setFYState(next);

  return (
    <FYLensContext.Provider value={{ fy, period, isPast, setFY, setPeriod }}>
      {children}
    </FYLensContext.Provider>
  );
}

export function useFYLens(): FYLensContextValue {
  const ctx = useContext(FYLensContext);
  if (!ctx) throw new Error("useFYLens must be used inside FYLensProvider");
  return ctx;
}

export function useSealedMutationGuard() {
  const { fy, isPast } = useFYLens();

  return {
    disabled: isPast,
    reason: `${fy} is sealed. Open the current FY to act.`,
  };
}

export function SealedMutationGuard({ children }: { children: ReactElement }) {
  const { disabled, reason } = useSealedMutationGuard();

  if (!disabled) return children;

  return (
    <span title={reason}>
      {cloneElement(children, {
        disabled: true,
        "aria-disabled": true,
      } as HTMLAttributes<HTMLElement>)}
    </span>
  );
}

// ── PastFYBanner ─────────────────────────────────────────────────────────────

export function PastFYBanner() {
  const { fy, isPast } = useFYLens();

  if (!isPast) return null;

  return (
    <Alert role="alert" className="rounded-none border-x-0 border-t-0 border-transparent bg-warning-soft text-warning-soft-foreground">
      <Info className="h-4 w-4 text-warning-soft-foreground dark:text-warning-soft-foreground" />
      <AlertDescription>
        Viewing {fy} · records as filed/known.{" "}
        <span className="font-medium">
          {fy} is sealed — all mutation controls are disabled.
        </span>
        {/* Knowledge-time toggle hidden until PRD-02 v1 ships */}
      </AlertDescription>
    </Alert>
  );
}
