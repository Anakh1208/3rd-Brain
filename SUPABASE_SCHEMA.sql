-- Run this in Supabase SQL Editor (https://app.supabase.com → SQL Editor)

-- Worries table
create table if not exists worries (
  id uuid default gen_random_uuid() primary key,
  text text not null,
  topic text,
  created_at timestamp with time zone default now()
);

-- Habits table
create table if not exists habits (
  id uuid default gen_random_uuid() primary key,
  worry_id uuid references worries(id) on delete cascade,
  name text not null,
  topic text,
  streak int default 0,
  created_at timestamp with time zone default now()
);

-- Habit completions (one row per day completed)
create table if not exists habit_completions (
  id uuid default gen_random_uuid() primary key,
  habit_id uuid references habits(id) on delete cascade,
  completed_date date default current_date,
  unique(habit_id, completed_date)
);

-- Events table
create table if not exists events (
  id uuid default gen_random_uuid() primary key,
  worry_id uuid references worries(id) on delete cascade,
  name text not null,
  topic text,
  deadline text,
  done boolean default false,
  created_at timestamp with time zone default now()
);

-- Enable Row Level Security (optional for hackathon - disable for speed)
alter table worries enable row level security;
alter table habits enable row level security;
alter table habit_completions enable row level security;
alter table events enable row level security;

-- Allow all access (for hackathon - no auth needed)
create policy "allow all worries" on worries for all using (true) with check (true);
create policy "allow all habits" on habits for all using (true) with check (true);
create policy "allow all completions" on habit_completions for all using (true) with check (true);
create policy "allow all events" on events for all using (true) with check (true);
