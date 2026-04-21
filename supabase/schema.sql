create extension if not exists pgcrypto;

create table if not exists public.calendar_events (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  category text not null,
  status text not null check (status in ('confirmed', 'estimated', 'watchlist')),
  location text not null default '',
  start_date date not null,
  end_date date not null,
  source_url text not null default '',
  notes text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint calendar_events_date_order check (end_date >= start_date)
);

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists calendar_events_set_updated_at on public.calendar_events;

create trigger calendar_events_set_updated_at
before update on public.calendar_events
for each row
execute function public.set_updated_at();

alter table public.calendar_events enable row level security;

drop policy if exists "calendar_events_select" on public.calendar_events;
create policy "calendar_events_select"
on public.calendar_events
for select
to anon, authenticated
using (true);

drop policy if exists "calendar_events_insert" on public.calendar_events;
create policy "calendar_events_insert"
on public.calendar_events
for insert
to anon, authenticated
with check (true);

drop policy if exists "calendar_events_update" on public.calendar_events;
create policy "calendar_events_update"
on public.calendar_events
for update
to anon, authenticated
using (true)
with check (true);

drop policy if exists "calendar_events_delete" on public.calendar_events;
create policy "calendar_events_delete"
on public.calendar_events
for delete
to anon, authenticated
using (true);
