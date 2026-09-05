-- MARKET RADAR AI — schema (SIMULATION ONLY). All times stored in UTC.
-- Existing core tables are kept; search/scan tables are added.

create extension if not exists "pgcrypto";

-- ----- people (extended with alias / scan fields) -----
create table if not exists influential_people (
  id uuid primary key default gen_random_uuid(),
  full_name text not null,
  display_name text,
  name_in_original_language text,
  aliases text[] default '{}',
  "current_role" text,
  company text,
  organization text,
  country text,
  category text,
  industry text,
  importance_score int default 50,
  official_domains text[] default '{}',
  official_social_profiles jsonb default '{}',
  search_languages text[] default '{en}',
  search_keywords text[] default '{}',
  negative_keywords text[] default '{}',
  profile_image_url text,
  official_website text,
  x_profile_url text,
  linkedin_url text,
  youtube_url text,
  is_verified boolean default false,
  is_active boolean default true,
  is_favorite boolean default false,
  active_scan boolean default true,
  scan_priority text default 'medium',   -- high | medium | low
  last_scanned_at timestamptz,
  next_scan_at timestamptz,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table if not exists sectors (
  id serial primary key,
  name text unique not null,
  description text,
  parent_sector_id int references sectors(id)
);

create table if not exists assets (
  id uuid primary key default gen_random_uuid(),
  symbol text not null,
  name text,
  asset_type text,          -- stock | crypto | etf | commodity
  sector_id int references sectors(id),
  sub_sector text,          -- e.g. memory / cooling / fiber
  exchange text,
  country text,
  currency text default 'USD',
  market_cap numeric,
  is_active boolean default true
);

create table if not exists companies (
  id uuid primary key default gen_random_uuid(),
  name text,
  ticker text,
  country text,
  sector_id int references sectors(id),
  description text,
  website text,
  market_cap numeric
);

create table if not exists company_relationships (
  id uuid primary key default gen_random_uuid(),
  company_id uuid references companies(id),
  related_company_id uuid references companies(id),
  relationship_type text,   -- supplier|customer|competitor|partner|subsidiary|parent_company|contractor|government_supplier
  description text
);

create table if not exists signals (
  id uuid primary key default gen_random_uuid(),
  person_id uuid references influential_people(id),
  source_document_id uuid,
  original_text text,
  translated_text text,
  simple_summary text,
  direct_quote text,        -- null if no direct quote was found
  source_url text,
  source_type text,
  published_at timestamptz, -- null if exact time unknown (do NOT invent)
  discovered_at timestamptz default now(),
  topic text,
  event_type text,
  event_stage text,
  country text,
  confidence_score int,
  risk_level text,
  verification_status text, -- verified|partially_verified|needs_review|rumor|unverified
  connection_tag text,      -- direct|indirect|weak|no_clear_link|insufficient_data
  content_hash text,        -- for signal-level dedup
  news_source text,         -- LIVE | MOCK
  price_source text,        -- LIVE | MOCK
  analysis_source text,     -- LIVE | MOCK
  data_completeness int,    -- 0..100
  is_demo boolean default true,
  created_at timestamptz default now()
);
create index if not exists idx_signals_content_hash on signals(content_hash);

create table if not exists signal_assets (
  id uuid primary key default gen_random_uuid(),
  signal_id uuid references signals(id) on delete cascade,
  asset_id uuid references assets(id),
  connection_reason text,
  role_in_chain text,       -- direct_beneficiary|supplier|component|infrastructure|indirect|competitor
  directness_score int,
  evidence_score int,
  market_reaction_score int,
  already_priced_in_score int,
  opportunity_score int,
  risk_score int,
  confidence_score int,
  price_at_signal numeric
);

create table if not exists simulations (
  id uuid primary key default gen_random_uuid(),
  signal_id uuid references signals(id) on delete cascade,
  asset_id uuid references assets(id),
  investment_amount numeric default 200,
  entry_price numeric,
  units numeric,
  current_price numeric,
  current_value numeric,
  profit_loss numeric,
  profit_loss_percent numeric,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table if not exists price_snapshots (
  id uuid primary key default gen_random_uuid(),
  asset_id uuid references assets(id),
  signal_id uuid references signals(id) on delete cascade,
  snapshot_type text,       -- signal|h1|h3|d1|d3|d7|d30|now
  price numeric,
  portfolio_value numeric,
  profit_loss numeric,
  profit_loss_percent numeric,
  volume numeric,
  volume_anomaly boolean default false,
  recorded_at timestamptz default now()
);

-- ----- market candles (never use current price as a historical price) -----
create table if not exists market_candles (
  id uuid primary key default gen_random_uuid(),
  provider text,
  symbol text,
  exchange text,
  currency text,
  ts_utc timestamptz not null,
  ts_local timestamptz,
  interval text,            -- 1m|5m|1h|1d
  open numeric, high numeric, low numeric, close numeric,
  volume numeric,
  adjusted boolean default false,
  market_session text,      -- regular|pre|post|closed
  received_at timestamptz default now(),
  unique (provider, symbol, interval, ts_utc)
);

-- ===================== SEARCH / SCAN LAYER =====================
create table if not exists search_queries (
  id uuid primary key default gen_random_uuid(),
  person_id uuid references influential_people(id),
  query_text text not null,
  query_kind text,          -- fresh|financial|official|language
  language text,
  priority text,
  is_active boolean default true,
  last_used_at timestamptz,
  result_count int default 0
);

create table if not exists search_runs (
  id uuid primary key default gen_random_uuid(),
  provider text,
  started_at timestamptz default now(),
  completed_at timestamptz,
  status text,              -- running|completed|failed
  people_scanned int default 0,
  query_count int default 0,
  results_found int default 0,
  new_results int default 0,
  verified_results int default 0,
  signals_created int default 0,
  errors_count int default 0
);

create table if not exists search_results (
  id uuid primary key default gen_random_uuid(),
  search_run_id uuid references search_runs(id) on delete cascade,
  person_id uuid references influential_people(id),
  provider text,
  query_text text,
  title text,
  url text,
  domain text,
  snippet text,
  published_at timestamptz, -- null when unknown
  discovered_at timestamptz default now(),
  content_hash text,
  verification_status text default 'unverified',
  source_score int,
  processing_status text default 'pending', -- pending|processed|rejected
  reject_reason text,
  unique (url),
  unique (content_hash)
);

create table if not exists source_documents (
  id uuid primary key default gen_random_uuid(),
  search_result_id uuid references search_results(id) on delete cascade,
  canonical_url text,
  title text,
  author text,
  original_language text,
  raw_text text,
  extracted_text text,
  direct_quotes text[],
  published_at timestamptz,
  fetched_at timestamptz default now(),
  content_hash text,
  fetch_status text         -- ok|blocked|error|not_found
);

create table if not exists scan_schedules (
  id uuid primary key default gen_random_uuid(),
  person_id uuid references influential_people(id) on delete cascade,
  scan_frequency_minutes int default 30,
  priority text default 'medium',
  last_scan_at timestamptz,
  next_scan_at timestamptz,
  enabled boolean default true
);

-- ----- provider connections / quota / verification -----
create table if not exists provider_connections (
  id uuid primary key default gen_random_uuid(),
  provider_key text unique,
  is_connected boolean default false,
  missing_env_keys text[] default '{}',
  last_checked_at timestamptz,
  records_collected int default 0,
  errors_count int default 0,
  rate_limit_remaining int,
  avg_response_ms int,
  data_quality int
);

create table if not exists api_usage (
  id uuid primary key default gen_random_uuid(),
  provider text,
  day date default current_date,
  queries_used int default 0,
  daily_quota int,
  rate_limit_errors int default 0,
  estimated_cost numeric default 0,
  unique (provider, day)
);

create table if not exists verification_checks (
  id uuid primary key default gen_random_uuid(),
  signal_id uuid references signals(id) on delete cascade,
  check_type text,          -- account_id|source_url|publish_time|is_official|is_edited|is_repost|is_satire|has_denial|single_source
  result boolean,
  detail text,
  checked_at timestamptz default now()
);

create index if not exists idx_signals_person on signals(person_id);
create index if not exists idx_results_run on search_results(search_run_id);
create index if not exists idx_candles_symbol_ts on market_candles(symbol, ts_utc);

