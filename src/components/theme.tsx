"use client";

import { Moon, Sun } from "lucide-react";
import { useTranslations } from "next-intl";
import { useSyncExternalStore } from "react";
import { Button } from "@/components/ui/button";

export type Theme = "dark" | "light";
const STORAGE_KEY = "mm-theme";
const THEME_COLORS: Record<Theme, string> = { dark: "#0b0f14", light: "#f5f7fa" };

/**
 * Runs before first paint (inlined in <head>) so the saved theme never flashes.
 * Dark is the default.
 */
export const themeScript = `(function(){try{var t=localStorage.getItem("${STORAGE_KEY}");if(t!=="light")t="dark";var c=document.documentElement.classList;c.remove("dark","light");c.add(t);}catch(e){}})();`;

function subscribe(onChange: () => void) {
  const observer = new MutationObserver(onChange);
  observer.observe(document.documentElement, { attributes: true, attributeFilter: ["class"] });
  return () => observer.disconnect();
}

const readTheme = (): Theme => (document.documentElement.classList.contains("light") ? "light" : "dark");

export function useTheme() {
  const theme = useSyncExternalStore(subscribe, readTheme, () => "dark" as Theme);
  return { theme, setTheme };
}

export function setTheme(theme: Theme) {
  const root = document.documentElement;
  root.classList.remove("dark", "light");
  root.classList.add(theme);
  try {
    localStorage.setItem(STORAGE_KEY, theme);
  } catch {
    // private mode: the choice just won't persist
  }
  document.querySelectorAll('meta[name="theme-color"]').forEach((m) => m.setAttribute("content", THEME_COLORS[theme]));
}

export function ThemeToggle({ className }: { className?: string }) {
  const t = useTranslations("theme");
  const { theme } = useTheme();
  const next: Theme = theme === "dark" ? "light" : "dark";
  return (
    <Button
      variant="ghost"
      size="icon"
      className={className}
      onClick={() => setTheme(next)}
      aria-label={next === "light" ? t("toLight") : t("toDark")}
      title={next === "light" ? t("toLight") : t("toDark")}
    >
      {theme === "dark" ? <Sun className="size-[18px]" /> : <Moon className="size-[18px]" />}
    </Button>
  );
}
