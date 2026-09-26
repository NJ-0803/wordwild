"use client";
import dynamic from "next/dynamic";

/** Loads the three.js depth layer only in the browser, after the page is interactive, so it never delays first paint. */
const DepthLayer = dynamic(() => import("./DepthLayer").then(m => m.DepthLayer), { ssr: false });
export function DepthMount() { return <DepthLayer />; }
