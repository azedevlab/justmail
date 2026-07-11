"use client";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";
import { Monitor, Moon, Sun } from "lucide-react";
import {
  DropdownItem,
  DropdownLabel,
  DropdownMenu,
  DropdownSeparator,
} from "./DropdownMenu.js";
import { IconButton } from "./IconButton.js";

export type ThemePreference = "light" | "dark" | "system";
export type ResolvedTheme = "light" | "dark";

const STORAGE_KEY = "jm-theme";

/**
 * Inline script injected into <head> before hydration so the correct theme
 * class is applied on first paint — avoids a light→dark flash. Kept dependency
 * free (runs as raw text) and mirrors the resolution logic in ThemeProvider.
 */
export const THEME_INIT_SCRIPT = `(function(){try{var p=localStorage.getItem("${STORAGE_KEY}")||"light";var d=p==="dark"||(p==="system"&&window.matchMedia("(prefers-color-scheme: dark)").matches);var c=document.documentElement.classList;c.remove("theme-light","theme-dark");c.add(d?"theme-dark":"theme-light");}catch(e){document.documentElement.classList.add("theme-light");}})();`;

function systemPrefersDark(): boolean {
  return (
    typeof window !== "undefined" &&
    window.matchMedia("(prefers-color-scheme: dark)").matches
  );
}

function resolve(pref: ThemePreference): ResolvedTheme {
  if (pref === "system") return systemPrefersDark() ? "dark" : "light";
  return pref;
}

function apply(resolved: ResolvedTheme): void {
  const c = document.documentElement.classList;
  c.remove("theme-light", "theme-dark");
  c.add(resolved === "dark" ? "theme-dark" : "theme-light");
}

interface ThemeContextValue {
  preference: ThemePreference;
  resolved: ResolvedTheme;
  setPreference: (p: ThemePreference) => void;
}

const ThemeContext = createContext<ThemeContextValue | null>(null);

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [preference, setPref] = useState<ThemePreference>("light");
  const [resolved, setResolved] = useState<ResolvedTheme>("light");

  // Adopt the persisted preference after mount (init script already painted it).
  useEffect(() => {
    const stored = localStorage.getItem(STORAGE_KEY) as ThemePreference | null;
    const p = stored ?? "light";
    setPref(p);
    setResolved(resolve(p));
  }, []);

  // Follow the OS setting live while in "system" mode.
  useEffect(() => {
    if (preference !== "system") return;
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    const onChange = () => {
      const r = mq.matches ? "dark" : "light";
      setResolved(r);
      apply(r);
    };
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, [preference]);

  const setPreference = useCallback((p: ThemePreference) => {
    localStorage.setItem(STORAGE_KEY, p);
    const r = resolve(p);
    setPref(p);
    setResolved(r);
    apply(r);
  }, []);

  return (
    <ThemeContext.Provider value={{ preference, resolved, setPreference }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme(): ThemeContextValue {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error("useTheme must be used within a ThemeProvider");
  return ctx;
}

const OPTIONS: { value: ThemePreference; label: string; icon: ReactNode }[] = [
  { value: "light", label: "Light", icon: <Sun size={14} /> },
  { value: "dark", label: "Dark", icon: <Moon size={14} /> },
  { value: "system", label: "System", icon: <Monitor size={14} /> },
];

export function ThemeToggle() {
  const { preference, resolved, setPreference } = useTheme();
  return (
    <DropdownMenu
      trigger={
        <IconButton aria-label={`Theme: ${preference}`}>
          {resolved === "dark" ? <Moon size={15} /> : <Sun size={15} />}
        </IconButton>
      }
    >
      <DropdownLabel>Appearance</DropdownLabel>
      <DropdownSeparator />
      {OPTIONS.map((o) => (
        <DropdownItem key={o.value} onSelect={() => setPreference(o.value)}>
          <span className="text-[var(--color-neutral-800)]">{o.icon}</span>
          <span className="flex-1">{o.label}</span>
          {preference === o.value && (
            <span className="text-[var(--color-accent)] text-xs">●</span>
          )}
        </DropdownItem>
      ))}
    </DropdownMenu>
  );
}
