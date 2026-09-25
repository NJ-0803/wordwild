-- Wordwild sync schema. Idempotent: safe to run repeatedly. All rows are keyed by the Clerk user id.
create table if not exists ww_learners (
  user_id text primary key,
  prefs jsonb,
  prefs_updated_at bigint not null default 0,
  created_at timestamptz not null default now()
);
create table if not exists ww_captures (
  user_id text not null,
  cap_key text not null,            -- senseId, or "pending:<query>"
  query text not null,
  sense_id text,
  context text not null default '', -- the learner's private note; only readable by that learner
  source text not null default 'Other',
  status text not null check (status in ('resolved','pending','unknown')),
  at bigint not null,
  primary key (user_id, cap_key)
);
create table if not exists ww_attempts (
  user_id text not null,
  key text not null,                -- client idempotency key; a retried request cannot double-count
  sense_id text not null,
  activity_id text not null,
  skill text not null,
  correct boolean,
  hints_used integer not null default 0,
  error_type text,
  at bigint not null,
  primary key (user_id, key)
);
;
-- Dictionary facts from Open English WordNet 2025 (CC BY 4.0) and CMUdict. Read-only reference data, shared by all learners.
create table if not exists ww_dict (
  sense_id text primary key,        -- WordNet sense key: stable across releases far better than a positional number
  lemma text not null,
  pos text not null,
  rank integer not null,            -- WordNet's order within the word. NOT a reliable "most common meaning" signal.
  synset_id text not null,
  definition text not null,
  examples jsonb not null default '[]',
  synonyms jsonb not null default '[]',
  antonyms jsonb not null default '[]',
  broader jsonb not null default '[]',
  ipa text,
  arpabet text
);
;
create extension if not exists pg_trgm
;
create extension if not exists fuzzystrmatch
;
create index if not exists ww_dict_lemma on ww_dict (lemma)
;
-- "Did you mean": fuzzy matching on lemmas for typos.
create index if not exists ww_dict_lemma_trgm on ww_dict using gin (lemma gin_trgm_ops)
;
-- Validated AI enrichment, shared by all learners so each word is generated (and paid for) once.
create table if not exists ww_enriched (
  sense_id text primary key,
  content jsonb not null,
  model text not null,
  verify_model text not null,
  prompt_version integer not null,
  created_at timestamptz not null default now()
)
;
-- Words whose generation was rejected: remembered briefly so a bad word cannot be retried in a loop.
create table if not exists ww_enrich_failed (
  sense_id text primary key,
  stage text not null,
  problems jsonb not null,
  at timestamptz not null default now()
)
;
-- Per-learner daily quota for generation calls (cost control).
create table if not exists ww_enrich_usage (
  user_id text not null,
  day date not null default current_date,
  n integer not null default 0,
  primary key (user_id, day)
)
;
-- AI-predicted difficulty (1-5) and topic tags per word, shared by everyone. Source says who judged it.
create table if not exists ww_word_level (
  lemma text primary key,
  level real not null,
  topics jsonb not null default '[]',
  source text not null,            -- 'ai' | 'heuristic'
  model text,
  at timestamptz not null default now()
)
;
-- Candidate pool for a sense's constellation (dictionary relations + AI suggestions, with levels). Selection per learner happens at request time.
create table if not exists ww_constellation_pool (
  sense_id text primary key,
  pool jsonb not null,
  model text not null,
  prompt_version integer not null,
  at timestamptz not null default now()
)
;
-- "Go deeper" content per sense (tone, intensity ladder, only-this-word sentences), verified then shared by all learners.
create table if not exists ww_depth (
  sense_id text primary key,
  content jsonb not null,
  model text not null,
  prompt_version integer not null,
  at timestamptz not null default now()
)
;
-- Town actions (buildings built, orders claimed). Grow-only and idempotent, like attempts.
create table if not exists ww_town_events (
  user_id text not null,
  key text not null,
  kind text not null check (kind in ('build','claim')),
  ref text not null,
  at bigint not null,
  primary key (user_id, key)
)
;
-- Story scenes were added later: widen the allowed kinds on existing databases.
alter table ww_town_events drop constraint if exists ww_town_events_kind_check
;
alter table ww_town_events add constraint ww_town_events_kind_check check (kind in ('build','claim','scene'))
;
-- Telegram: one-time link codes (10 minutes) and the linked chat per learner.
create table if not exists ww_telegram_links (
  code text primary key,
  user_id text not null,
  expires_at timestamptz not null
)
;
create table if not exists ww_telegram (
  user_id text primary key,
  chat_id bigint not null unique,
  hour integer not null default 8,         -- learner's local hour to receive the daily word
  tz integer not null default 0,           -- minutes east of UTC
  lang text not null default 'hi',
  last_sent_day integer not null default -1,
  created_at timestamptz not null default now()
)
;
-- WhatsApp (Meta Cloud API). wa_id is the learner's phone number in digits: personal data, deleted on STOP, unlink and account deletion.
create table if not exists ww_whatsapp (
  user_id text primary key,
  wa_id text not null unique,
  hour integer not null default 8,
  tz integer not null default 0,
  lang text not null default 'hi',
  last_sent_day integer not null default -1,
  window_until timestamptz not null default now(),   -- WhatsApp's free-form 24h window, reopened by every message the learner sends
  consent_at timestamptz not null default now(),     -- when the learner opted in by messaging us
  created_at timestamptz not null default now()
)
;
create table if not exists ww_whatsapp_links (
  code text primary key,
  user_id text not null,
  expires_at timestamptz not null
)
;
-- Message ids already processed (Meta retries deliveries): replay protection.
create table if not exists ww_wa_seen (
  id text primary key,
  at timestamptz not null default now()
)
