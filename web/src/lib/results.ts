import type { Game, Level } from "@core";

/** Tell the server how a puzzle went, so friends can see it. Signed-out players and network failures are simply ignored; the puzzle itself never depends on this. */
export function postResult(r: { game: Game; day: number; level: Level | "-"; ms: number; tries: number; won: boolean }) {
  void fetch("/api/play/result", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(r) }).catch(() => undefined);
}
