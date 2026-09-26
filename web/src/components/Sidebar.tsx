"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Orb } from "./Companion";
import { ThemeToggle } from "./ThemeToggle";
import { Icon } from "./Icons";

const ITEMS = [
  ["/", "Today", Icon.Today], ["/notebook", "My words", Icon.Words], ["/town", "Town", Icon.Town], ["/play", "Puzzles", Icon.Puzzle], ["/capture", "Save a word", Icon.Plus], ["/scan", "Scan", Icon.Scan], ["/voice", "Voice", Icon.Mic], ["/extension", "Chrome extension", Icon.Plug], ["/settings", "Settings", Icon.Gear],
] as const;

/** Desktop navigation: a bold rail down the left. Small screens use the bottom bar instead (Nav). */
export function Sidebar() {
  const p = usePathname();
  if (p === "/town") return null;                                   // the town is a full-screen game
  const on = (h: string) => (h === "/" ? p === "/" : p.startsWith(h));
  return (
    <aside className="side" aria-label="Main">
      <Link href="/" className="side-brand" aria-label="Wordwild home"><Orb size={56} label="Wordwild" still /><span>Wordwild</span></Link>
      <nav className="side-nav">
        {ITEMS.map(([href, label, Ic]) => <Link key={href} href={href} aria-current={on(href) ? "page" : undefined}><Ic />{label}</Link>)}
      </nav>
      <div className="side-foot"><ThemeToggle /></div>
      <p className="side-foot"><Link href="/about">Credits</Link> · <Link href="/privacy">Privacy</Link></p>
    </aside>
  );
}
