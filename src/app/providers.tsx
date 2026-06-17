"use client";

import { Provider as JotaiProvider } from "jotai";
import { ChartThemeProvider } from "@/components/providers/chart-theme-provider";
import { ModeThemeProvider } from "@/components/providers/mode-theme-provider";
import { PermissionsProvider } from "@/contexts/permissions-context";
import { FYLensProvider } from "@/contexts/fy-lens-context";

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <JotaiProvider>
      <ModeThemeProvider
        attribute="class"
        defaultTheme="system"
        enableSystem
        disableTransitionOnChange
      >
        <ChartThemeProvider>
          {/* Default role: manager — will be driven by auth session in production */}
          <PermissionsProvider role="manager">
            <FYLensProvider>{children}</FYLensProvider>
          </PermissionsProvider>
        </ChartThemeProvider>
      </ModeThemeProvider>
    </JotaiProvider>
  );
}
