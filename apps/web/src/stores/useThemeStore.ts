import { create } from 'zustand';

export type ThemeMode = 'light' | 'dark' | 'system';

interface ThemeState {
  theme: ThemeMode;
  resolvedTheme: 'light' | 'dark';
  setTheme: (theme: ThemeMode) => void;
  toggleTheme: () => void;
}

function resolveSystemTheme(): 'light' | 'dark' {
  if (typeof window === 'undefined') return 'light';
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}

function applyThemeClass(theme: 'light' | 'dark'): void {
  if (typeof document === 'undefined') return;
  const root = document.documentElement;
  if (theme === 'dark') {
    root.classList.add('dark');
  } else {
    root.classList.remove('dark');
  }
}

export const useThemeStore = create<ThemeState>((set, get) => {
  const initialTheme: ThemeMode =
    typeof localStorage !== 'undefined'
      ? (localStorage.getItem('restaurant_os_theme') as ThemeMode) || 'dark'
      : 'dark';

  const resolved = initialTheme === 'system' ? resolveSystemTheme() : initialTheme;
  applyThemeClass(resolved);

  return {
    theme: initialTheme,
    resolvedTheme: resolved,
    setTheme: (newTheme) => {
      const active = newTheme === 'system' ? resolveSystemTheme() : newTheme;
      if (typeof localStorage !== 'undefined') {
        localStorage.setItem('restaurant_os_theme', newTheme);
      }
      applyThemeClass(active);
      set({ theme: newTheme, resolvedTheme: active });
    },
    toggleTheme: () => {
      const current = get().resolvedTheme;
      const next = current === 'dark' ? 'light' : 'dark';
      get().setTheme(next);
    },
  };
});
