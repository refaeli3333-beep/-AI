-- MARKET RADAR AI — Economic Impact Investigation tables (SIMULATION ONLY).
-- Knowledge base + event-level impact mapping with evidence.

create table if not exists technologies (
  id text primary key,
  name text not null,
  category text,
  description text
);

create table if not exists components (
  id text primary key,
  name text not null,
  technology_id text references technologies(id),
  description text
);

create table if not exists company_capabilities (
  id uuid primary key default gen_random_uuid(),
  company_ticker text not null,
  technology_id text references technologies(id),
  component_id text references components(id),
  capability_type text,          -- manufactures|supplies|operates|designs|services
  product_name text,
  evidence_url text,
  confidence_score int
);

create table if not exists company_relationships_kb (
  id uuid primary key default gen_random_uuid(),
  source_company_ticker text,
  target_company_ticker text,
  relationship_type text,        -- SUPPLIES|BUYS_FROM|COMPETES_WITH|PARTNERS_WITH|DEPENDS_ON
  description text,
  evidence_url text,
  confidence_score int
);

create table if not exists event_needs (
  id uuid primary key default gen_random_uuid(),
  signal_id uuid references signals(id) on delete cascade,
  need_type text,
  description text,
  importance_score int
);

create table if not exists event_technologies (
  id uuid primary key default gen_random_uuid(),
  signal_id uuid references signals(id) on delete cascade,
  technology_id text references technologies(id),
  relevance_score int,
  reasoning text
);

create table if not exists event_company_impacts (
  id uuid primary key default gen_random_uuid(),
  signal_id uuid references signals(id) on delete cascade,
  ticker text,
  impact_type text,              -- beneficiary_direct|component_supplier|infrastructure_provider|possible_loser|...
  directness_score int,
  opportunity_score int,
  risk_score int,
  already_priced_in_score int,
  revenue_mechanism text,
  expected_time_to_revenue text, -- immediate|short|medium|long
  explanation text,
  confidence_score int
);

create table if not exists impact_evidence (
  id uuid primary key default gen_random_uuid(),
  event_company_impact_id uuid references event_company_impacts(id) on delete cascade,
  source_url text,
  source_type text,
  extracted_fact text,
  reliability_score int,
  relevance_score int
);

create index if not exists idx_eci_signal on event_company_impacts(signal_id);
create index if not exists idx_impact_evidence_eci on impact_evidence(event_company_impact_id);
