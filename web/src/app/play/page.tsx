"use client";
import Link from "next/link";
import { GAMES, GAME_LABEL, PLAY_REWARD } from "@core";
import { useTown } from "@/lib/useTown";
import { Loading } from "@/components/Companion";

export default function PlayHub() {
  const { played, ready } = useTown();
  if (!ready) return <Loading />;
  const n = GAMES.filter(g => played.has(g)).length;
  return (
    <div className="stack">
      <h1>Puzzles</h1>
      <p className="sub">Three small puzzles every day, the same for everyone. Finish one and your town gets {PLAY_REWARD.coins} coins and {PLAY_REWARD.xp} XP. Skipping a day costs nothing.</p>
      <div className="pz-hub">
        {GAMES.map((g, i) => (
          <Link key={g} href={`/play/${g}`} className="pz-tilecard" style={{ ["--i" as string]: i }}>
            <span className="pz-num">{i + 1}</span>
            <b>{GAME_LABEL[g].title}</b>
            <span className="sub">{GAME_LABEL[g].blurb}</span>
            <span className={`pz-state${played.has(g) ? " on" : ""}`}>{played.has(g) ? "Done today" : "Play"}</span>
          </Link>
        ))}
      </div>
      <p className="sub small">{n === GAMES.length ? "All three done today. See you tomorrow." : `${n} of ${GAMES.length} done today.`}</p>
    </div>
  );
}
