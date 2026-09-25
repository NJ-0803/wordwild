# WhatsApp setup (Meta WhatsApp Cloud API, free test number)

The code is done and tested with a mocked Meta network. These steps connect it to the real thing. **Never paste tokens into chat**: put them in `web/.env.local` (see "Add the values safely").

## 1. Meta developer app (about 15 minutes)
1. Go to **developers.facebook.com**, log in, **My Apps -> Create App**, type **Business**.
2. Add the **WhatsApp** product. Meta creates a **test business phone number** and a test WhatsApp Business Account.
3. In **WhatsApp -> API Setup** you will see:
   - **Phone number ID** (a long number) -> `WHATSAPP_PHONE_NUMBER_ID`
   - **Temporary access token** (valid 24 hours; fine for testing) -> `WHATSAPP_ACCESS_TOKEN`
   - The **test number itself** (like +1 555 ...) -> `WHATSAPP_BUSINESS_NUMBER` (digits only, no plus)
   - **Add a recipient**: add your own phone number (up to 5 numbers, each verified with a code).
4. **App settings -> Basic -> App secret** -> `WHATSAPP_APP_SECRET`. This is how we prove a message really came from Meta.
5. Make up a random **verify token** yourself (any long random text) -> `WHATSAPP_VERIFY_TOKEN`.

## 2. A public address for the webhook
Meta must reach your computer over HTTPS. For testing, use a tunnel:
- `brew install cloudflared` then `cloudflared tunnel --url http://localhost:3100` (prints an `https://....trycloudflare.com` address), or ngrok.
- Set `APP_URL` in `.env.local` to that address.

## 3. Register the webhook
In **WhatsApp -> Configuration -> Webhook -> Edit**:
- **Callback URL**: `https://YOUR-ADDRESS/api/whatsapp`
- **Verify token**: the same text as `WHATSAPP_VERIFY_TOKEN`
- Click **Verify and save**, then **Manage** and subscribe to **messages**.

## 4. Try it
1. Restart `npm run dev` (it reads `.env.local` at start).
2. In Wordwild: **Settings -> Daily word on WhatsApp -> Connect**. WhatsApp opens with `LINK abc123` ready. Press send.
3. You get "Linked to Wordwild". Then message any word ("skeptical") and you get its meaning.
4. Send `STOP` to unlink. Your number is deleted.

## 5. The daily word outside the 24-hour window
WhatsApp only allows free text within 24 hours of the learner's last message. Beyond that we can only send an **approved template**.
- For quick testing: set `WHATSAPP_DAILY_TEMPLATE=hello_world`, `WHATSAPP_TEMPLATE_LANG=en_US`, `WHATSAPP_TEMPLATE_PARAMS=0` (Meta's built-in sample has no parameters).
- For real use, create a template in **WhatsApp Manager -> Message templates**, category **Utility** (or Marketing if Meta reclassifies it), language English, named `wordwild_daily_word`, with this body:
  `Your Wordwild word for today: {{1}}. {{2}} Reply STOP to turn this off.`
  Then set `WHATSAPP_DAILY_TEMPLATE=wordwild_daily_word`, remove `WHATSAPP_TEMPLATE_PARAMS`. Approval usually takes hours to a couple of days.
- Business-initiated templates are charged per message by Meta. Check Meta's current price list for your country before scaling.

## 6. Going beyond testing
- A permanent token (System User) instead of the 24-hour one.
- Business verification and your own number.
- Deploy to Vercel (the hourly cron in `vercel.json` sends the daily words; set `CRON_SECRET`).
- Privacy notice covering: phone number stored only to send the daily word, deleted on STOP or account deletion.

## Add the values safely
```
! pbpaste | sed 's/^/WHATSAPP_ACCESS_TOKEN=/' >> ~/projects/wordwild/web/.env.local     # after copying the token
! pbpaste | sed 's/^/WHATSAPP_APP_SECRET=/' >> ~/projects/wordwild/web/.env.local        # after copying the app secret
! echo "WHATSAPP_PHONE_NUMBER_ID=123..." >> ~/projects/wordwild/web/.env.local            # not secret
! echo "WHATSAPP_BUSINESS_NUMBER=1555..." >> ~/projects/wordwild/web/.env.local           # not secret
! echo "WHATSAPP_VERIFY_TOKEN=$(openssl rand -hex 16)" >> ~/projects/wordwild/web/.env.local
```
Check names only: `! grep -o '^WHATSAPP_[A-Z_]*=' ~/projects/wordwild/web/.env.local`
