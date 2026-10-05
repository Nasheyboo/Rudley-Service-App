-- Run this once in the Supabase SQL Editor (see deployment steps).
-- Creates the single table this app uses to store everything
-- (clients, jobs, quotes, invoices, expenses) as one JSON blob.

create table if not exists rudley_app_data (
  id text primary key,
  payload jsonb not null,
  updated_at timestamptz not null default now()
);

-- Row Level Security: this app has no login system, so anyone
-- with the website link can read and write this table. That's
-- fine for a small internal tool used by Rudley and his help,
-- but do not put anything in this app you wouldn't want visible
-- to someone who guessed or found the URL.
alter table rudley_app_data enable row level security;

create policy "Allow public read" on rudley_app_data
  for select using (true);

create policy "Allow public write" on rudley_app_data
  for insert with check (true);

create policy "Allow public update" on rudley_app_data
  for update using (true);
