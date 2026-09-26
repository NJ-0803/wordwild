import { Card, LinkBtn } from "@/components/ui";

export const metadata = { title: "Privacy policy · Wordwild", description: "What Wordwild and the Wordwild browser extension do and do not collect." };

const CONTACT = process.env.NEXT_PUBLIC_CONTACT_EMAIL;      // shown only when set, so no placeholder is ever published
const UPDATED = "26 September 2026";

/** Plain-language policy. Every statement here matches what the code does; if the code changes, change this page. */
export default function Privacy() {
  return (
    <div className="stack">
      <h1>Privacy policy</h1>
      <p className="sub">Last updated {UPDATED}. This covers the Wordwild website and the Wordwild browser extension.</p>

      <Card tone="good">
        <h2>In short</h2>
        <ul style={{ margin: 0, paddingLeft: 18, display: "grid", gap: 6 }}>
          <li>The extension sends <b>only the word you select</b> to Wordwild, to get its meaning. It does not read, store or send the page, its address, or anything else you type or browse.</li>
          <li>We do not sell your data, show ads, or use your data to profile you.</li>
          <li>You can use the website without an account. Your words then stay on your own device.</li>
          <li>You can delete all your data yourself in Settings.</li>
        </ul>
      </Card>

      <Card>
        <h2>Friends and puzzle times</h2>
        <p><b>Friends (optional).</b> If you sign in and use the friends feature, we store your first name, a random invite code, who you accepted as friends, and your puzzle finish times. Friends can see your first name and your times for the day, nothing else. You can remove a friend at any time, and deleting your data removes all of this.</p>
      </Card>

      <Card>
        <h2>The browser extension</h2>
        <p><b>What it sends:</b> when you select one to three words and press a key, the extension sends that selected text (cleaned of punctuation) to <code>wordwild-seven.vercel.app</code> to look up its meaning. Nothing is sent until you press the key.</p>
        <p><b>What it does not do:</b> it does not read the rest of the page, record which sites you visit or your browsing history, read what you type in text boxes (it stays silent inside them), collect personal information, or contain analytics, ads or tracking.</p>
        <p><b>What it stores on your device:</b> two settings (which key opens the meaning, and the Wordwild address) in your browser&rsquo;s extension storage, and a short in-memory list of recent lookups that disappears when the browser closes the extension&rsquo;s background process.</p>
        <p><b>Why it needs access to all websites:</b> it must notice a word you select on any page so it can show the meaning card next to it. It runs only on the page you are reading and only reacts to your selection and key press.</p>
        <p>If you press <b>Save to Wordwild</b>, your browser opens the Wordwild website with that word. Nothing is saved until you choose to save it there.</p>
      </Card>

      <Card>
        <h2>The website</h2>
        <p><b>Without an account:</b> your saved words, notes, practice history and town stay in your browser on your device. We do not receive them.</p>
        <p><b>With an account:</b> we sign you in through Clerk (with email or Google). To sync between devices we store your saved words, the notes and sentences you wrote with them, your practice results, your town progress and your preferences. If you link Telegram or WhatsApp, we also store the chat or number you linked, so we can send your daily word. You can unlink at any time.</p>
        <p><b>AI help:</b> some features send text to AI services to write examples or pick a meaning: the word and its dictionary meaning, and, if you type the sentence where you heard a word, that sentence. Voice questions send the recording to a speech service to turn it into text; we do not keep the recording. We currently use Groq and Google (Gemini), and may use OpenRouter. Their handling is described in their own policies. Everything AI-written is labelled as not reviewed by a person.</p>
        <p><b>Photos (Scan):</b> the text in your photo is read on your device. The photo is never uploaded.</p>
        <p><b>Anonymous counts:</b> we count that things happen (for example, that a word was saved, or that a lookup found nothing) tied to a random number made in your browser. We never send the words you look up, what you type, your name, email, account or address. This is off automatically if your browser sends Do Not Track or Global Privacy Control, and you can turn it off or delete the random number in Settings.</p>
        <p><b>Hosting:</b> the site runs on Vercel and the database on Neon, both in the United States. Like any web host, they process technical request data (such as IP addresses) to deliver the site and keep it secure. We do not use that data for anything else.</p>
        <p><b>Cookies:</b> only those needed to keep you signed in. No advertising cookies.</p>
      </Card>

      <Card>
        <h2>Your choices</h2>
        <ul style={{ margin: 0, paddingLeft: 18, display: "grid", gap: 6 }}>
          <li><b>Delete everything:</b> Settings, then &ldquo;Delete all my data&rdquo;. This removes your words, notes, practice results, town progress and any linked Telegram or WhatsApp number from our database.</li>
          <li><b>Use it without an account,</b> so nothing leaves your device.</li>
          <li><b>Turn off counting</b> in Settings.</li>
          <li><b>Remove the extension</b> at any time from your browser; it leaves nothing behind on our side.</li>
        </ul>
      </Card>

      <Card>
        <h2>Children</h2>
        <p>Wordwild is made for adult learners and is not directed at children under 13. We do not ask for anyone&rsquo;s age.</p>
      </Card>

      <Card>
        <h2>Changes and contact</h2>
        <p>If we change what we collect, we will update this page and the date above before the change takes effect.</p>
        {CONTACT ? <p>Questions or requests: <a href={`mailto:${CONTACT}`}>{CONTACT}</a></p> : <p>Questions or requests: use the contact details on the Wordwild website.</p>}
      </Card>
      <LinkBtn href="/" kind="ghost">Back</LinkBtn>
    </div>
  );
}
