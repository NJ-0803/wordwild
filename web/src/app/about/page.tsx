import { Card, LinkBtn } from "@/components/ui";

export const metadata = { title: "Credits and licences · Wordwild" };

export default function About() {
  return (
    <div className="stack">
      <h1>Credits and licences</h1>
      <Card>
        <h2>Word meanings</h2>
        <p>Definitions, example sentences, similar and opposite words come from <b>Open English WordNet 2025</b>, licensed under <b>Creative Commons Attribution 4.0 (CC BY 4.0)</b>.</p>
        <p className="sub small">McCrae, J. P., Rademaker, A., Bond, F., Rudnicka, E., Fellbaum, C. (2019). English WordNet 2019: an open-source WordNet for English. Based on Princeton WordNet. We have reformatted the data and removed proper nouns.</p>
      </Card>
      <Card>
        <h2>More words</h2>
        <p>Some standard English words that WordNet does not list have their meaning, example sentences and pronunciation from <b>English Wiktionary</b> (Wikimedia contributors), extracted by Wiktextract / kaikki.org, under <b>Creative Commons Attribution-ShareAlike 4.0</b>. Those entries show Wiktionary as their source, and only standard words are included: no slang, offensive, obsolete or informal senses. If you reuse them, the same licence applies.</p>
      </Card>
      <Card>
        <h2>Pronunciation</h2>
        <p>Pronunciation data comes from the <b>CMU Pronouncing Dictionary</b> (Carnegie Mellon University), used with acknowledgement as its authors request.</p>
      </Card>
      <Card tone="warn">
        <h2>What is and is not checked</h2>
        <p>Dictionary meanings are used as published and have not been reviewed by a Wordwild editor. Our hand-written sample lessons, Hindi text and any AI-drafted help are labelled as unreviewed. Nothing here is a substitute for a teacher or a full dictionary.</p>
      </Card>
      <Card>
        <h2>Anonymous counts</h2>
        <p>Wordwild counts that certain things happen: the app was opened, a word was saved, a practice was done, a word became secure, a story scene or the daily journey was finished, a card was shared, the coach was viewed, and the <i>kind</i> of result a lookup had (found, not found, a number, a sentence and so on).</p>
        <p><b>Never sent:</b> the word you looked up, anything you typed, your notes, your name, email or account, your IP address, or which pages you visit. Each count carries only a random device number made in your browser and a day. Nothing links it to you.</p>
        <p><b>You are in control:</b> turn counting off or delete the random number any time in Settings. Counting is also off automatically if your browser sends Do Not Track or Global Privacy Control. We use these counts only to see whether people come back and where things fail.</p>
      </Card>
      <LinkBtn href="/privacy" kind="soft">Read the full privacy policy</LinkBtn>
      <LinkBtn href="/" kind="ghost">Back</LinkBtn>
    </div>
  );
}
