"use client";
import { useEffect } from "react";
import { Btn, Card, LinkBtn } from "@/components/ui";

/** Last line of defence: a crash in one screen shows a calm message with a way out, never a blank page. Learner data is untouched. */
export default function ErrorPage({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => { console.error("screen error", error.message); }, [error]);
  return (
    <div className="stack">
      <h1>Something went wrong</h1>
      <Card tone="warn"><p>Sorry, this screen could not open. Your words and progress are safe on this device.</p></Card>
      <Btn onClick={reset}>Try again</Btn>
      <LinkBtn href="/" kind="ghost">Go to Today</LinkBtn>
    </div>
  );
}
