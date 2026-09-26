"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";

const tabs = [["/", "Today"], ["/notebook", "My words"], ["/play", "Puzzles"], ["/settings", "Settings"]] as const;
export function Nav() {
  const p = usePathname();
  if (p.startsWith("/learn") || p.startsWith("/play/") || p === "/review" || p.startsWith("/practice") || p === "/capture" || p === "/voice" || p === "/town" || p === "/scan") return null;   // focus screens hide the tab bar
  return (
    <nav className="nav" aria-label="Main">
      {tabs.map(([href, label]) => <Link key={href} href={href} aria-current={p === href ? "page" : undefined}>{label}</Link>)}
    </nav>
  );
}
