-- MARKET RADAR AI — smart scan command history (SIMULATION ONLY).
create table if not exists scan_commands (
  id uuid primary key default gen_random_uuid(),
  user_id uuid,
  command_text text not null,
  parsed_command_json jsonb,
  status text default 'running',   -- running|completed|failed
  progress int default 0,
  current_stage text,
  providers_used text[] default '{}',
  result_count int default 0,
  signal_count int default 0,
  error_count int default 0,
  created_at timestamptz default now(),
  started_at timestamptz,
  completed_at timestamptz
);

create table if not exists scan_command_results (
  id uuid primary key default gen_random_uuid(),
  scan_command_id uuid references scan_commands(id) on delete cascade,
  search_result_id uuid,
  signal_id uuid,
  rank int,
  relevance_score int,
  included boolean default true,
  exclusion_reason text
);
create index if not exists idx_scr_command on scan_command_results(scan_command_id);
