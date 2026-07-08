"use client";

import type { ReactNode } from "react";
import { Provider as JotaiProvider } from "jotai";
import { ChartThemeProvider } from "@/components/providers/chart-theme-provider";
import { ModeThemeProvider } from "@/components/providers/mode-theme-provider";
import { PermissionsProvider } from "@/contexts/permissions-context";
import { FYLensProvider } from "@/contexts/fy-lens-context";
import { AppFrameProvider } from "@/contexts/app-frame-context";

export function Providers({ children }: { children: ReactNode }) {
  return (
    <JotaiProvider>
      <ModeThemeProvider
        attribute="data-theme"
        defaultTheme="system"
        enableSystem
        disableTransitionOnChange
      >
        <ChartThemeProvider>
          {/* Default role: manager until auth session owns this. */}
          <PermissionsProvider role="manager">
            <FYLensProvider>
              <AppFrameProvider>{children}</AppFrameProvider>
            </FYLensProvider>
          </PermissionsProvider>
        </ChartThemeProvider>
      </ModeThemeProvider>
    </JotaiProvider>
  );
}
