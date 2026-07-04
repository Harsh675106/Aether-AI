import animate from "tailwindcss-animate";
var config = {
    darkMode: ["class"],
    content: ["./index.html", "./src/**/*.{ts,tsx}"],
    theme: {
        extend: {
            colors: {
                background: "hsl(var(--background))",
                foreground: "hsl(var(--foreground))",
                border: "hsl(var(--border))",
                input: "hsl(var(--input))",
                ring: "hsl(var(--ring))",
                primary: {
                    DEFAULT: "hsl(var(--primary))",
                    foreground: "hsl(var(--primary-foreground))",
                },
                secondary: {
                    DEFAULT: "hsl(var(--secondary))",
                    foreground: "hsl(var(--secondary-foreground))",
                },
                muted: {
                    DEFAULT: "hsl(var(--muted))",
                    foreground: "hsl(var(--muted-foreground))",
                },
                accent: {
                    DEFAULT: "hsl(var(--accent))",
                    foreground: "hsl(var(--accent-foreground))",
                },
                card: {
                    DEFAULT: "hsl(var(--card))",
                    foreground: "hsl(var(--card-foreground))",
                },
            },
            fontFamily: {
                sans: ["Inter", "ui-sans-serif", "system-ui"],
                mono: ["JetBrains Mono", "ui-monospace", "SFMono-Regular"],
            },
            boxShadow: {
                glow: "0 0 40px rgba(45, 212, 191, 0.2)",
            },
            keyframes: {
                "particle-drift": {
                    "0%": { transform: "translate3d(0, 0, 0)" },
                    "100%": { transform: "translate3d(-120px, 90px, 0)" },
                },
            },
            animation: {
                "particle-drift": "particle-drift 24s linear infinite alternate",
            },
        },
    },
    plugins: [animate],
};
export default config;
