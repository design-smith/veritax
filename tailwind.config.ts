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
        sans: ["var(--font-sans)", ...fontFamily.sans],
        display: ["var(--font-sans)", ...fontFamily.sans],
        mono: ["var(--font-mono)", ...fontFamily.mono],
      },
      screens: {
        phone: "370px",
        tablet: "750px",
        laptop: "1000px",
        desktop: "1200px",
      },
      colors: {
        border: oklch("--border"),
        "border-subtle": oklch("--border-subtle"),
        "border-strong": oklch("--border-strong"),
        input: oklch("--input"),
        ring: oklch("--ring"),
        background: oklch("--background"),
        foreground: oklch("--foreground"),
        default: {
          foreground: oklch("--foreground"),
        },
        surface: {
          DEFAULT: oklch("--surface"),
          secondary: oklch("--surface-secondary"),
          tertiary: oklch("--surface-tertiary"),
          elevated: oklch("--surface-elevated"),
        },
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
        danger: {
          DEFAULT: oklch("--danger"),
          foreground: oklch("--danger-foreground"),
          soft: oklch("--danger-soft"),
          "soft-foreground": oklch("--danger-soft-foreground"),
        },
        info: {
          DEFAULT: oklch("--info"),
          foreground: oklch("--info-foreground"),
          soft: oklch("--info-soft"),
          "soft-foreground": oklch("--info-soft-foreground"),
        },
        success: {
          DEFAULT: oklch("--success"),
          foreground: oklch("--success-foreground"),
          soft: oklch("--success-soft"),
          "soft-foreground": oklch("--success-soft-foreground"),
        },
        warning: {
          DEFAULT: oklch("--warning"),
          foreground: oklch("--warning-foreground"),
          soft: oklch("--warning-soft"),
          "soft-foreground": oklch("--warning-soft-foreground"),
        },
        discovery: {
          DEFAULT: oklch("--discovery"),
          foreground: oklch("--discovery-foreground"),
          soft: oklch("--discovery-soft"),
          "soft-foreground": oklch("--discovery-soft-foreground"),
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
