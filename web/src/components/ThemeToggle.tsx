"use client";
import { useEffect, useState } from "react";

type Theme = "dark" | "light";
const KEY = "ww.theme";
export const readTheme = (): Theme => { try { return localStorage.getItem(KEY) === "light" ? "light" : "dark"; } catch { return "dark"; } };
const apply = (t: Theme) => { document.documentElement.dataset.theme = t; try { localStorage.setItem(KEY, t); } catch { /* memory only */ } };

/** Dark or light. Dark is the default; the choice is remembered on this device. The inline script in the layout sets it before first paint. */
export function ThemeToggle({ compact = false }: { compact?: boolean }) {
  const [t, setT] = useState<Theme>("dark");
  useEffect(() => { const v = readTheme(); setT(v); document.documentElement.dataset.theme = v; }, []);          // eslint-disable-line react-hooks/set-state-in-effect -- React can drop the attribute the inline script set while hydrating <html>, so set it again
  const pick = (v: Theme) => { setT(v); apply(v); };
  const sun = <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" aria-hidden><circle cx="12" cy="12" r="4" /><path d="M12 3v2M12 19v2M3 12h2M19 12h2M5.6 5.6 7 7M17 17l1.4 1.4M18.4 5.6 17 7M7 17l-1.4 1.4" /></svg>;
  const moon = <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden><path d="M20 14.5A8 8 0 0 1 9.5 4 8 8 0 1 0 20 14.5z" /></svg>;
  return (
    <div className="theme-sw" role="group" aria-label="Colour theme">
      <button aria-pressed={t === "dark"} onClick={() => pick("dark")} aria-label="Dark">{moon}{!compact && "Dark"}</button>
      <button aria-pressed={t === "light"} onClick={() => pick("light")} aria-label="Light">{sun}{!compact && "Light"}</button>
    </div>
  );
}
