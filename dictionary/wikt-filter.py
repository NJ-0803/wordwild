#!/usr/bin/env python3
"""
Streams the English Wiktionary extract (kaikki.org, 3+ GB JSONL) from stdin and keeps ONLY standard words:
  lowercase nouns, verbs, adjectives and adverbs, single words or hyphenated, not already in WordNet,
  and only meanings that are not slang, informal, vulgar, offensive, obsolete, archaic, dated, rare, dialect, abbreviations,
  or inflected/alternative forms. Nothing is invented: definition, examples and IPA are the Wiktionary text as written.
Usage:  curl -s URL | python3 wikt-filter.py existing-lemmas.txt out.jsonl
"""
import sys, json, re

POS = {'noun': 'n', 'verb': 'v', 'adj': 'adj', 'adv': 'adv'}
BAD_TAGS = {'slang', 'informal', 'colloquial', 'vulgar', 'offensive', 'derogatory', 'pejorative', 'obsolete', 'archaic', 'dated', 'rare', 'dialectal',
            'dialect', 'nonstandard', 'non-standard', 'misspelling', 'alt-of', 'form-of', 'abbreviation', 'initialism', 'acronym', 'ellipsis', 'humorous',
            'euphemistic', 'ethnic-slur', 'sometimes-offensive', 'proscribed', 'hypercorrect', 'eye-dialect', 'childish', 'internet', 'neologism', 'sarcastic',
            'nonce-word', 'no-gloss', 'rare-sense', 'uncommon', 'jocular', 'literary-archaic', 'poetic', 'Scotland', 'Ireland', 'Australia', 'India', 'South-Africa',
            'New-Zealand', 'Jamaica', 'Singapore', 'Philippines', 'Northern-England', 'Yorkshire', 'Cockney', 'regional', 'Caribbean', 'Hong-Kong', 'Malaysia', 'Pakistan'}
BAD_GLOSS = re.compile(r"^(plural|singular|past|present|third-person|second-person|first-person|simple past|past participle|present participle|gerund|comparative|superlative|"
                       r"alternative|alternate|obsolete|archaic|dated|nonstandard|misspelling|eye dialect|abbreviation|initialism|acronym|contraction|clipping|"
                       r"informal|slang|synonym of|short for|shortened|apocopic|standard form|pronunciation spelling|romanization|inflection|form of|"
                       r"used in|used to|used as|used with|used before|used after|used for|only used|obsolete form|verbal noun|agent noun|rare|ellipsis)\b", re.I)
WORD = re.compile(r"^[a-z]{3,24}(?:-[a-z]{2,20})?$")
SPACE_OK = re.compile(r"^[a-z]+$")
TOPIC_ONLY = re.compile(r"^\(.*\)$")

def clean(t, n):
    t = re.sub(r"\s+", " ", (t or "")).strip()
    return t[:n]

def ipa_of(e):
    for s in e.get('sounds', []) or []:
        v = s.get('ipa')
        if v and len(v) < 60:
            return v.strip().strip('/[]')
    return None

def words_of(lst):
    out = []
    for x in lst or []:
        w = x.get('word') if isinstance(x, dict) else None
        if w and re.fullmatch(r"[a-z]{3,24}", w) and w not in out: out.append(w)
    return out[:6]

def senses_of(e):
    out = []
    for s in e.get('senses', []) or []:
        tags = set(s.get('tags', []) or []) | set(t for t in (s.get('raw_tags', []) or []))
        if tags & BAD_TAGS: continue
        if s.get('form_of') or s.get('alt_of') or s.get('links') is None and False: continue
        g = s.get('glosses') or []
        if not g: continue
        gloss = clean(g[-1], 320)
        if len(gloss) < 12 or BAD_GLOSS.match(gloss) or TOPIC_ONLY.match(gloss): continue
        if gloss.lower().startswith(('alternative ', 'obsolete ')): continue
        ex = [clean(x.get('text'), 220) for x in (s.get('examples') or []) if isinstance(x, dict) and x.get('text') and not x.get('type') == 'quotation' and 25 <= len(x['text']) <= 220][:2]
        out.append({'definition': gloss, 'examples': ex, 'synonyms': words_of(s.get('synonyms')), 'antonyms': words_of(s.get('antonyms'))})
        if len(out) >= 5: break
    return out

def main(existing_path, out_path):
    existing = set(open(existing_path, encoding='utf8').read().split('\n'))
    seen_lemmas = {}   # lemma -> {pos: count}
    kept_entries = kept_senses = read = 0
    with open(out_path, 'w', encoding='utf8') as out:
        for line in sys.stdin.buffer:
            read += 1
            if read % 200000 == 0: print(f"read {read:,} entries, kept {kept_entries:,} words / {kept_senses:,} meanings", file=sys.stderr, flush=True)
            try: e = json.loads(line)
            except Exception: continue
            if e.get('lang_code') != 'en': continue
            pos = POS.get(e.get('pos'))
            w = e.get('word', '')
            if not pos or w in existing or not WORD.match(w): continue
            ss = senses_of(e)
            if not ss: continue
            per = seen_lemmas.setdefault(w, {})
            n0 = per.get(pos, 0)
            if sum(per.values()) >= 8: continue
            ipa = ipa_of(e)
            for i, s in enumerate(ss, start=n0 + 1):
                out.write(json.dumps({'sense_id': f"{w}%w:{pos}:{i}", 'lemma': w, 'pos': pos, 'rank': i, 'synset_id': 'wikt', **s, 'broader': [], 'ipa': ipa, 'arpabet': None, 'source': 'wiktionary'}, ensure_ascii=False) + '\n')
                kept_senses += 1
            per[pos] = n0 + len(ss)
            if n0 == 0 and len(per) == 1: kept_entries += 1
    print(f"finished: read {read:,} entries; kept {len(seen_lemmas):,} words / {kept_senses:,} meanings", file=sys.stderr)

if __name__ == '__main__':
    main(sys.argv[1], sys.argv[2])
