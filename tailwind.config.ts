import type { Config } from "tailwindcss";
import tailwindcssAnimate from "tailwindcss-animate";
import { fontFamily } from "tailwindcss/defaultTheme";

const oklch = (name: string) => `oklch(var(${name}) / <alpha-value>)`;

const config = {
  darkMode: ["class"],
  content: [
    "./pages/**/*.{ts,tsx}",
    "./components/**/*.{ts,tsx}",
    "./app/**/*.{ts,tsx}",
    "./src/**/*.{ts,tsx}",
  ],
  prefix: "",
  theme: {
    container: {
      center: true,
      padding: "2rem",
      screens: {
        "2xl": "1400px",
      },
    },
    extend: {
      fontFamily: {
        sans: ["var(--font-instrument)", "Instrument Sans", ...fontFamily.sans],
        display: ["var(--font-instrument-serif)", "Instrument Serif", "Georgia", ...fontFamily.serif],
        mono: ["var(--font-jetbrains)", "JetBrains Mono", ...fontFamily.mono],
      },
      screens: {
        phone: "370px",
        tablet: "750px",
        laptop: "1000px",
        desktop: "1200px",
      },
      colors: {
        border: oklch("--border"),
        input: oklch("--input"),
        ring: oklch("--ring"),
        background: oklch("--background"),
        foreground: oklch("--foreground"),
        primary: {
          DEFAULT: oklch("--primary"),
          foreground: oklch("--primary-foreground"),
        },
        secondary: {
          DEFAULT: oklch("--secondary"),
          foreground: oklch("--secondary-foreground"),
        },
        destructive: {
          DEFAULT: oklch("--destructive"),
          foreground: oklch("--destructive-foreground"),
        },
        muted: {
          DEFAULT: oklch("--muted"),
          foreground: oklch("--muted-foreground"),
        },
        accent: {
          DEFAULT: oklch("--accent"),
          foreground: oklch("--accent-foreground"),
        },
        popover: {
          DEFAULT: oklch("--popover"),
          foreground: oklch("--popover-foreground"),
        },
        card: {
          DEFAULT: oklch("--card"),
          foreground: oklch("--card-foreground"),
        },
        chart: {
          1: oklch("--chart-1"),
          2: oklch("--chart-2"),
          3: oklch("--chart-3"),
          4: oklch("--chart-4"),
          5: oklch("--chart-5"),
        },
        sidebar: {
          DEFAULT: oklch("--sidebar"),
          foreground: oklch("--sidebar-foreground"),
          primary: oklch("--sidebar-primary"),
          "primary-foreground": oklch("--sidebar-primary-foreground"),
          accent: oklch("--sidebar-accent"),
          "accent-foreground": oklch("--sidebar-accent-foreground"),
          border: oklch("--sidebar-border"),
          ring: oklch("--sidebar-ring"),
        },
      },
      borderRadius: {
        lg: "var(--radius)",
        md: "calc(var(--radius) - 2px)",
        sm: "calc(var(--radius) - 4px)",
      },
      keyframes: {
        "accordion-down": {
          from: { height: "0" },
          to: { height: "var(--radix-accordion-content-height)" },
        },
        "accordion-up": {
          from: { height: "var(--radix-accordion-content-height)" },
          to: { height: "0" },
        },
      },
      animation: {
        "accordion-down": "accordion-down 0.2s ease-out",
        "accordion-up": "accordion-up 0.2s ease-out",
      },
    },
  },
  plugins: [tailwindcssAnimate],
} satisfies Config;

export default config;
