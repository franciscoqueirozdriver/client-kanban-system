"use client";

import React, { createContext, useContext, useEffect, useMemo, useState } from "react";

const ThemeContext = createContext(null);

function getPreferredTheme(enableSystem, defaultTheme) {
  if (typeof window === "undefined") {
    return defaultTheme === "dark" ? "dark" : defaultTheme === "light" ? "light" : "system";
  }

  const stored = window.localStorage.getItem("theme");
  if (stored === "light" || stored === "dark" || stored === "system") {
    return stored;
  }

  if (enableSystem && defaultTheme === "system") {
    return "system";
  }

  if (defaultTheme === "dark" || defaultTheme === "light") {
    return defaultTheme;
  }

  return "system";
}

function resolveTheme(theme, enableSystem) {
  if (theme === "dark" || theme === "light") return theme;
  if (!enableSystem || typeof window === "undefined") return "light";
  return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}

export function useTheme() {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error("useTheme must be used inside ThemeProvider");
  }
  return context;
}

export default function ThemeProvider({
  children,
  attribute = "class",
  defaultTheme = "system",
  enableSystem = true,
}) {
  const [theme, setThemeState] = useState(() => getPreferredTheme(enableSystem, defaultTheme));
  const [resolved, setResolved] = useState(() => resolveTheme(theme, enableSystem));

  useEffect(() => {
    if (typeof window === "undefined") return;
    const media = window.matchMedia("(prefers-color-scheme: dark)");
    const handler = () => {
      setResolved(resolveTheme(theme, enableSystem));
    };
    if (media?.addEventListener) {
      media.addEventListener("change", handler);
      return () => media.removeEventListener("change", handler);
    }
    media?.addListener?.(handler);
    return () => media?.removeListener?.(handler);
  }, [theme, enableSystem]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const effective = resolveTheme(theme, enableSystem);
    setResolved(effective);

    const root = document.documentElement;
    if (attribute === "class") {
      root.classList.remove("dark", "light");
      root.classList.add(effective === "dark" ? "dark" : "light");
    } else {
      root.setAttribute(attribute, effective);
    }

    window.localStorage.setItem("theme", theme);
  }, [theme, attribute, enableSystem]);

  const value = useMemo(
    () => ({
      theme,
      resolvedTheme: resolved,
      systemTheme: resolveTheme("system", enableSystem),
      setTheme: (next) => {
        if (next !== "light" && next !== "dark" && next !== "system") return;
        setThemeState(next);
      },
    }),
    [theme, resolved, enableSystem],
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}
