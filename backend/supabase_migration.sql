-- ═══════════════════════════════════════════════════════════════════
-- DataLens — Supabase Schema Migration
-- Run this in your Supabase SQL Editor (Dashboard → SQL Editor → New query)
-- ═══════════════════════════════════════════════════════════════════

-- ── 1. datasets ───────────────────────────────────────────────────
-- Stores one row per uploaded dataset + the full EDA report as JSONB
create table if not exists public.datasets (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null references auth.users(id) on delete cascade,
  name         text not null,
  status       text not null default 'processing'
                 check (status in ('processing', 'ready', 'failed')),
  rows         integer not null default 0,
  columns      integer not null default 0,
  health_score integer not null default 0
                 check (health_score between 0 and 100),
  report       jsonb,          -- full EDA report from services/eda.py
  file_path    text,           -- path in Supabase Storage bucket "datasets"
  created_at   timestamptz not null default now()
);

-- Index for fast per-user lookups (the most common query)
create index if not exists datasets_user_id_idx on public.datasets (user_id, created_at desc);

-- Row Level Security: users can only see their own datasets
alter table public.datasets enable row level security;

create policy "Users can manage their own datasets"
  on public.datasets
  for all
  using (auth.uid() = user_id);


-- ── 2. chats ─────────────────────────────────────────────────────
-- Stores chat history per dataset
create table if not exists public.chats (
  id           uuid primary key default gen_random_uuid(),
  dataset_id   uuid not null references public.datasets(id) on delete cascade,
  user_id      uuid not null references auth.users(id) on delete cascade,
  role         text not null check (role in ('user', 'assistant')),
  content      text not null,
  sources      text[],         -- e.g. ['EDA Report'] or RAG chunk references
  created_at   timestamptz not null default now()
);

create index if not exists chats_dataset_idx on public.chats (dataset_id, created_at);

alter table public.chats enable row level security;

create policy "Users can manage their own chats"
  on public.chats
  for all
  using (auth.uid() = user_id);


-- ── 3. exports ───────────────────────────────────────────────────
-- Tracks generated PDF files (maps file_id → storage path)
create table if not exists public.exports (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null references auth.users(id) on delete cascade,
  dataset_id   uuid not null references public.datasets(id) on delete cascade,
  storage_path text not null,  -- path in Supabase Storage bucket "reports"
  created_at   timestamptz not null default now()
);

alter table public.exports enable row level security;

create policy "Users can manage their own exports"
  on public.exports
  for all
  using (auth.uid() = user_id);


-- ── 4. Storage buckets ────────────────────────────────────────────
-- Run these separately in the Supabase dashboard under Storage → New bucket
-- OR uncomment and run here (requires admin privileges):

-- insert into storage.buckets (id, name, public)
-- values ('datasets', 'datasets', false)
-- on conflict (id) do nothing;

-- insert into storage.buckets (id, name, public)
-- values ('reports', 'reports', false)
-- on conflict (id) do nothing;