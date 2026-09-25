"use client";
import Link from "next/link";
import type { ButtonHTMLAttributes, ReactNode } from "react";

export function Btn({ kind = "primary", icon, children, ...p }: { kind?: "primary" | "ghost" | "soft"; icon?: string; children: ReactNode } & ButtonHTMLAttributes<HTMLButtonElement>) {
  return <button {...p} className={`btn ${kind === "primary" ? "" : kind} ${p.className ?? ""}`}>{icon && <span aria-hidden>{icon}</span>}{children}</button>;
}
export function LinkBtn({ href, kind = "primary", children }: { href: string; kind?: "primary" | "ghost" | "soft"; children: ReactNode }) {
  return <Link href={href} className={`btn ${kind === "primary" ? "" : kind}`}>{children}</Link>;
}
export function Card({ tone, children, style }: { tone?: "good" | "warn"; children: ReactNode; style?: React.CSSProperties }) {
  return <div className={`card ${tone ?? ""}`} style={style}>{children}</div>;
}
