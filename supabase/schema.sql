-- ============================================================
-- Shortlist Database Schema
-- Run this in the Supabase SQL Editor (supabase.com → SQL Editor)
-- ============================================================

-- Enable UUID extension (already enabled by default in Supabase)
create extension if not exists "uuid-ossp";

-- ============================================================
-- ENUMS
-- ============================================================

create type user_type as enum (
  'student',
  'career_switcher',
  'mid_career',
  'executive'
);

create type document_type as enum (
  'bullets',
  'summary',
  'cover_letter'
);

create type validator_verdict as enum (
  'PASS',
  'REVISE',
  'REJECT'
);

-- ============================================================
-- PROFILES
-- Extends Supabase auth.users — one row per user
-- Created automatically on signup via trigger below
-- ============================================================

create table profiles (
  id              uuid primary key references auth.users(id) on delete cascade,
  user_type          user_type,
  current_job_title  text,
  target_job_title   text,
  industry        text,
  years_experience int,
  onboarding_done boolean not null default false,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

-- Auto-create a profile row when a user signs up.
-- SECURITY DEFINER functions must pin search_path and fully qualify table
-- names, or the insert fails with "Database error saving new user".
create or replace function handle_new_user()
returns trigger as $$
begin
  insert into public.profiles (id)
  values (new.id);
  return new;
end;
$$ language plpgsql security definer set search_path = public;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure handle_new_user();

-- ============================================================
-- JOB APPLICATIONS
-- One row per job the user is applying to
-- ============================================================

create table job_applications (
  id           uuid primary key default uuid_generate_v4(),
  user_id      uuid not null references auth.users(id) on delete cascade,
  company_name text,
  job_title    text,
  jd_raw       text not null,           -- raw pasted job description
  jd_analysis  jsonb,                   -- structured output from JD parser
  created_at   timestamptz not null default now()
);

-- ============================================================
-- GENERATIONS
-- One row per document generated (bullets, summary, cover letter)
-- ============================================================

create table generations (
  id                  uuid primary key default uuid_generate_v4(),
  user_id             uuid not null references auth.users(id) on delete cascade,
  job_application_id  uuid references job_applications(id) on delete set null,
  document_type       document_type not null,
  input_data          jsonb not null,           -- full prompt context used
  output_text         text not null,            -- raw generated content
  validator_scores    jsonb,                    -- { specificity, relevance, authenticity, impact, clean, overall }
  validator_verdict   validator_verdict,
  retry_count         int not null default 0,
  created_at          timestamptz not null default now()
);

-- ============================================================
-- ROW LEVEL SECURITY
-- Users can only read and write their own data
-- ============================================================

alter table profiles         enable row level security;
alter table job_applications enable row level security;
alter table generations      enable row level security;

-- Profiles
create policy "Users can view own profile"
  on profiles for select
  using (auth.uid() = id);

create policy "Users can update own profile"
  on profiles for update
  using (auth.uid() = id);

-- Job Applications
create policy "Users can view own job applications"
  on job_applications for select
  using (auth.uid() = user_id);

create policy "Users can insert own job applications"
  on job_applications for insert
  with check (auth.uid() = user_id);

create policy "Users can delete own job applications"
  on job_applications for delete
  using (auth.uid() = user_id);

-- Generations
create policy "Users can view own generations"
  on generations for select
  using (auth.uid() = user_id);

create policy "Users can insert own generations"
  on generations for insert
  with check (auth.uid() = user_id);

-- ============================================================
-- INDEXES
-- ============================================================

create index on job_applications (user_id, created_at desc);
create index on generations      (user_id, created_at desc);
create index on generations      (job_application_id);
