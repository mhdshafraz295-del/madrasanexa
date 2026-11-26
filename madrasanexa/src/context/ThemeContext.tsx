import React, { createContext, useContext, useEffect, useState } from 'react';
import { useLocation } from 'react-router-dom';

type Theme = 'light' | 'dark';

interface ThemeContextType {
  theme: Theme;
  toggleTheme: () => void;
  setTheme: (theme: Theme) => void;
  adminTheme: Theme;
  superAdminTheme: Theme;
}

export const ADMIN_THEME_STORAGE_KEY = 'madrasanexa_admin_theme';
export const SUPER_ADMIN_THEME_STORAGE_KEY = 'madrasanexa_super_admin_theme';

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

export type WorkspaceType = 'madrasa-admin' | 'super-admin' | 'public';

/**
 * Determines the current workspace based on route pathname.
 * - '/super-admin' (except standalone preview) -> Super Admin
 * - '/madrasa-admin' -> Madrasa Admin
 * - Everything else (public madrasa website, admissions, marketing, auth) -> Public
 */
export const getWorkspaceFromPath = (pathname: string): WorkspaceType => {
  if (pathname.startsWith('/super-admin') && pathname !== '/super-admin/website-content/preview') {
    return 'super-admin';
  }
  if (pathname.startsWith('/madrasa-admin')) {
    return 'madrasa-admin';
  }
  return 'public';
};

export const ThemeProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  // Independent theme state for Madrasa Admin
  const [adminTheme, setAdminTheme] = useState<Theme>(() => {
    try {
      const stored = localStorage.getItem(ADMIN_THEME_STORAGE_KEY);
      if (stored === 'dark') return 'dark';
      return 'light';
    } catch {
      return 'light';
    }
  });

  // Independent theme state for Super Admin
  const [superAdminTheme, setSuperAdminTheme] = useState<Theme>(() => {
    try {
      const stored = localStorage.getItem(SUPER_ADMIN_THEME_STORAGE_KEY);
      if (stored === 'dark') return 'dark';
      return 'light';
    } catch {
      return 'light';
    }
  });

  const location = useLocation();
  const workspace = getWorkspaceFromPath(location.pathname);

  // Active theme dynamically matches the current portal
  const currentTheme =
    workspace === 'super-admin'
      ? superAdminTheme
      : workspace === 'madrasa-admin'
      ? adminTheme
      : 'light';

  useEffect(() => {
    const root = document.documentElement;

    if (workspace === 'public') {
      // Public portal and system website pages are ALWAYS strictly Light Mode
      root.classList.remove('dark');
    } else if (workspace === 'super-admin') {
      // Super Admin workspace only uses Super Admin theme
      if (superAdminTheme === 'dark') {
        root.classList.add('dark');
      } else {
        root.classList.remove('dark');
      }
    } else if (workspace === 'madrasa-admin') {
      // Madrasa Admin workspace only uses Madrasa Admin theme
      if (adminTheme === 'dark') {
        root.classList.add('dark');
      } else {
        root.classList.remove('dark');
      }
    }
  }, [workspace, adminTheme, superAdminTheme, location.pathname]);

  const toggleTheme = () => {
    if (workspace === 'super-admin') {
      setSuperAdminTheme((prev) => {
        const next = prev === 'light' ? 'dark' : 'light';
        try {
          localStorage.setItem(SUPER_ADMIN_THEME_STORAGE_KEY, next);
        } catch {}
        return next;
      });
    } else if (workspace === 'madrasa-admin') {
      setAdminTheme((prev) => {
        const next = prev === 'light' ? 'dark' : 'light';
        try {
          localStorage.setItem(ADMIN_THEME_STORAGE_KEY, next);
        } catch {}
        return next;
      });
    }
  };

  const setTheme = (newTheme: Theme) => {
    if (workspace === 'super-admin') {
      setSuperAdminTheme(newTheme);
      try {
        localStorage.setItem(SUPER_ADMIN_THEME_STORAGE_KEY, newTheme);
      } catch {}
    } else if (workspace === 'madrasa-admin') {
      setAdminTheme(newTheme);
      try {
        localStorage.setItem(ADMIN_THEME_STORAGE_KEY, newTheme);
      } catch {}
    }
  };

  return (
    <ThemeContext.Provider
      value={{
        theme: currentTheme,
        toggleTheme,
        setTheme,
        adminTheme,
        superAdminTheme,
      }}
    >
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
