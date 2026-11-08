import type { Config } from 'tailwindcss';

/**
 * Semantic design tokens. Every color is a CSS variable defined in
 * `src/styles/theme.css`, which is what makes runtime theme switching and
 * custom accent colors possible without rebuilding Tailwind.
 */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  darkMode: ['class', '[data-theme="dark"]'],
  theme: {
    extend: {
      colors: {
        canvas: 'var(--bg-canvas)',
        surface: 'var(--bg-surface)',
        elevated: 'var(--bg-elevated)',
        overlay: 'var(--bg-overlay)',
        hover: 'var(--bg-hover)',
        active: 'var(--bg-active)',
        border: {
          DEFAULT: 'var(--border-default)',
          subtle: 'var(--border-subtle)',
          strong: 'var(--border-strong)',
        },
        fg: {
          DEFAULT: 'var(--fg-primary)',
          secondary: 'var(--fg-secondary)',
          muted: 'var(--fg-muted)',
          inverted: 'var(--fg-inverted)',
        },
        accent: {
          DEFAULT: 'var(--accent)',
          hover: 'var(--accent-hover)',
          soft: 'var(--accent-soft)',
          fg: 'var(--accent-fg)',
        },
        success: 'var(--success)',
        warning: 'var(--warning)',
        danger: 'var(--danger)',
        info: 'var(--info)',
        'graph-1': 'var(--graph-1)',
        'graph-2': 'var(--graph-2)',
        'graph-3': 'var(--graph-3)',
        'graph-4': 'var(--graph-4)',
        'graph-5': 'var(--graph-5)',
        'graph-6': 'var(--graph-6)',
        'graph-7': 'var(--graph-7)',
        'graph-8': 'var(--graph-8)',
        'graph-9': 'var(--graph-9)',
        'graph-10': 'var(--graph-10)',
        'diff-add': 'var(--diff-add)',
        'diff-add-bg': 'var(--diff-add-bg)',
        'diff-del': 'var(--diff-del)',
        'diff-del-bg': 'var(--diff-del-bg)',
      },
      fontFamily: {
        sans: [
          'Inter',
          'Segoe UI Variable Text',
          'Segoe UI',
          'system-ui',
          '-apple-system',
          'PingFang SC',
          'Microsoft YaHei UI',
          'Microsoft YaHei',
          'sans-serif',
        ],
        mono: [
          'JetBrains Mono',
          'Cascadia Code',
          'Cascadia Mono',
          'Consolas',
          'SFMono-Regular',
          'Menlo',
          'monospace',
        ],
      },
      fontSize: {
        '2xs': ['10px', '14px'],
      },
      borderRadius: {
        xs: '3px',
        sm: '5px',
        DEFAULT: '6px',
        md: '8px',
        lg: '10px',
        xl: '14px',
      },
      boxShadow: {
        panel: '0 1px 2px rgba(0, 0, 0, 0.18)',
        pop: '0 12px 32px rgba(0, 0, 0, 0.34), 0 2px 8px rgba(0, 0, 0, 0.24)',
        modal: '0 24px 64px rgba(0, 0, 0, 0.42), 0 4px 16px rgba(0, 0, 0, 0.28)',
      },
      keyframes: {
        'fade-in': {
          from: { opacity: '0' },
          to: { opacity: '1' },
        },
        'scale-in': {
          from: { opacity: '0', transform: 'scale(0.97) translateY(4px)' },
          to: { opacity: '1', transform: 'scale(1) translateY(0)' },
        },
        'slide-in-right': {
          from: { opacity: '0', transform: 'translateX(12px)' },
          to: { opacity: '1', transform: 'translateX(0)' },
        },
        shimmer: {
          '0%': { backgroundPosition: '-400px 0' },
          '100%': { backgroundPosition: '400px 0' },
        },
      },
      animation: {
        'fade-in': 'fade-in 120ms ease-out',
        'scale-in': 'scale-in 140ms cubic-bezier(0.16, 1, 0.3, 1)',
        'slide-in-right': 'slide-in-right 160ms cubic-bezier(0.16, 1, 0.3, 1)',
      },
    },
  },
  plugins: [],
} satisfies Config;
