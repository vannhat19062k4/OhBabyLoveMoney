create table if not exists public.user_app_state (
  user_id uuid primary key references auth.users(id) on delete cascade,
  email text,
  payload jsonb not null default '{}'::jsonb,
  version integer not null default 1,
  updated_at timestamptz not null default now()
);

alter table public.user_app_state enable row level security;

create policy "Users can read their own financial data"
on public.user_app_state for select
using (auth.uid() = user_id);

create policy "Users can insert their own financial data"
on public.user_app_state for insert
with check (auth.uid() = user_id);

create policy "Users can update their own financial data"
on public.user_app_state for update
using (auth.uid() = user_id)
with check (auth.uid() = user_id);
