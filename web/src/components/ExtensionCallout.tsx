import Link from "next/link";
import { Card } from "./ui";
import { Icon } from "./Icons";

/** A small pointer to the do-it-yourself Chrome install, for Settings, Scan and the Town. */
export function ExtensionCallout({ compact = false }: { compact?: boolean }) {
  return (
    <Card>
      <div className="row" style={{ justifyContent: "flex-start", gap: 14, alignItems: "flex-start" }}>
        <span style={{ flex: "0 0 auto", color: "var(--navy-glow)" }}><Icon.Puzzle width={30} height={30} /></span>
        <div style={{ flex: 1 }}>
          <b>Look up words on any website</b>
          {!compact && <p className="sub small" style={{ margin: "4px 0 8px" }}>Add the free Wordwild extension to Chrome: select a word on any page, press a key, and see the meaning right there. It takes about two minutes and needs no store.</p>}
          <Link href="/extension" className="small" style={{ display: "inline-flex", alignItems: "center", minHeight: 44 }}>Add it to Chrome, step by step →</Link>
        </div>
      </div>
    </Card>
  );
}
