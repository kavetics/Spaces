-- Spaces that their owner chose to share with Muse: names and item lists only, never photos.
-- Run once in the Supabase SQL editor. Only the server's secret key can read or write this table.
create table if not exists shared_spaces (
  id text primary key,          -- the Space's id on the phone
  name text not null,
  scanned_at timestamptz not null,
  items jsonb not null,         -- [{ name, description, quantity, category, nearby, area, unsure }]
  shared_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Row level security with no policies: the public keys can't touch this table at all.
alter table shared_spaces enable row level security;
