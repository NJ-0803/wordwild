"use client";
import Link from "next/link";
import type { ButtonHTMLAttributes, ReactNode } from "react";
import { Beam } from "./Companion";

export function Btn({ kind = "primary", icon, children, ...p }: { kind?: "primary" | "ghost" | "soft"; icon?: ReactNode; children: ReactNode } & ButtonHTMLAttributes<HTMLButtonElement>) {
  return <Beam radius={16}><button {...p} className={`btn ${kind === "primary" ? "" : kind} ${p.className ?? ""}`}>{icon && <span aria-hidden>{icon}</span>}{children}</button></Beam>;
}
export function LinkBtn({ href, kind = "primary", children }: { href: string; kind?: "primary" | "ghost" | "soft"; children: ReactNode }) {
  return <Beam radius={16}><Link href={href} className={`btn ${kind === "primary" ? "" : kind}`}>{children}</Link></Beam>;
}
export function Card({ tone, children, style }: { tone?: "good" | "warn"; children: ReactNode; style?: React.CSSProperties }) {
  return <Beam radius={20}><div className={`card ${tone ?? ""}`} style={style}>{children}</div></Beam>;
}
/** Wrap every search box / text field so it carries the beam. */
export function Field({ children }: { children: ReactNode }) { return <Beam radius={16}>{children}</Beam>; }
