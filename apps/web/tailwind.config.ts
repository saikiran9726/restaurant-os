import type { Config } from 'tailwindcss';

export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  darkMode: 'class',
  theme: {
    extend: {
      spacing: {
        // 4-pt grid system explicitly mapped
        '0.5': '2px',
        '1': '4px',
        '1.5': '6px',
        '2': '8px',
        '2.5': '10px',
        '3': '12px',
        '3.5': '14px',
        '4': '16px',
        '5': '20px',
        '6': '24px',
        '7': '28px',
        '8': '32px',
        '9': '36px',
        '10': '40px',
        '11': '44px',
        '12': '48px', // touch-target min
        '14': '56px',
        '16': '64px',
        '20': '80px',
        '24': '96px',
      },
      borderRadius: {
        DEFAULT: '8px',
        sm: '4px',
        md: '8px',
        lg: '12px',
        xl: '16px',
        full: '9999px',
      },
      fontSize: {
        // Standard type scale: 14 / 16 / 18 / 22 / 28 / 40
        caption: ['var(--text-14, 0.875rem)', { lineHeight: '1.25rem' }],
        body: ['var(--text-16, 1rem)', { lineHeight: '1.5rem' }],
        subhead: ['var(--text-18, 1.125rem)', { lineHeight: '1.625rem' }],
        title: ['var(--text-22, 1.375rem)', { lineHeight: '1.75rem' }],
        headline: ['var(--text-28, 1.75rem)', { lineHeight: '2.125rem' }],
        display: ['var(--text-40, 2.5rem)', { lineHeight: '2.875rem' }],
      },
      colors: {
        // Accent token (configurable via single --color-accent token, default deep teal)
        accent: {
          DEFAULT: 'var(--color-accent, #0f766e)',
          hover: 'var(--color-accent-hover, #115e59)',
          active: 'var(--color-accent-active, #134e4a)',
          light: 'var(--color-accent-light, #ccfbf1)',
          foreground: 'var(--color-accent-foreground, #ffffff)',
        },
        // Semantic Order & Kitchen Statuses
        status: {
          new: 'var(--color-status-new, #2563eb)',
          preparing: 'var(--color-status-preparing, #d97706)',
          ready: 'var(--color-status-ready, #16a34a)',
          late: 'var(--color-status-late, #ea580c)',
          overdue: 'var(--color-status-overdue, #dc2626)',
        },
        // Food identity
        veg: {
          DEFAULT: 'var(--color-veg, #15803d)',
          bg: 'var(--color-veg-bg, #f0fdf4)',
        },
        nonveg: {
          DEFAULT: 'var(--color-nonveg, #b91c1c)',
          bg: 'var(--color-nonveg-bg, #fef2f2)',
        },
        // General state
        success: {
          DEFAULT: 'var(--color-success, #16a34a)',
          foreground: '#ffffff',
        },
        warning: {
          DEFAULT: 'var(--color-warning, #d97706)',
          foreground: '#ffffff',
        },
        danger: {
          DEFAULT: 'var(--color-danger, #dc2626)',
          foreground: '#ffffff',
        },
        // App canvas & surfaces
        surface: {
          canvas: 'var(--bg-canvas)',
          card: 'var(--bg-card)',
          elevated: 'var(--bg-elevated)',
          border: 'var(--border-subtle)',
          'border-strong': 'var(--border-strong)',
        },
        content: {
          primary: 'var(--text-primary)',
          secondary: 'var(--text-secondary)',
          muted: 'var(--text-muted)',
          inverse: 'var(--text-inverse)',
        },
      },
      transitionDuration: {
        press: 'var(--duration-press, 80ms)',
        sheet: 'var(--duration-sheet, 200ms)',
        toast: 'var(--duration-toast, 200ms)',
      },
    },
  },
  plugins: [],
} satisfies Config;
