# Chrome Web Store listing: Wordwild (copy each block into the dashboard)

Package: `node build-store.mjs` -> `dist/wordwild-extension-1.0.0.zip`
Privacy policy URL: https://wordwild-seven.vercel.app/privacy
Homepage / support URL: https://wordwild-seven.vercel.app
Category: Education      Language: English

## Name (max 75)
Wordwild: meaning as you read

## Summary (max 132, this is the manifest description)
Select a word on any page and press a key to see its meaning, in simple words. Save it to your Wordwild garden.

## Detailed description
Read anything. Understand every word.

Select a word on any web page, press any letter key, and a small card opens right next to it with:
- the meaning, in simple English (and Hindi help where available)
- how to say it, with a Listen button
- other meanings of the word, one tap away
- "Did you mean...?" if you misspell it (recieve -> receive)
- the base word when you select a form (went -> go)

Then, if you want to remember the word, tap "Save to Wordwild". Wordwild turns saved words into short practice, a daily word and a small town that grows as you really learn them. No pressure, no punishing streaks.

Made for adults learning English, including people who read little English. Everything can be listened to.

HOW IT WORKS
1. Double-click or drag to select a word (up to three words).
2. Press any letter key. (You can change this to the D key only, or turn it off, in the extension settings.)
3. Read or listen. Press Escape or click elsewhere to close.

PRIVACY
- Only the word you select is sent to Wordwild, and only when you press the key.
- It never reads your browsing history, the pages you visit, or what you type. It stays silent while you type in text boxes.
- No ads, no analytics, no tracking in the extension.
- Full policy: https://wordwild-seven.vercel.app/privacy

Meanings come from Open English WordNet 2025 (CC BY 4.0) and the CMU Pronouncing Dictionary. Extra help for some words is written by AI, checked by a second AI, and labelled as not reviewed by a person.

## Single purpose (Privacy practices tab)
Show the meaning of a word the user selects on a web page, in a small card next to the word.

## Permission justifications
- **storage**: Saves two settings on the user's device: which key opens the meaning card, and (developer builds only) the Wordwild address.
- **Host permission https://wordwild-seven.vercel.app/***: The extension looks up the selected word on the Wordwild dictionary service at this address. It is the only server the extension contacts.
- **Content script on all http/https pages (matches)**: The card has to appear next to a word the user selects on whichever page they are reading. The script only reacts to the user's own text selection followed by a key press, does nothing inside text boxes, and reads nothing else from the page. Only the selected word (at most three words, with punctuation removed) is sent to the service. No page content, address or history is read or sent.
- **Remote code**: None. All code is in the package.

## Data usage disclosure (tick these)
- Collected data types: **Website content** only (the text the user selects, sent to look up its meaning). No personally identifiable information, health, financial, authentication, personal communications, location, web history or user activity data is collected.
- Certifications: I do not sell or transfer user data to third parties outside approved use cases; I do not use or transfer user data for purposes unrelated to the item's single purpose; I do not use or transfer user data to determine creditworthiness or for lending.

## Test instructions for the reviewer (optional field)
Open any article (for example en.wikipedia.org/wiki/Serendipity). Double-click a word such as "serendipity", then press any letter key. A card with the meaning appears next to the word. Try selecting `went` (shows it is a form of "go") or `recieve` (offers "receive"). No account or login is needed.

## Screenshots to upload (ready, exactly 1280x800, in store/screenshots/)
1. 01-card-meaning.png: the meaning card next to a word in an article.
2. 02-did-you-mean.png: a misspelled word with "Did you mean".
3. 03-word-forms.png: a word form ("went") shown with its base word.
4. 04-toolbar-popup.png: the toolbar popup with the search box.
(The pages shown are a demo article; the card and popup are the real extension screens with real dictionary results.)

## Before pressing submit
- Set NEXT_PUBLIC_CONTACT_EMAIL on Vercel so the privacy page shows a contact address, then redeploy. The store also asks for a contact email on your account (verify it).
- Pay the one-time registration fee on the developer dashboard.
