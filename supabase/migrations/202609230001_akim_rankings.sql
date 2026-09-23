-- Application data only. No changes to existing projects, users or datasets.
begin;

create table if not exists public.akim_players (
  id uuid primary key,
  display_name text not null check (char_length(display_name) between 3 and 32),
  credential_hash text not null unique check (credential_hash ~ '^[a-f0-9]{64}$'),
  created_at timestamptz not null default now()
);

create table if not exists public.akim_runs (
  id uuid primary key default gen_random_uuid(),
  player_id uuid not null references public.akim_players(id) on delete cascade,
  plan_hash text not null check (plan_hash ~ '^[a-f0-9]{64}$'),
  plan jsonb not null check (jsonb_typeof(plan) = 'array' and jsonb_array_length(plan) = 5),
  score double precision not null check (score between -50 and 100),
  delta double precision not null check (delta between -150 and 150),
  cost integer not null check (cost between 0 and 100),
  rules_version text not null,
  result jsonb not null check (jsonb_typeof(result) = 'object'),
  created_at timestamptz not null default now(),
  unique (player_id, plan_hash)
);
create index if not exists akim_runs_history_idx on public.akim_runs (player_id, created_at desc);
create index if not exists akim_runs_rank_idx on public.akim_runs (rules_version, score desc, cost, created_at);

alter table public.akim_players enable row level security;
alter table public.akim_runs enable row level security;
revoke all on public.akim_players, public.akim_runs from public, anon, authenticated;
grant select, insert, update, delete on public.akim_players, public.akim_runs to service_role;

-- Idempotent submission: repeat clicks do not duplicate a player's identical plan.
create or replace function public.akim_save_run(
  p_player_id uuid, p_plan_hash text, p_plan jsonb, p_score double precision,
  p_delta double precision, p_cost integer, p_rules_version text, p_result jsonb
) returns setof public.akim_runs
language sql volatile security invoker set search_path = public, pg_temp as $$
  insert into public.akim_runs (player_id, plan_hash, plan, score, delta, cost, rules_version, result)
  values (p_player_id, p_plan_hash, p_plan, p_score, p_delta, p_cost, p_rules_version, p_result)
  on conflict (player_id, plan_hash) do update set plan_hash = excluded.plan_hash
  returning *;
$$;

-- One best plan per player. Ties: lower cost, then earlier submitted, then UUID.
create or replace function public.akim_leaderboard(p_player_id uuid default null)
returns table (rank bigint, player_id uuid, display_name text, score double precision, cost integer, created_at timestamptz)
language sql stable security invoker set search_path = public, pg_temp as $$
  with best as (
    select distinct on (r.player_id) r.player_id, r.score, r.cost, r.created_at
    from public.akim_runs r where r.rules_version = 'hackalem-v1'
    order by r.player_id, r.score desc, r.cost, r.created_at, r.id
  ), ranked as (
    select row_number() over (order by b.score desc, b.cost, b.created_at, b.player_id) as rank,
      b.player_id, p.display_name, b.score, b.cost, b.created_at
    from best b join public.akim_players p on p.id = b.player_id
  )
  select * from ranked where p_player_id is null or player_id = p_player_id order by rank limit 50;
$$;

revoke all on function public.akim_save_run(uuid, text, jsonb, double precision, double precision, integer, text, jsonb) from public, anon, authenticated;
revoke all on function public.akim_leaderboard(uuid) from public, anon, authenticated;
grant execute on function public.akim_save_run(uuid, text, jsonb, double precision, double precision, integer, text, jsonb) to service_role;
grant execute on function public.akim_leaderboard(uuid) to service_role;
notify pgrst, 'reload schema';
commit;
