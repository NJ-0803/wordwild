"use client";
import { use, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Show } from "@clerk/nextjs";
import { Lumi } from "@/components/Companion";

/** Opened from a friend's invite link: signs you in if needed, then links you as friends. */
export default function Join({ params }: { params: Promise<{ code: string }> }) {
  const { code } = use(params);
  return (
    <div className="stack">
      <div className="hero"><Lumi size={84} /><h1 style={{ margin: 0 }}>Play with a friend</h1></div>
      <Show when="signed-out">
        <p className="sub">A friend invited you to compare puzzle times on Wordwild. Sign in first; you will be brought back here.</p>
        <Link className="btn" href={`/sign-in?redirect_url=${encodeURIComponent(`/join/${code}`)}`}>Sign in</Link>
      </Show>
      <Show when="signed-in"><Accept code={code} /></Show>
    </div>
  );
}

function Accept({ code }: { code: string }) {
  const router = useRouter();
  const [state, setState] = useState<"working" | "ok" | "self" | "bad">("working");
  useEffect(() => {
    let live = true;
    void fetch("/api/friends/join", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ code }) })
      .then(async r => { const j = await r.json().catch(() => ({})); if (!live) return; setState(r.ok ? (j.result === "self" ? "self" : "ok") : "bad"); if (r.ok && j.result === "ok") setTimeout(() => router.push("/play"), 1200); })
      .catch(() => live && setState("bad"));
    return () => { live = false; };
  }, [code, router]);
  return (
    <div className="card" role="status">
      {state === "working" && <p>Adding your friend…</p>}
      {state === "ok" && <p><b>You are friends now.</b> Taking you to today&apos;s puzzles…</p>}
      {state === "self" && <p>That is your own invite link. Send it to a friend instead.</p>}
      {state === "bad" && <p>This invite link did not work. Ask your friend for a new one.</p>}
      <Link className="pz-link" href="/play">Go to puzzles</Link>
    </div>
  );
}
