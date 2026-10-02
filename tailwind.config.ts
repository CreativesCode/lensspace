import type { Config } from 'tailwindcss'

const config: Config = {
  content: ['./src/**/*.{js,ts,jsx,tsx,mdx}'],
  theme: {
    extend: {
      colors: {
        // UI 2.0 semantic tokens (docs/design/Guía UI LensSpace.dc.html).
        ink: { DEFAULT: '#07322F', 2: '#10463F' },
        action: { DEFAULT: '#0D7A72', hover: '#0A625C', soft: '#E2F4F1', tint: '#F0FBF9', wash: '#F7FDFC' },
        mint: { DEFAULT: '#35C2A8', hover: '#5DD3BD' },
        coral: {
          DEFAULT: '#FF6B4A', hover: '#FF8466', ink: '#C23C1C', strong: '#B2361A', deep: '#7A3A26',
          soft: '#FFF0EB', tint: '#FFF6F2', wash: '#FFE8E1', line: '#FFD9CD', field: '#FFFAF8', night: '#4A1507',
        },
        amber: { ink: '#A35A15', soft: '#FFF4E8', dot: '#E39A3B', line: '#F6D9B3', deep: '#8F4C0F', strong: '#7A4510' },
        success: { ink: '#07655C', soft: '#D9F5EE', tint: '#E9FAF5', line: '#A9E6D7' },
        progress: { ink: '#0B5A53' },
        neutral: { soft: '#EEF3F2' },
        text: { DEFAULT: '#1C3A37', secondary: '#4A5B58', label: '#324E4A', muted: '#5F716C', placeholder: '#8A9A96', disabled: '#9AABA7' },
        line: { DEFAULT: '#DCECEA', soft: '#EEF5F4', card: '#E3EFED', strong: '#CFE3E0', hover: '#9BCDC6', focus: '#B9DFD9', faint: '#F2F7F6' },
        // Text and strokes placed on the ink surface (featured header, sidebar, login panel).
        'on-ink': { text: '#E6F5F3', soft: '#D8F0ED', eyebrow: '#7FD8C8', body: '#B9DDD7', muted: '#A7CFC9', subtle: '#7FB3AC', stroke: '#2B5E58', line: '#16544C' },
        canvas: '#F7FBFA',
        field: '#FBFEFD',
        surface: '#FFFFFF',
      },
      fontFamily: {
        sans: ['var(--font-source-sans)', 'system-ui', 'sans-serif'],
        display: ['var(--font-space-grotesk)', 'system-ui', 'sans-serif'],
      },
      borderRadius: {
        badge: '6px', control: '10px', card: '14px', panel: '20px',
      },
      boxShadow: {
        e1: '0 1px 2px rgba(7, 50, 47, 0.05)',
        e2: '0 10px 28px rgba(7, 50, 47, 0.10)',
        e3: '0 28px 64px rgba(7, 50, 47, 0.22)',
      },
    },
  },
  plugins: [],
}

export default config
