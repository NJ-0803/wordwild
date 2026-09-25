"use client";
import Link from "next/link";
import { Show, UserButton } from "@clerk/nextjs";
import { useStore } from "@/lib/store";
import { SyncOrb } from "./Companion";

/** Account strip: guests see sign-in / create-account, signed-in learners see their avatar menu. */
export function Account() {
  const { sync } = useStore();
  return (
    <div className="row" style={{ justifyContent: "flex-end", marginBottom: 8, gap: 8 }}>
      <Show when="signed-out">
        <Link href="/sign-in" className="btn soft" style={{ minHeight: 44, width: "auto", flex: "0 0 auto" }}>Sign in</Link>
        <Link href="/sign-up" className="btn" style={{ minHeight: 44, width: "auto", flex: "0 0 auto" }}>Create account</Link>
      </Show>
      <Show when="signed-in"><SyncOrb syncing={sync === "syncing"} /><div style={{ flex: "0 0 auto" }}><UserButton appearance={{ elements: { userButtonAvatarBox: { width: 44, height: 44 }, userButtonTrigger: { minWidth: 44, minHeight: 44 } } }} /></div></Show>
    </div>
  );
}
