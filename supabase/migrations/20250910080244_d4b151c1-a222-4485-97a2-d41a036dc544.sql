-- Create profiles table for user data
create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text,
  full_name text,
  avatar_url text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- Enable RLS on profiles
alter table public.profiles enable row level security;

-- Users can view and update their own profile
create policy "Users can view own profile" 
  on public.profiles for select 
  using (auth.uid() = id);

create policy "Users can update own profile" 
  on public.profiles for update 
  using (auth.uid() = id);

create policy "Users can insert own profile" 
  on public.profiles for insert 
  with check (auth.uid() = id);

-- Function to handle new user signup
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.profiles (id, email, full_name)
  values (new.id, new.email, new.raw_user_meta_data ->> 'full_name');
  return new;
end;
$$;

-- Trigger to auto-create profile on user signup
drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- Update tasks table to link to users (for later when auth is implemented)
alter table public.tasks add column if not exists user_id uuid references auth.users(id);

-- Update tasks policies for user-specific access
drop policy if exists "Public can read tasks (dev)" on public.tasks;
drop policy if exists "Public can insert tasks (dev)" on public.tasks;
drop policy if exists "Public can update tasks (dev)" on public.tasks;
drop policy if exists "Public can delete tasks (dev)" on public.tasks;

-- New user-specific policies
create policy "Users can view own tasks" 
  on public.tasks for select 
  using (auth.uid() = user_id);

create policy "Users can insert own tasks" 
  on public.tasks for insert 
  with check (auth.uid() = user_id);

create policy "Users can update own tasks" 
  on public.tasks for update 
  using (auth.uid() = user_id);

create policy "Users can delete own tasks" 
  on public.tasks for delete 
  using (auth.uid() = user_id);