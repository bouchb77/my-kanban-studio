-- Create user_preferences table for general settings
create table if not exists public.user_preferences (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade not null unique,
  notifications jsonb default '{"email": true, "push": true, "daysBeforeDue": 3, "dailyDigest": false}'::jsonb,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- Create user_columns table for Kanban columns customization
create table if not exists public.user_columns (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade not null,
  title text not null,
  status text not null,
  color text not null default '#64748b',
  "order" integer not null default 0,
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  unique(user_id, status)
);

-- Create user_custom_fields table for custom form fields
create table if not exists public.user_custom_fields (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade not null,
  name text not null,
  type text not null check (type in ('text', 'number', 'select', 'date', 'checkbox')),
  options jsonb default '[]'::jsonb,
  required boolean default false,
  "order" integer not null default 0,
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  unique(user_id, name)
);

-- Enable RLS
alter table public.user_preferences enable row level security;
alter table public.user_columns enable row level security;
alter table public.user_custom_fields enable row level security;

-- Policies for user_preferences
create policy "Users can view own preferences" 
  on public.user_preferences for select 
  using (auth.uid() = user_id);

create policy "Users can insert own preferences" 
  on public.user_preferences for insert 
  with check (auth.uid() = user_id);

create policy "Users can update own preferences" 
  on public.user_preferences for update 
  using (auth.uid() = user_id);

-- Policies for user_columns
create policy "Users can view own columns" 
  on public.user_columns for select 
  using (auth.uid() = user_id);

create policy "Users can insert own columns" 
  on public.user_columns for insert 
  with check (auth.uid() = user_id);

create policy "Users can update own columns" 
  on public.user_columns for update 
  using (auth.uid() = user_id);

create policy "Users can delete own columns" 
  on public.user_columns for delete 
  using (auth.uid() = user_id);

-- Policies for user_custom_fields
create policy "Users can view own custom fields" 
  on public.user_custom_fields for select 
  using (auth.uid() = user_id);

create policy "Users can insert own custom fields" 
  on public.user_custom_fields for insert 
  with check (auth.uid() = user_id);

create policy "Users can update own custom fields" 
  on public.user_custom_fields for update 
  using (auth.uid() = user_id);

create policy "Users can delete own custom fields" 
  on public.user_custom_fields for delete 
  using (auth.uid() = user_id);

-- Insert default columns for all existing users
insert into public.user_columns (user_id, title, status, color, "order")
select 
  p.id,
  case 
    when s.status = 'todo' then 'À faire'
    when s.status = 'in-progress' then 'En cours' 
    when s.status = 'review' then 'En révision'
    when s.status = 'done' then 'Terminé'
  end,
  s.status,
  case 
    when s.status = 'todo' then '#94a3b8'
    when s.status = 'in-progress' then '#3b82f6'
    when s.status = 'review' then '#eab308'
    when s.status = 'done' then '#22c55e'
  end,
  s.order_num
from public.profiles p
cross join (
  values 
    ('todo', 1),
    ('in-progress', 2), 
    ('review', 3),
    ('done', 4)
) as s(status, order_num)
on conflict (user_id, status) do nothing;

-- Add triggers for updated_at
create or replace trigger update_user_preferences_updated_at
  before update on public.user_preferences
  for each row execute function public.update_updated_at_column();

create or replace trigger update_user_columns_updated_at
  before update on public.user_columns
  for each row execute function public.update_updated_at_column();

create or replace trigger update_user_custom_fields_updated_at
  before update on public.user_custom_fields
  for each row execute function public.update_updated_at_column();