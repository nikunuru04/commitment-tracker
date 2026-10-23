/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      fontFamily: {
        sans: ["Poppins", "ui-sans-serif", "system-ui", "sans-serif"],
      },
      colors: {
        // Reference-extracted palette
        blush: {
          50: "#FDF1F6",
          100: "#FBE3ED",
          150: "#FAD9E7",
          200: "#F7C9DC",
          300: "#F3AECC",
          400: "#EE8FB4",
          500: "#E5769F",
          600: "#DB6390",
          700: "#C94F7C",
          800: "#A63A62",
          900: "#7E2B4A",
        },
        ink: "#3B2B33",
        mauve: "#8A6B77",
        sage: {
          50: "#F0FAF2",
          100: "#E3F3E6",
          500: "#37A24C",
          600: "#2F9E44",
          700: "#2B8A3E",
        },
        sky: {
          50: "#EDF6FD",
          100: "#DCEBFA",
          500: "#3B8FD4",
          600: "#1C7ED6",
          700: "#1971C2",
        },
        sun: {
          100: "#FCF0CE",
          500: "#E0A92E",
          600: "#B08121",
        },
      },
      borderRadius: {
        box: "1rem",
        btn: "0.75rem",
        badge: "0.5rem",
      },
      boxShadow: {
        soft: "0 2px 10px rgba(126,43,74,0.06)",
        card: "0 4px 16px rgba(126,43,74,0.05)",
      },
    },
  },
  plugins: [require("daisyui")],
  daisyui: {
    themes: [
      {
        roseblush: {
          primary: "#E5769F",
          "primary-content": "#FFFFFF",
          secondary: "#A78BBA",
          "secondary-content": "#FFFFFF",
          accent: "#3B8FD4",
          "accent-content": "#FFFFFF",
          neutral: "#3B2B33",
          "neutral-content": "#FDF1F6",
          "base-100": "#FFFFFF",
          "base-200": "#FDF1F6",
          "base-300": "#F7C9DC",
          "base-content": "#3B2B33",
          success: "#2F9E44",
          "success-content": "#FFFFFF",
          warning: "#B08121",
          "warning-content": "#3B2B33",
          error: "#D6455D",
          "error-content": "#FFFFFF",
          info: "#1C7ED6",
          "info-content": "#FFFFFF",
          "--rounded-box": "1rem",
          "--rounded-btn": "0.75rem",
          "--rounded-badge": "0.5rem",
        },
      },
    ],
  },
};
