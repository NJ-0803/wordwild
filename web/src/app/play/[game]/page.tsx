"use client";
import { Icon } from "@/components/Icons";
import { use } from "react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { GAMES, GAME_LABEL, type Game } from "@core";
import { WordGame } from "@/components/play/WordGame";
import { Unscramble } from "@/components/play/Unscramble";
import { MeaningMatch } from "@/components/play/MeaningMatch";

export default function PlayGame({ params }: { params: Promise<{ game: string }> }) {
  const { game } = use(params);
  if (!(GAMES as readonly string[]).includes(game)) notFound();
  const g = game as Game;
  return (
    <div className="stack">
      <p><Link className="pz-link" href="/play"><Icon.ArrowLeft style={{ verticalAlign: "-3px", marginRight: 6 }} />Puzzles</Link></p>
      <h1>{GAME_LABEL[g].title}</h1>
      <p className="sub">{GAME_LABEL[g].blurb}</p>
      {g === "word" ? <WordGame /> : g === "unscramble" ? <Unscramble /> : <MeaningMatch />}
    </div>
  );
}
