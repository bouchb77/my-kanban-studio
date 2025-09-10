-- Create tasks table for persisting created tasks
create extension if not exists pgcrypto;

-- Helper function to auto-update updated_at
create or replace function public.update_updated_at_column()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql set search_path = public;

-- Create tasks table
create table if not exists public.tasks (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  description text,
  status text not null default 'todo', -- todo | in-progress | review | done
  priority text not null default 'medium', -- low | medium | high
  tags text[] not null default '{}',
  assignee text,
  due_date timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Enable RLS
alter table public.tasks enable row level security;

-- Development policies (public access). You can tighten later when auth is enabled.
create policy "Public can read tasks (dev)"
  on public.tasks for select using (true);

create policy "Public can insert tasks (dev)"
  on public.tasks for insert with check (true);

create policy "Public can update tasks (dev)"
  on public.tasks for update using (true) with check (true);

create policy "Public can delete tasks (dev)"
  on public.tasks for delete using (true);

-- Trigger for updated_at
create or replace trigger trg_tasks_updated_at
before update on public.tasks
for each row execute function public.update_updated_at_column();