"use client";
import Link from "next/link";
import { GAMES, GAME_LABEL, PLAY_POINTS } from "@core";
import { useTown } from "@/lib/useTown";
import { TiltCard } from "@/components/TiltCard";
import { Friends } from "@/components/play/Friends";
import { Loading, Lumi } from "@/components/Companion";

export default function PlayHub() {
  const { played, ready } = useTown();
  if (!ready) return <Loading />;
  const n = GAMES.filter(g => played.has(g)).length;
  return (
    <div className="stack">
      <div className="hero"><Lumi size={84} /><h1 style={{ margin: 0 }}>Puzzles</h1></div>
      <p className="sub">Three small puzzles every day, the same for everyone. Finish one and your town gets {PLAY_POINTS} points. Skipping a day costs nothing.</p>
      <div className="pz-hub">
        {GAMES.map((g, i) => (
          <TiltCard key={g} className="tilt-fill"><Link href={`/play/${g}`} className="pz-tilecard" data-g={g} style={{ ["--i" as string]: i }}>
            <b>{GAME_LABEL[g].title}</b>
            <span className="sub">{GAME_LABEL[g].blurb}</span>
            <span className={`pz-state${played.has(g) ? " on" : ""}`}>{played.has(g) ? "Done today" : "Play"}</span>
          </Link></TiltCard>
        ))}
      </div>
      <Friends />
      <p className="sub small">{n === GAMES.length ? "All three done today. See you tomorrow." : `${n} of ${GAMES.length} done today.`}</p>
    </div>
  );
}
