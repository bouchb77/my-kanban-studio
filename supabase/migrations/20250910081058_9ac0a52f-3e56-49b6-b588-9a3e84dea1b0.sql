-- Enable realtime for tasks table
alter table public.tasks replica identity full;
alter publication supabase_realtime add table public.tasks;