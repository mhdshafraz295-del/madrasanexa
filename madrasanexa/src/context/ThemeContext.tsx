import React, { createContext, useContext, useEffect, useState } from 'react';
import { useLocation } from 'react-router-dom';

type Theme = 'light' | 'dark';

interface ThemeContextType {
  theme: Theme;
  toggleTheme: () => void;
  setTheme: (theme: Theme) => void;
}

const THEME_STORAGE_KEY = 'madrasanexa_theme';

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

/**
 * Checks whether the current route belongs to the system website or public portal.
 * Public/website pages must ALWAYS render strictly in normal Light Mode.
 */
export const isPublicOrWebsitePath = (pathname: string): boolean => {
  if (
    pathname === '/' ||
    pathname.startsWith('/madrasa/') ||
    pathname.startsWith('/alumni/') ||
    pathname.startsWith('/pricing') ||
    pathname.startsWith('/about') ||
    pathname.startsWith('/login') ||
    pathname.startsWith('/register') ||
    pathname.startsWith('/setup-password') ||
    pathname.startsWith('/change-password') ||
    pathname.startsWith('/super-admin/website-content/preview')
  ) {
    return true;
  }
  return false;
};

export const ThemeProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [theme, setThemeState] = useState<Theme>(() => {
    try {
      const stored = localStorage.getItem(THEME_STORAGE_KEY);
      if (stored === 'dark') {
        return 'dark';
      }
      return 'light';
    } catch {
      // Fallback in case of localStorage access issues
    }
    return 'light';
  });

  const location = useLocation();

  useEffect(() => {
    const root = document.documentElement;
    const isPublic = isPublicOrWebsitePath(location.pathname);

    if (isPublic) {
      // System website and public portal routes are ALWAYS strictly Light Mode
      root.classList.remove('dark');
    } else {
      // Admin workspaces (Madrasa Admin, Super Admin) respect the admin dark mode toggle
      if (theme === 'dark') {
        root.classList.add('dark');
      } else {
        root.classList.remove('dark');
      }
    }

    try {
      localStorage.setItem(THEME_STORAGE_KEY, theme);
    } catch {
      // Ignore write errors
    }
  }, [theme, location.pathname]);

  const toggleTheme = () => {
    setThemeState((prev) => (prev === 'light' ? 'dark' : 'light'));
  };

  const setTheme = (newTheme: Theme) => {
    setThemeState(newTheme);
  };

  return (
    <ThemeContext.Provider value={{ theme, toggleTheme, setTheme }}>
      {children}
    </ThemeContext.Provider>
  );
};

export const useTheme = (): ThemeContextType => {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error('useTheme must be used within a ThemeProvider');
  }
  return context;
};
