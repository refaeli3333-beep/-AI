-- MARKET RADAR AI — GOAL 4: structured long-term memory & learning (ADDITIVE ONLY).
-- All `if not exists`; no existing table altered/dropped. Learning = better memory/ranking/
-- calibration, NOT self-modifying code. Safe to run repeatedly.
create extension if not exists "pgcrypto";

create table if not exists observations (
  id uuid primary key default gen_random_uuid(), scan_id uuid, entity text, kind text,
  payload jsonb, source_url text, observed_at timestamptz default now());

create table if not exists memory_events (
  id uuid primary key default gen_random_uuid(), cluster_key text, title_he text,
  event_time timestamptz, created_at timestamptz default now());

create table if not exists memory_sources (
  id uuid primary key default gen_random_uuid(), url text unique, domain text,
  reliability_score int, first_seen timestamptz default now());

create table if not exists memory_entities (
  id uuid primary key default gen_random_uuid(), kind text, name text, ticker text,
  metadata jsonb default '{}', unique(kind, name));

create table if not exists claims (
  id uuid primary key default gen_random_uuid(), event_id uuid, text text, made_by text,
  is_direct_quote boolean, created_at timestamptz default now());

create table if not exists hypotheses (
  id uuid primary key default gen_random_uuid(), question text, statement text,
  status text default 'open', created_at timestamptz default now());

create table if not exists agent_results (
  id uuid primary key default gen_random_uuid(), investigation_id uuid, agent_id text,
  stance text, confidence int, evidence_quality int, argument text, created_at timestamptz default now());

create table if not exists contradictions (
  id uuid primary key default gen_random_uuid(), investigation_id uuid, claim_a text, claim_b text,
  note text, created_at timestamptz default now());

create table if not exists conclusions (
  id uuid primary key default gen_random_uuid(), investigation_id uuid, question text,
  reasoning_summary text, confidence int, consensus_score int, evidence_quality int,
  agents_involved text[], bull_arguments text[], bear_arguments text[], unresolved_questions text[],
  future_verification_triggers text[], sources jsonb, created_at timestamptz default now());

create table if not exists confidence_history (
  id uuid primary key default gen_random_uuid(), conclusion_id uuid, confidence int, recorded_at timestamptz default now());

create table if not exists prediction_results (
  id uuid primary key default gen_random_uuid(), conclusion_id uuid, predicted_direction text,
  realized_direction text, correct boolean, evaluated_at timestamptz default now());

create table if not exists provider_reliability (
  provider_key text primary key, total_checks int default 0, successes int default 0,
  failures int default 0, avg_latency_ms int, updated_at timestamptz default now());

create table if not exists source_reliability (
  domain text primary key, samples int default 0, upheld int default 0, refuted int default 0,
  score int, updated_at timestamptz default now());

create table if not exists lessons_learned (
  id uuid primary key default gen_random_uuid(), topic text, lesson text, evidence jsonb,
  created_at timestamptz default now());

create table if not exists agent_performance (
  agent_id text primary key, total_investigations int default 0, correct int default 0,
  incorrect int default 0, calibration numeric, specialty_score numeric, source_quality numeric,
  contribution numeric, updated_at timestamptz default now());
