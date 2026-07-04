declare const config: {
    darkMode: ["class"];
    content: string[];
    theme: {
        extend: {
            colors: {
                background: string;
                foreground: string;
                border: string;
                input: string;
                ring: string;
                primary: {
                    DEFAULT: string;
                    foreground: string;
                };
                secondary: {
                    DEFAULT: string;
                    foreground: string;
                };
                muted: {
                    DEFAULT: string;
                    foreground: string;
                };
                accent: {
                    DEFAULT: string;
                    foreground: string;
                };
                card: {
                    DEFAULT: string;
                    foreground: string;
                };
            };
            fontFamily: {
                sans: [string, string, string];
                mono: [string, string, string];
            };
            boxShadow: {
                glow: string;
            };
            keyframes: {
                "particle-drift": {
                    "0%": {
                        transform: string;
                    };
                    "100%": {
                        transform: string;
                    };
                };
            };
            animation: {
                "particle-drift": string;
            };
        };
    };
    plugins: {
        handler: () => void;
    }[];
};
export default config;
