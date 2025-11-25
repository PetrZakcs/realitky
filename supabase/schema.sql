create table if not exists public.searches (
  id uuid primary key default gen_random_uuid(),
  user_id uuid,
  params jsonb not null,
  created_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.results (
  id uuid primary key default gen_random_uuid(),
  search_id uuid references public.searches(id) on delete cascade,
  data_json jsonb not null,
  ai_score numeric,
  ai_reason text,
  created_at timestamptz not null default timezone('utc', now())
);

create index if not exists idx_results_search_id on public.results(search_id);

