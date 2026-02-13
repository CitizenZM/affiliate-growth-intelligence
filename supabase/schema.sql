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

-- Pipeline mirrors for dataset processing and AI analysis
create table if not exists public.dataset_runs (
  dataset_id text primary key,
  file_name text,
  version_label text,
  status text not null default 'pending',
  processing_progress numeric not null default 0,
  processing_step text,
  sections_ready jsonb not null default '[]'::jsonb,
  field_mapping jsonb not null default '{}'::jsonb,
  row_count integer not null default 0,
  updated_at timestamptz not null default now()
);

alter table public.dataset_runs add column if not exists field_mapping jsonb not null default '{}'::jsonb;
alter table public.dataset_runs add column if not exists row_count integer not null default 0;

create table if not exists public.analysis_metrics (
  dataset_id text not null,
  metric_key text not null,
  value_num double precision,
  module_id integer,
  calc_version text,
  updated_at timestamptz not null default now(),
  primary key (dataset_id, metric_key)
);

create table if not exists public.analysis_evidence_tables (
  dataset_id text not null,
  table_key text not null,
  data_json jsonb not null default '[]'::jsonb,
  module_id integer,
  row_count integer,
  updated_at timestamptz not null default now(),
  primary key (dataset_id, table_key)
);

create table if not exists public.analysis_sections (
  dataset_id text not null,
  section_id integer not null,
  title text,
  conclusion text,
  conclusion_status text,
  content_md text,
  key_findings jsonb not null default '[]'::jsonb,
  derivation_notes jsonb not null default '[]'::jsonb,
  ai_generated boolean not null default false,
  updated_at timestamptz not null default now(),
  primary key (dataset_id, section_id)
);

alter table public.dataset_runs enable row level security;
alter table public.analysis_metrics enable row level security;
alter table public.analysis_evidence_tables enable row level security;
alter table public.analysis_sections enable row level security;

drop policy if exists "dataset_runs_all_read" on public.dataset_runs;
create policy "dataset_runs_all_read"
on public.dataset_runs for select
to anon, authenticated
using (true);

drop policy if exists "dataset_runs_all_write" on public.dataset_runs;
create policy "dataset_runs_all_write"
on public.dataset_runs for all
to anon, authenticated
using (true)
with check (true);

drop policy if exists "analysis_metrics_all_read" on public.analysis_metrics;
create policy "analysis_metrics_all_read"
on public.analysis_metrics for select
to anon, authenticated
using (true);

drop policy if exists "analysis_metrics_all_write" on public.analysis_metrics;
create policy "analysis_metrics_all_write"
on public.analysis_metrics for all
to anon, authenticated
using (true)
with check (true);

drop policy if exists "analysis_evidence_tables_all_read" on public.analysis_evidence_tables;
create policy "analysis_evidence_tables_all_read"
on public.analysis_evidence_tables for select
to anon, authenticated
using (true);

drop policy if exists "analysis_evidence_tables_all_write" on public.analysis_evidence_tables;
create policy "analysis_evidence_tables_all_write"
on public.analysis_evidence_tables for all
to anon, authenticated
using (true)
with check (true);

drop policy if exists "analysis_sections_all_read" on public.analysis_sections;
create policy "analysis_sections_all_read"
on public.analysis_sections for select
to anon, authenticated
using (true);

drop policy if exists "analysis_sections_all_write" on public.analysis_sections;
create policy "analysis_sections_all_write"
on public.analysis_sections for all
to anon, authenticated
using (true)
with check (true);
