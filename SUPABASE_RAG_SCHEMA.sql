-- ══════════════════════════════════════════════════════════
-- Run this in Supabase SQL Editor AFTER the main schema
-- ══════════════════════════════════════════════════════════

-- 1. Enable pgvector extension
create extension if not exists vector;

-- 2. Add embedding column to worries table
alter table worries add column if not exists embedding vector(384);
alter table worries add column if not exists action_taken boolean default false;
alter table worries add column if not exists user_id text default 'demo';

-- 3. Add user_id to habits and events (if not exists)
alter table habits add column if not exists user_id text default 'demo';
alter table habits add column if not exists completed_dates text[] default '{}';
alter table events add column if not exists user_id text default 'demo';

-- 4. Create vector similarity search function
create or replace function match_worries(
  query_embedding vector(384),
  match_user_id text,
  match_threshold float,
  match_count int
)
returns table (
  id uuid,
  text text,
  topic text,
  action_taken boolean,
  created_at timestamptz,
  similarity float
)
language sql stable
as $$
  select
    id, text, topic, action_taken, created_at,
    1 - (embedding <=> query_embedding) as similarity
  from worries
  where user_id = match_user_id
    and embedding is not null
    and 1 - (embedding <=> query_embedding) > match_threshold
  order by embedding <=> query_embedding
  limit match_count;
$$;

-- 5. Index for fast vector search
create index if not exists worries_embedding_idx on worries
using ivfflat (embedding vector_cosine_ops)
with (lists = 100);
