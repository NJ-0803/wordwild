"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useStore } from "@/lib/store";

const tabsFor = (puzzles: boolean) => [["/", "Today"], ["/notebook", "My words"], puzzles ? ["/play", "Puzzles"] : ["/capture", "Add"], ["/settings", "Settings"]] as const;
export function Nav() {
  const p = usePathname();
  const { onboarded, state } = useStore(); const tabs = tabsFor(Object.keys(state.attempts).length > 0 || Object.keys(state.senses).length >= 3);
  if (!onboarded) return null;                                    // the very first screens have no tab bar
  if (p.startsWith("/learn") || p.startsWith("/play/") || p === "/review" || p.startsWith("/practice") || p === "/capture" || p === "/voice" || p === "/town" || p === "/scan") return null;   // focus screens hide the tab bar
  return (
    <nav className="nav" aria-label="Main">
      {tabs.map(([href, label]) => <Link key={href} href={href} aria-current={p === href ? "page" : undefined}>{label}</Link>)}
    </nav>
  );
}
