# Going live on your own domain (removes Clerk "Development mode")

Why: the site uses a Clerk **development** instance (`pk_test`). That is what shows "Development mode" and the extra confirmation screen when signing in. A **production** instance needs a domain you own; it does not work on `*.vercel.app`.

## 1. You (accounts and DNS)
1. Buy a domain, for example `wordwild.app`.
2. Vercel dashboard, project `wordwild`, Settings, Domains: add it (and `www`). Add the DNS records Vercel shows at your registrar.
3. Clerk dashboard: create a **Production** instance for that domain. Add the DNS records Clerk lists (it needs a few CNAMEs for `clerk.`, `accounts.` and mail). Wait until Clerk shows them verified.
4. Google sign-in: in Clerk, Configure, SSO connections, Google, switch to **your own** OAuth credentials (Clerk gives step-by-step instructions and the redirect URI to paste into Google Cloud).
5. Copy the production keys (`pk_live_…`, `sk_live_…`). Do not paste them into chat or commit them.

## 2. Environment variables (Vercel, Production only)
Set in the Vercel dashboard, or with the CLI so the value is prompted rather than typed in history:
```
vercel env rm NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY production
vercel env add NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY production
vercel env rm CLERK_SECRET_KEY production
vercel env add CLERK_SECRET_KEY production
vercel env rm APP_URL production
vercel env add APP_URL production          # https://wordwild.app
```
Leave `.env.local` on the development keys so local work does not touch production users.

## 3. Redeploy and check
```
vercel deploy --prod --yes
```
Then: open `/sign-in` in a private window (no "Development mode" badge, no confirmation screen), sign in with email and with Google, and confirm words sync.

## 4. Things that carry the old address
- **Users:** accounts made on the development instance do not move to production. Sign up again; local words stay on the device and sync once signed in.
- **Extension:** `cd extension && node set-domain.mjs https://wordwild.app`, bump `version` in `manifest.json`, `node build-store.mjs`, upload the zip to the Chrome Web Store (and update the listing's privacy and support URLs).
- **Telegram / WhatsApp webhooks:** re-register them with the new address after `APP_URL` changes (Meta's callback URL and the Telegram `setWebhook` call).
- **GitHub:** update the repository homepage and the README link.
- **Old address:** keep the `vercel.app` address working; Vercel can redirect it to the new domain.
