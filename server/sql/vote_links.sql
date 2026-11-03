-- Family vote links: a few items from one Space, and the votes of people on the owner's household list.
-- Holds item names, small item pictures, asking prices and voters' names. Never room photos or phone numbers.
-- Run once in the Supabase SQL editor. Only the server's secret key can read or write these tables.
create table if not exists vote_links (
  id text primary key,            -- the random part of the link, /vote/<id>
  owner_hash text not null,       -- sha256 of the owner's token, kept on their phone
  space_name text not null,
  items jsonb not null,           -- [{ ref, name, picture, price }]
  voters jsonb not null,          -- [{ id, name }]
  created_at timestamptz not null default now(),
  expires_at timestamptz not null -- 14 days after it's made; expired links are deleted
);

create table if not exists vote_answers (
  link_id text not null references vote_links(id) on delete cascade,
  voter_id text not null,
  answers jsonb not null,         -- { item ref: 'keep' | 'sell' | 'donate' }
  updated_at timestamptz not null default now(),
  primary key (link_id, voter_id)
);

-- Row level security with no policies: the public keys can't touch these tables at all.
alter table vote_links enable row level security;
alter table vote_answers enable row level security;
