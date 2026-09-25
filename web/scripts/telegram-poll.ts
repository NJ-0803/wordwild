// DEV ONLY: run the bot on your own computer with no public web address (Telegram "long polling" instead of a webhook).
// Usage: npm run telegram:poll     (needs TELEGRAM_BOT_TOKEN and DATABASE_URL in .env.local)
import { handleUpdate } from "../src/lib/telegram.ts";

const token = process.env.TELEGRAM_BOT_TOKEN; if (!token) { console.log("Set TELEGRAM_BOT_TOKEN in .env.local first."); process.exit(1); }
const api = (m: string, body?: object, ms = 40_000) => fetch(`https://api.telegram.org/bot${token}/${m}`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body ?? {}), signal: AbortSignal.timeout(ms) }).then(r => r.json()) as Promise<{ ok: boolean; result?: any; description?: string }>;
const me = await api("getMe"); if (!me.ok) { console.log("Telegram rejected the token:", me.description); process.exit(1); }
console.log(`Bot @${me.result.username} is listening. Put TELEGRAM_BOT_USERNAME=${me.result.username} in .env.local, then link from Settings. Ctrl+C to stop.`);
await api("deleteWebhook");                    // polling and webhooks cannot both be active
let offset = 0;
for (;;) {
  try {
    const r = await api("getUpdates", { offset, timeout: 30, allowed_updates: ["message"] });
    for (const u of r.result ?? []) { offset = u.update_id + 1; try { await handleUpdate(u); console.log(`handled update ${u.update_id}`); } catch (e) { console.error("update failed:", (e as Error).message); } }
  } catch { await new Promise(ok => setTimeout(ok, 3000)); }
}
