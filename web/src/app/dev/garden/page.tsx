import { notFound } from "next/navigation";
import { GardenScene } from "@/components/GardenScene";

/** Development-only preview of every growth stage. 404 in production. */
export default function GardenPreview() {
  if (process.env.NODE_ENV === "production") notFound();
  const words = ["seed", "sprout", "grow", "bloom", "tactful", "polite", "blunt", "indirect", "skeptical"];
  const plants = words.map((label, i) => ({ id: label, label, stage: ([0, 1, 2, 3, 3, 2, 1, 0, 3] as const)[i] }));
  return <div className="stack"><h1>Garden preview</h1><GardenScene plants={plants} summary="Preview of all growth stages" /></div>;
}
