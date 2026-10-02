import type { Config } from 'tailwindcss'

const config: Config = {
  content: ['./src/**/*.{js,ts,jsx,tsx,mdx}'],
  theme: {
    extend: {
      colors: {
        // UI 2.0 semantic tokens (docs/design/Guía UI LensSpace.dc.html).
        ink: { DEFAULT: '#07322F', 2: '#10463F' },
        action: { DEFAULT: '#0D7A72', hover: '#0A625C', soft: '#E2F4F1' },
        mint: '#35C2A8',
        coral: { DEFAULT: '#FF6B4A', hover: '#FF8466', ink: '#C23C1C', soft: '#FFF0EB' },
        amber: { ink: '#A35A15', soft: '#FFF4E8' },
        text: { DEFAULT: '#1C3A37', muted: '#5F716C' },
        line: '#DCECEA',
        canvas: '#F7FBFA',
        surface: '#FFFFFF',
        // Legacy remaps below stay until the cleanup phase of prp-ui-2-0-design-migration.
        slate: {
          50: '#F7FBFA', 100: '#EEF5F4', 200: '#E3EFED', 300: '#DCECEA',
          400: '#9AABA7', 500: '#5F716C', 600: '#4A5B58', 700: '#324E4A',
          800: '#1C3A37', 900: '#10463F', 950: '#07322F',
        },
        sky: {
          50: '#F0FBF9', 100: '#E2F4F1', 200: '#BDE8E1',
          600: '#128F84', 700: '#0D7A72', 800: '#07322F',
        },
        emerald: {
          50: '#ECFBF7', 600: '#168F79', 700: '#0D7A72', 800: '#095E57',
        },
        red: {
          50: '#FFF6F2', 200: '#FFD9CD', 600: '#D54A2A',
          700: '#C23C1C', 800: '#9E321B',
        },
      },
      fontFamily: {
        sans: ['var(--font-source-sans)', 'system-ui', 'sans-serif'],
        display: ['var(--font-space-grotesk)', 'system-ui', 'sans-serif'],
      },
      borderRadius: {
        lg: '7px', xl: '7px', '2xl': '10px', '3xl': '10px',
        badge: '6px', control: '10px', card: '14px', panel: '20px',
      },
      boxShadow: {
        sm: '0 1px 3px rgba(7, 50, 47, 0.12)',
        xl: '0 6px 16px rgba(7, 50, 47, 0.14)',
        e1: '0 1px 2px rgba(7, 50, 47, 0.05)',
        e2: '0 10px 28px rgba(7, 50, 47, 0.10)',
        e3: '0 28px 64px rgba(7, 50, 47, 0.22)',
      },
    },
  },
  plugins: [],
}

export default config
