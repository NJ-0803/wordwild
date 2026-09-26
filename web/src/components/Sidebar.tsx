"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useStore } from "@/lib/store";
import { Orb } from "./Companion";
import { ThemeToggle } from "./ThemeToggle";
import { Icon } from "./Icons";

type Kind = "core" | "town" | "puzzles" | "tools";
type Item = readonly [string, string, (p: React.SVGProps<SVGSVGElement>) => React.ReactNode, Kind];
const ITEMS: readonly Item[] = [
  ["/", "Today", Icon.Today, "core"], ["/notebook", "My words", Icon.Words, "core"], ["/town", "Town", Icon.Town, "town"], ["/play", "Puzzles", Icon.Puzzle, "puzzles"],
  ["/capture", "Save a word", Icon.Plus, "core"], ["/scan", "Scan", Icon.Scan, "tools"], ["/voice", "Voice", Icon.Mic, "tools"], ["/extension", "Chrome extension", Icon.Plug, "tools"], ["/settings", "Settings", Icon.Gear, "core"],
];

/** Desktop navigation: a bold rail down the left. Small screens use the bottom bar instead (Nav). */
export function Sidebar() {
  const p = usePathname(); const { state } = useStore();
  const saved = Object.keys(state.senses).length, reviewed = Object.keys(state.attempts).length > 0;
  // Nothing is hidden for good: features that are not useful yet on day one sit under "More" and move into the list as soon as they matter.
  const open = (k: Kind) => k === "core" || (k === "town" && saved >= 1) || (k === "puzzles" && (reviewed || saved >= 3)) || (k === "tools" && saved >= 3);
  if (p === "/town") return null;                                   // the town is a full-screen game
  const on = (h: string) => (h === "/" ? p === "/" : p.startsWith(h));
  return (
    <aside className="side" aria-label="Main">
      <Link href="/" className="side-brand" aria-label="Wordwild home"><Orb size={56} label="Wordwild" still /><span>Wordwild</span></Link>
      <nav className="side-nav">
        {ITEMS.filter(i => open(i[3])).map(([href, label, Ic]) => <Link key={href} href={href} aria-current={on(href) ? "page" : undefined}><Ic />{label}</Link>)}
        {ITEMS.some(i => !open(i[3])) && <details className="side-more"><summary>More</summary>{ITEMS.filter(i => !open(i[3])).map(([href, label, Ic]) => <Link key={href} href={href} aria-current={on(href) ? "page" : undefined}><Ic />{label}</Link>)}</details>}
      </nav>
      <div className="side-foot"><ThemeToggle /></div>
      <p className="side-foot"><Link href="/about">Credits</Link> · <Link href="/privacy">Privacy</Link></p>
    </aside>
  );
}
