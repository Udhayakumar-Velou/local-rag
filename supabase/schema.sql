-- ========================================================
-- Supabase Cloud Schema for Local RAG Studio
-- Run this in your Supabase Project -> SQL Editor
-- ========================================================

-- 1. Create Projects Table
create table if not exists public.projects (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  description text default '',
  color text default '#6366f1',
  custom_prompt text default '',
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  updated_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Ensure custom_prompt column exists if the table was created earlier
alter table public.projects add column if not exists custom_prompt text default '';

-- 2. Create Conversations Table
create table if not exists public.conversations (
  id text primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  project_id uuid references public.projects(id) on delete set null,
  title text not null default 'New conversation',
  messages jsonb not null default '[]'::jsonb,
  updated_at bigint not null,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- 3. Enable Row Level Security (RLS)
alter table public.projects enable row level security;
alter table public.conversations enable row level security;

-- 4. Projects RLS Policies
create policy "Users can view their own projects"
  on public.projects for select
  using (auth.uid() = user_id);

create policy "Users can insert their own projects"
  on public.projects for insert
  with check (auth.uid() = user_id);

create policy "Users can update their own projects"
  on public.projects for update
  using (auth.uid() = user_id);

create policy "Users can delete their own projects"
  on public.projects for delete
  using (auth.uid() = user_id);

-- 5. Conversations RLS Policies
create policy "Users can view their own conversations"
  on public.conversations for select
  using (auth.uid() = user_id);

create policy "Users can insert their own conversations"
  on public.conversations for insert
  with check (auth.uid() = user_id);

create policy "Users can update their own conversations"
  on public.conversations for update
  using (auth.uid() = user_id);

create policy "Users can delete their own conversations"
  on public.conversations for delete
  using (auth.uid() = user_id);

-- 6. Indexes for fast retrieval
create index if not exists idx_projects_user_id on public.projects(user_id);
create index if not exists idx_conversations_user_id on public.conversations(user_id);
create index if not exists idx_conversations_project_id on public.conversations(project_id);

-- 7. Create Job Leads Table for Autonomous Lead Agent (France Job Search)
create table if not exists public.job_leads (
  id text primary key,
  user_id uuid references auth.users(id) on delete cascade,
  canonical_key text not null,
  job_data jsonb not null,
  user_status text not null default 'inbox',
  overall_score integer not null default 0,
  job_category text not null default 'Combined AI + Software Engineering',
  updated_at timestamp with time zone default timezone('utc'::text, now()) not null,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

alter table public.job_leads enable row level security;

create policy "Anyone can view job leads"
  on public.job_leads for select
  using (true);

create policy "Service or users can insert job leads"
  on public.job_leads for insert
  with check (true);

create policy "Service or users can update job leads"
  on public.job_leads for update
  using (true);

create index if not exists idx_job_leads_canonical_key on public.job_leads(canonical_key);
create index if not exists idx_job_leads_overall_score on public.job_leads(overall_score desc);

-- 8. Create Lead Agent Settings Table (Stores Personal Profile, Master Prompt & CVs in Cloud; API Key stays in .env / Cloud Secrets)
create table if not exists public.lead_agent_settings (
  id text primary key default 'default',
  user_id uuid references auth.users(id) on delete cascade,
  candidate_name text default '',
  candidate_headline text default '',
  cv_en_name text default 'CV_EN.pdf',
  cv_fr_name text default 'CV_FR.pdf',
  master_prompt text default '',
  search_queries jsonb default '["AI Engineer", "LLM RAG Python", "React TypeScript", "Frontend Engineer React", "Full Stack React Python"]'::jsonb,
  scan_frequency text default '6h',
  updated_at timestamp with time zone default timezone('utc'::text, now()) not null
);

alter table public.lead_agent_settings enable row level security;

create policy "Users can view lead agent settings"
  on public.lead_agent_settings for select
  using (true);

create policy "Users can insert lead agent settings"
  on public.lead_agent_settings for insert
  with check (true);

create policy "Users can update lead agent settings"
  on public.lead_agent_settings for update
  using (true);
