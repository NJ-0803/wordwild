"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Orb } from "./Companion";

const ITEMS = [
  ["/", "Today", "◐"], ["/notebook", "My words", "▤"], ["/town", "Town", "⌂"], ["/capture", "Save a word", "＋"], ["/scan", "Scan", "◎"], ["/voice", "Voice", "◉"], ["/settings", "Settings", "⚙"],
] as const;

/** Desktop navigation: a bold rail down the left. Small screens use the bottom bar instead (Nav). */
export function Sidebar() {
  const p = usePathname();
  if (p === "/town") return null;                                   // the town is a full-screen game
  const on = (h: string) => (h === "/" ? p === "/" : p.startsWith(h));
  return (
    <aside className="side" aria-label="Main">
      <Link href="/" className="side-brand" aria-label="Wordwild home"><Orb size={56} label="Wordwild" /><span>Wordwild</span></Link>
      <nav className="side-nav">
        {ITEMS.map(([href, label, icon]) => <Link key={href} href={href} aria-current={on(href) ? "page" : undefined}><span aria-hidden>{icon}</span>{label}</Link>)}
      </nav>
      <p className="side-foot"><Link href="/about">Credits</Link> · <Link href="/privacy">Privacy</Link></p>
    </aside>
  );
}
