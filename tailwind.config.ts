import type { Config } from "tailwindcss";
import tailwindcssAnimate from "tailwindcss-animate";
import colors from "tailwindcss/colors";

export default {
  darkMode: ["class"],
  content: ["./pages/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}", "./app/**/*.{ts,tsx}", "./src/**/*.{ts,tsx}"],
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
      colors: {
        border: "hsl(var(--border))",
        input: "hsl(var(--input))",
        ring: "hsl(var(--ring))",
        background: "hsl(var(--background))",
        foreground: "hsl(var(--foreground))",
        primary: {
          DEFAULT: "hsl(var(--primary))",
          foreground: "hsl(var(--primary-foreground))",
        },
        secondary: {
          DEFAULT: "hsl(var(--secondary))",
          foreground: "hsl(var(--secondary-foreground))",
        },
        destructive: {
          DEFAULT: "hsl(var(--destructive))",
          foreground: "hsl(var(--destructive-foreground))",
        },
        muted: {
          DEFAULT: "hsl(var(--muted))",
          foreground: "hsl(var(--muted-foreground))",
        },
        accent: {
          DEFAULT: "hsl(var(--accent))",
          foreground: "hsl(var(--accent-foreground))",
        },
        popover: {
          DEFAULT: "hsl(var(--popover))",
          foreground: "hsl(var(--popover-foreground))",
        },
        card: {
          DEFAULT: "hsl(var(--card))",
          foreground: "hsl(var(--card-foreground))",
        },
        sidebar: {
          DEFAULT: "hsl(var(--sidebar-background))",
          foreground: "hsl(var(--sidebar-foreground))",
          primary: "hsl(var(--sidebar-primary))",
          "primary-foreground": "hsl(var(--sidebar-primary-foreground))",
          accent: "hsl(var(--sidebar-accent))",
          "accent-foreground": "hsl(var(--sidebar-accent-foreground))",
          border: "hsl(var(--sidebar-border))",
          ring: "hsl(var(--sidebar-ring))",
        },
        // Section accents. `text-amber` uses the theme token; `text-amber-500` etc.
        // still work because the full Tailwind scale is kept alongside DEFAULT.
        coral: { DEFAULT: "hsl(var(--coral))" },
        teal: { ...colors.teal, DEFAULT: "hsl(var(--teal))" },
        violet: { ...colors.violet, DEFAULT: "hsl(var(--violet))" },
        amber: { ...colors.amber, DEFAULT: "hsl(var(--amber))" },
        sky: { ...colors.sky, DEFAULT: "hsl(var(--sky))" },
        // Life areas — the ring colors on Today (Habits, Tasks, Move, People).
        habits: "hsl(var(--habits))",
        tasks: "hsl(var(--tasks))",
        move: "hsl(var(--move))",
        people: "hsl(var(--people))",
        // Status meanings — use these instead of raw green/amber/red.
        success: { DEFAULT: "hsl(var(--success))", foreground: "hsl(var(--success-foreground))" },
        warning: { DEFAULT: "hsl(var(--warning))", foreground: "hsl(var(--warning-foreground))" },
        info: { DEFAULT: "hsl(var(--info))", foreground: "hsl(var(--info-foreground))" },
      },
      borderRadius: {
        lg: "calc(var(--radius) - 4px)",
        md: "calc(var(--radius) - 6px)",
        sm: "calc(var(--radius) - 8px)",
      },
      // Type scale (iOS-inspired). Use these instead of ad-hoc text sizes.
      fontSize: {
        "large-title": ["2rem", { lineHeight: "2.375rem", letterSpacing: "-0.025em", fontWeight: "700" }],
        title: ["1.375rem", { lineHeight: "1.75rem", letterSpacing: "-0.018em", fontWeight: "700" }],
        headline: ["1.0625rem", { lineHeight: "1.375rem", letterSpacing: "-0.01em", fontWeight: "600" }],
        body: ["0.9375rem", { lineHeight: "1.375rem", letterSpacing: "-0.005em" }],
        footnote: ["0.8125rem", { lineHeight: "1.125rem" }],
        caption: ["0.75rem", { lineHeight: "1rem" }],
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
