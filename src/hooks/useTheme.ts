import { useSyncExternalStore } from "react";

export type Theme = "light" | "dark";

const STORAGE_KEY = "future-theme";

function readInitialTheme(): Theme {
  if (typeof window === "undefined") return "light";
  try {
    const stored = localStorage.getItem(STORAGE_KEY) as Theme | null;
    if (stored === "light" || stored === "dark") return stored;
    return window.matchMedia?.("(prefers-color-scheme: dark)").matches ? "dark" : "light";
  } catch {
    return "light";
  }
}

let currentTheme: Theme = readInitialTheme();
const listeners = new Set<() => void>();

function applyThemeToDom(theme: Theme) {
  if (typeof document === "undefined") return;
  document.documentElement.classList.toggle("dark", theme === "dark");
  try {
    localStorage.setItem(STORAGE_KEY, theme);
  } catch {
    // ignore storage quota errors
  }
  const meta = document.querySelector('meta[name="theme-color"]');
  if (meta) {
    meta.setAttribute("content", theme === "dark" ? "#0b0f17" : "#ffffff");
  }
}

if (typeof document !== "undefined") {
  applyThemeToDom(currentTheme);
}

function setThemeGlobal(next: Theme | ((prev: Theme) => Theme)) {
  const resolved = typeof next === "function" ? next(currentTheme) : next;
  if (resolved === currentTheme) {
    applyThemeToDom(resolved);
    return;
  }
  currentTheme = resolved;
  applyThemeToDom(currentTheme);
  listeners.forEach((fn) => fn());
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

function getSnapshot(): Theme {
  return currentTheme;
}

export const useTheme = () => {
  const theme = useSyncExternalStore(subscribe, getSnapshot, getSnapshot);

  return {
    theme,
    toggle: () => setThemeGlobal((t) => (t === "dark" ? "light" : "dark")),
    setTheme: setThemeGlobal,
  };
};
