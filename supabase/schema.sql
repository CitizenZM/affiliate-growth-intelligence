-- Supabase schema for Action Plan
-- Run in Supabase SQL editor.

create extension if not exists pgcrypto;

create table if not exists public.action_items (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  workstream text not null default 'other',
  priority text not null default 'medium' check (priority in ('high', 'medium', 'low')),
  owner text,
  due_date date,
  notes text,
  status text not null default 'todo' check (status in ('todo', 'doing', 'done')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_action_items_created_at on public.action_items (created_at desc);
create index if not exists idx_action_items_status on public.action_items (status);

create or replace function public.set_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

drop trigger if exists trg_action_items_set_updated_at on public.action_items;
create trigger trg_action_items_set_updated_at
before update on public.action_items
for each row execute function public.set_updated_at();

alter table public.action_items enable row level security;

-- For quick start/demo only. Tighten policies for production.
drop policy if exists "action_items_select_all" on public.action_items;
create policy "action_items_select_all"
on public.action_items for select
to anon, authenticated
using (true);

drop policy if exists "action_items_insert_all" on public.action_items;
create policy "action_items_insert_all"
on public.action_items for insert
to anon, authenticated
with check (true);

drop policy if exists "action_items_update_all" on public.action_items;
create policy "action_items_update_all"
on public.action_items for update
to anon, authenticated
using (true)
with check (true);

