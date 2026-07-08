"use client";

import { useTheme } from "next-themes";
import { createContext, useContext, useEffect, useState } from "react";
import { type ITheme, ThemeManager } from "@visactor/vchart";
import { customDarkTheme, customLightTheme } from "@/config/chart-theme";

type ChartTheme = "light" | "dark" | "system";

interface ChartThemeContextI {
  theme: ChartTheme | undefined;
}

export const ChartThemeContext = createContext<ChartThemeContextI>({
  theme: undefined,
});

export function ChartThemeProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const { theme: modeTheme } = useTheme();
  const [theme, setTheme] = useState<ChartTheme>("system");

  useEffect(() => {
    registerTheme();
  }, []);

  useEffect(() => {
    const updateTheme = () => {
      if (modeTheme === "light" || modeTheme === "dark") {
        setTheme(modeTheme);
        ThemeManager.setCurrentTheme(modeTheme);
      } else if (modeTheme === "system") {
        const systemTheme = window.matchMedia("(prefers-color-scheme: dark)")
          .matches
          ? "dark"
          : "light";
        setTheme("system");
        ThemeManager.setCurrentTheme(systemTheme);
      }
    };

    updateTheme();

    const mediaQuery = window.matchMedia("(prefers-color-scheme: dark)");
    const handleChange = () => {
      if (modeTheme === "system") {
        updateTheme();
      }
    };
    mediaQuery.addEventListener("change", handleChange);
    return () => {
      mediaQuery.removeEventListener("change", handleChange);
    };
  }, [modeTheme]);

  return (
    <ChartThemeContext.Provider value={{ theme }}>
      {children}
    </ChartThemeContext.Provider>
  );
}

export function useChartTheme() {
  const context = useContext(ChartThemeContext);
  if (!context) {
    throw new Error("useChartTheme must be used within a ChartThemeProvider");
  }
  return context;
}

const registerTheme = () => {
  const style = window.getComputedStyle(document.documentElement);
  const bodyStyle = window.getComputedStyle(document.body);
  const font =
    style.getPropertyValue("--font-sans").trim() ||
    bodyStyle.fontFamily ||
    "ui-sans-serif, system-ui, sans-serif";
  const chartColor = (token: string) => ["oklch", "(", style.getPropertyValue(token).trim(), ")"].join("");
  const lightTheme: Partial<ITheme> = {
    ...customLightTheme,
    fontFamily: font,
    colorScheme: {
      ...customLightTheme.colorScheme,
      default: [
        chartColor("--chart-1"),
        chartColor("--chart-2"),
        chartColor("--chart-3"),
        chartColor("--chart-4"),
        chartColor("--chart-5"),
      ],
    },
  };
  const darkTheme: Partial<ITheme> = {
    ...customDarkTheme,
    fontFamily: font,
    colorScheme: {
      ...customDarkTheme.colorScheme,
      default: [
        chartColor("--chart-1"),
        chartColor("--chart-2"),
        chartColor("--chart-3"),
        chartColor("--chart-4"),
        chartColor("--chart-5"),
      ],
    },
  };
  ThemeManager.registerTheme("light", lightTheme);
  ThemeManager.registerTheme("dark", darkTheme);
};
