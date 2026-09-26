import type { SVGProps } from "react";

/** One icon family for the whole product: 24px grid, 1.8 stroke, round caps. Replaces the mix of text glyphs and emoji. */
const base = (p: SVGProps<SVGSVGElement>) => ({ width: 22, height: 22, viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: 1.8, strokeLinecap: "round" as const, strokeLinejoin: "round" as const, "aria-hidden": true, focusable: false, ...p });
export const Icon = {
  Today: (p: SVGProps<SVGSVGElement>) => <svg {...base(p)}><circle cx="12" cy="12" r="8" /><path d="M12 4a8 8 0 0 1 0 16z" fill="currentColor" stroke="none" /></svg>,
  Words: (p: SVGProps<SVGSVGElement>) => <svg {...base(p)}><path d="M5 4h11a3 3 0 0 1 3 3v13H8a3 3 0 0 1-3-3z" /><path d="M8 4v13" /><path d="M11 9h5" /></svg>,
  Town: (p: SVGProps<SVGSVGElement>) => <svg {...base(p)}><path d="M4 20V10l8-6 8 6v10z" /><path d="M10 20v-6h4v6" /></svg>,
  Plus: (p: SVGProps<SVGSVGElement>) => <svg {...base(p)}><path d="M12 5v14M5 12h14" /></svg>,
  Scan: (p: SVGProps<SVGSVGElement>) => <svg {...base(p)}><path d="M4 8V6a2 2 0 0 1 2-2h2M16 4h2a2 2 0 0 1 2 2v2M20 16v2a2 2 0 0 1-2 2h-2M8 20H6a2 2 0 0 1-2-2v-2" /><path d="M7 12h10" /></svg>,
  Mic: (p: SVGProps<SVGSVGElement>) => <svg {...base(p)}><rect x="9" y="3" width="6" height="11" rx="3" /><path d="M6 11a6 6 0 0 0 12 0M12 17v4" /></svg>,
  Gear: (p: SVGProps<SVGSVGElement>) => <svg {...base(p)}><circle cx="12" cy="12" r="3" /><path d="M12 3v2.5M12 18.5V21M4.6 6.5l1.8 1.8M17.6 15.7l1.8 1.8M3 12h2.5M18.5 12H21M4.6 17.5l1.8-1.8M17.6 8.3l1.8-1.8" /></svg>,
  Speaker: (p: SVGProps<SVGSVGElement>) => <svg {...base({ width: 18, height: 18, ...p })}><path d="M4 9v6h4l5 4V5L8 9z" /><path d="M16.5 8.5a5 5 0 0 1 0 7M19 6a8.5 8.5 0 0 1 0 12" /></svg>,
  Image: (p: SVGProps<SVGSVGElement>) => <svg {...base({ width: 18, height: 18, ...p })}><rect x="3.5" y="4.5" width="17" height="15" rx="2.5" /><circle cx="9" cy="10" r="1.6" /><path d="m4 17 5-5 4 4 3-3 4 4" /></svg>,
  Stop: (p: SVGProps<SVGSVGElement>) => <svg {...base({ width: 18, height: 18, ...p })}><rect x="6" y="6" width="12" height="12" rx="2" /></svg>,
};
