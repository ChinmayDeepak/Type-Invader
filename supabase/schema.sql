-- Type Invaders: run this ENTIRE file in a NEW Supabase project's SQL Editor.
-- Re-running is safe. It does not delete accounts, scores, or edited packs.
-- Auth users are managed by Supabase; this app never stores passwords.
begin;
create schema if not exists ti_private;
revoke all on schema ti_private from public, anon, authenticated;

create table if not exists public.ti_profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  username text not null check (username ~ '^[A-Za-z0-9_]{3,24}$'),
  role text not null default 'USER' check (role in ('USER','ADMIN')),
  banned boolean not null default false,
  best_score integer not null default 0,
  created_at timestamptz not null default now()
);
create unique index if not exists ti_username_unique on public.ti_profiles(lower(username));
create table if not exists public.ti_runs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.ti_profiles(id) on delete cascade,
  status text not null default 'IN_PROGRESS' check (status in ('IN_PROGRESS','COMPLETED','REJECTED')),
  started_at timestamptz not null default now(), finished_at timestamptz,
  score integer not null default 0, kills integer not null default 0,
  bosses integer not null default 0, best_combo integer not null default 0,
  wpm integer not null default 0, accuracy integer not null default 0,
  stage_reached integer not null default 1, rounds_cleared integer not null default 0,
  rank text, duration_sec integer not null default 0, won boolean not null default false,
  difficulty text check (difficulty in ('EASY','NORMAL','HARD')),
  assisted boolean not null default false, reject_reason text
);
create index if not exists ti_runs_player_history on public.ti_runs(user_id,finished_at desc) where status='COMPLETED';
create index if not exists ti_runs_leaderboard on public.ti_runs(score desc,finished_at desc) where status='COMPLETED';
create index if not exists ti_runs_starts on public.ti_runs(user_id,started_at desc);
create table if not exists public.ti_word_packs (
  id uuid primary key default gen_random_uuid(), name text not null unique,
  tier integer not null check (tier between 1 and 5),
  active boolean not null default true,
  words text[] not null check (cardinality(words) between 1 and 500)
);
-- No direct browser access, including for admins. Every operation goes through
-- an explicitly granted function that validates auth.uid() and the stored role.
alter table public.ti_profiles enable row level security;
alter table public.ti_runs enable row level security;
alter table public.ti_word_packs enable row level security;
revoke all on public.ti_profiles, public.ti_runs, public.ti_word_packs from public, anon, authenticated;

create or replace function ti_private.new_player() returns trigger
language plpgsql security definer set search_path = '' as $$
declare callsign text;
begin
  callsign := trim(new.raw_user_meta_data->>'username');
  if callsign is null or callsign !~ '^[A-Za-z0-9_]{3,24}$' then
    raise exception 'Callsign must be 3-24 letters, numbers or underscores';
  end if;
  -- Never trust role, banned or bestScore from user-editable metadata.
  insert into public.ti_profiles(id,username) values (new.id,callsign);
  return new;
end $$;
drop trigger if exists ti_new_player on auth.users;
create trigger ti_new_player after insert on auth.users for each row execute function ti_private.new_player();

create or replace function ti_private.require_player(p_admin boolean default false)
returns public.ti_profiles language plpgsql security definer set search_path = '' as $$
declare p public.ti_profiles;
begin
  select * into p from public.ti_profiles where id=auth.uid();
  if not found then raise exception 'Sign in to continue' using errcode='42501'; end if;
  if p.banned then raise exception 'This account is suspended' using errcode='42501'; end if;
  if p_admin and p.role <> 'ADMIN' then raise exception 'Admin access required' using errcode='42501'; end if;
  return p;
end $$;

create or replace function ti_private.run_json(r public.ti_runs) returns jsonb
language sql immutable set search_path = '' as $$
  select jsonb_build_object('id',r.id,'score',r.score,'kills',r.kills,'bosses',r.bosses,
    'bestCombo',r.best_combo,'wpm',r.wpm,'accuracy',r.accuracy,'stageReached',r.stage_reached,
    'roundsCleared',r.rounds_cleared,'rank',r.rank,'durationSec',r.duration_sec,'won',r.won,
    'difficulty',r.difficulty,'finishedAt',r.finished_at,'status',r.status,'assisted',r.assisted);
$$;
create or replace function ti_private.check_page(p_page integer,p_size integer) returns void
language plpgsql set search_path = '' as $$
begin
  if p_page is null or p_size is null or p_page not between 0 and 10000 or p_size not between 1 and 100 then
    raise exception 'Page must be 0-10000 and size must be 1-100';
  end if;
end $$;

create or replace function public.ti_me() returns jsonb
language plpgsql security definer set search_path = '' as $$
declare p public.ti_profiles; email text;
begin
  p := ti_private.require_player();
  select u.email into email from auth.users u where u.id=p.id;
  return jsonb_build_object('id',p.id,'username',p.username,'email',email,
    'role',p.role,'bestScore',p.best_score,'createdAt',p.created_at);
end $$;

create or replace function public.ti_start_run() returns jsonb
language plpgsql security definer set search_path = '' as $$
declare p public.ti_profiles; r public.ti_runs;
begin
  p := ti_private.require_player();
  -- Serialize starts per player to enforce the throttle even for parallel calls.
  perform 1 from public.ti_profiles where id=p.id for update;
  if (select count(*) from public.ti_runs where user_id=p.id and started_at>now()-interval '1 minute') >= 10 then
    raise exception 'Too many starts. Please wait one minute before trying again';
  end if;
  -- Abandoned starts contain no completed scores; keep only one day per player.
  delete from public.ti_runs where user_id=p.id and status='IN_PROGRESS' and started_at<now()-interval '1 day';
  insert into public.ti_runs(user_id) values(p.id) returning * into r;
  return jsonb_build_object('runId',r.id,'startedAt',r.started_at);
end $$;

create or replace function public.ti_finish_run(p_run_id uuid,p_result jsonb) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare p public.ti_profiles; r public.ti_runs; reason text; elapsed numeric; metric text;
  n numeric; max_value integer; points numeric;
begin
  p := ti_private.require_player();
  -- Profile first, run second: same lock order as start, so no lock inversion.
  perform 1 from public.ti_profiles where id=p.id for update;
  select * into r from public.ti_runs where id=p_run_id and user_id=p.id for update;
  if not found then raise exception 'No such run for this account'; end if;
  if r.status <> 'IN_PROGRESS' then raise exception 'That run was already submitted'; end if;
  if p_result is null or jsonb_typeof(p_result)<>'object' then raise exception 'Invalid run result'; end if;
  foreach metric in array array['score','kills','bosses','bestCombo','wpm','accuracy','stageReached','roundsCleared','durationSec'] loop
    if jsonb_typeof(p_result->metric) is distinct from 'number' then raise exception 'Missing or invalid %',metric; end if;
    n := (p_result->>metric)::numeric;
    max_value := case metric when 'score' then 10000000 when 'kills' then 10000 when 'bestCombo' then 10000
      when 'wpm' then 400 when 'accuracy' then 100 when 'durationSec' then 36000
      when 'bosses' then 1 else 4 end;
    if n<>trunc(n) or n<0 or n>max_value then raise exception 'Out of range: %',metric; end if;
  end loop;
  if jsonb_typeof(p_result->'won') is distinct from 'boolean' or p_result->>'difficulty' is null
    or p_result->>'difficulty' not in ('EASY','NORMAL','HARD') then raise exception 'Invalid result or difficulty'; end if;
  if p_result ? 'assisted' and jsonb_typeof(p_result->'assisted') is distinct from 'boolean' then raise exception 'Invalid assist flag'; end if;
  r.score:=(p_result->>'score')::integer; r.kills:=(p_result->>'kills')::integer;
  r.bosses:=(p_result->>'bosses')::integer; r.best_combo:=(p_result->>'bestCombo')::integer;
  r.wpm:=(p_result->>'wpm')::integer; r.accuracy:=(p_result->>'accuracy')::integer;
  r.stage_reached:=(p_result->>'stageReached')::integer; r.rounds_cleared:=(p_result->>'roundsCleared')::integer;
  r.duration_sec:=(p_result->>'durationSec')::integer; r.won:=(p_result->>'won')::boolean;
  r.difficulty:=p_result->>'difficulty'; r.assisted:=coalesce((p_result->>'assisted')::boolean,false);
  r.finished_at:=clock_timestamp();
  elapsed:=extract(epoch from r.finished_at-r.started_at);
  points := (case when r.won then 30 else 0 end)+least(40,r.wpm*0.7)+greatest(0,r.accuracy-60)*0.75;
  -- Recompute rank using the engine's formula instead of trusting the payload.
  r.rank:=case when points>=95 then 'S' when points>=80 then 'A' when points>=62 then 'B' when points>=45 then 'C' else 'D' end;
  reason:=case
    when r.assisted and p.role<>'ADMIN' then 'Only admins can use assist'
    when r.duration_sec>elapsed+15 then 'Claimed duration exceeds server clock'
    when elapsed<3 and r.score>0 then 'Run finished too quickly to be real'
    when r.score>10000+r.kills::bigint*4000+r.bosses*8000+r.rounds_cleared*6000 then 'Score exceeds the plausible ceiling'
    when r.best_combo>r.kills then 'Combo exceeds number of kills'
    when r.stage_reached<1 then 'Invalid stage'
    when r.won and (r.stage_reached<>4 or r.rounds_cleared<>4) then 'Invalid completed stages'
    when not r.won and r.rounds_cleared<>r.stage_reached-1 then 'Invalid cleared stages'
    else null end;
  r.status:=case when reason is null then 'COMPLETED' else 'REJECTED' end;
  update public.ti_runs set score=r.score,kills=r.kills,bosses=r.bosses,best_combo=r.best_combo,
    wpm=r.wpm,accuracy=r.accuracy,stage_reached=r.stage_reached,rounds_cleared=r.rounds_cleared,
    rank=r.rank,duration_sec=r.duration_sec,won=r.won,difficulty=r.difficulty,assisted=r.assisted,
    status=r.status,finished_at=r.finished_at,reject_reason=reason where id=r.id;
  if reason is not null then return jsonb_build_object('error',reason,'status','REJECTED'); end if;
  if not r.assisted then update public.ti_profiles set best_score=greatest(best_score,r.score) where id=p.id; end if;
  return ti_private.run_json(r);
end $$;

create or replace function public.ti_history(p_page integer default 0,p_size integer default 20) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare p public.ti_profiles; result jsonb;
begin
  p:=ti_private.require_player(); perform ti_private.check_page(p_page,p_size);
  select coalesce(jsonb_agg(ti_private.run_json(r) order by r.finished_at desc,r.id),'[]'::jsonb) into result
    from (select * from public.ti_runs where user_id=p.id and status='COMPLETED'
      order by finished_at desc,id limit p_size offset p_page*p_size) r;
  return result;
end $$;
create or replace function public.ti_player_stats() returns jsonb
language plpgsql security definer set search_path = '' as $$
declare p public.ti_profiles; result jsonb;
begin
  p:=ti_private.require_player();
  select jsonb_build_object('runsPlayed',count(*),'bestScore',p.best_score,
    'avgAccuracy',coalesce(round(avg(accuracy)),0),'bestWpm',coalesce(max(wpm),0),
    'avgWpm',coalesce(round(avg(wpm)),0),'totalKills',coalesce(sum(kills),0),
    'bestCombo',coalesce(max(best_combo),0),'totalSeconds',coalesce(sum(duration_sec),0),
    'recentRuns',public.ti_history(0,10)) into result
    from public.ti_runs where user_id=p.id and status='COMPLETED';
  return result;
end $$;

create or replace function public.ti_leaderboard(p_page integer default 0,p_size integer default 20,
  p_min_stage integer default null,p_difficulty text default null,p_search text default '',p_sort text default 'score')
returns jsonb language plpgsql security definer set search_path = '' as $$
declare result jsonb;
begin
  perform ti_private.check_page(p_page,p_size);
  if p_sort is null or p_sort not in ('score','wpm','accuracy','newest') then raise exception 'Invalid sort'; end if;
  if p_difficulty is not null and p_difficulty not in ('EASY','NORMAL','HARD','UNKNOWN') then raise exception 'Invalid difficulty'; end if;
  if length(p_search)>24 or p_min_stage not between 1 and 4 then raise exception 'Invalid filter'; end if;
  with filtered as (
    select r.*,p.username from public.ti_runs r join public.ti_profiles p on p.id=r.user_id
      where r.status='COMPLETED' and not r.assisted and not p.banned
      and (p_min_stage is null or r.stage_reached>=p_min_stage)
      and (p_difficulty is null or r.difficulty=p_difficulty or (p_difficulty='UNKNOWN' and r.difficulty is null))
      and strpos(lower(p.username),lower(coalesce(p_search,'')))>0
  ), ordered as (
    select *,row_number() over(order by
      case when p_sort='score' then score end desc,
      case when p_sort='wpm' then wpm end desc,
      case when p_sort='accuracy' then accuracy end desc,
      case when p_sort='newest' then finished_at end desc,
      score desc,finished_at desc,id) as position from filtered
  ), page_rows as (select * from ordered order by position limit p_size offset p_page*p_size)
  select jsonb_build_object('totalElements',(select count(*) from filtered),
    'totalPages',ceil((select count(*) from filtered)::numeric/p_size),
    'rows',coalesce((select jsonb_agg(jsonb_build_object('position',position,'username',username,
      'score',score,'stageReached',stage_reached,'wpm',wpm,'accuracy',accuracy,'rank',rank,'won',won,
      'difficulty',difficulty,'achievedAt',finished_at) order by position) from page_rows),'[]'::jsonb)) into result;
  return result;
end $$;

create or replace function public.ti_words() returns jsonb
language sql security definer set search_path = '' as $$
  select jsonb_build_object('tiers',coalesce((select jsonb_object_agg(tier,words) from
    (select tier,jsonb_agg(w order by w) as words from public.ti_word_packs,unnest(words) w
      where active and tier<5 group by tier) t),'{}'::jsonb),
    'boss',coalesce((select jsonb_agg(w order by w) from public.ti_word_packs,unnest(words) w where active and tier=5),'[]'::jsonb));
$$;
create or replace function public.ti_admin_stats() returns jsonb
language plpgsql security definer set search_path = '' as $$
begin
  perform ti_private.require_player(true);
  return jsonb_build_object('totalUsers',(select count(*) from public.ti_profiles),
    'totalRuns',(select count(*) from public.ti_runs where status='COMPLETED'),
    'rejectedRuns',(select count(*) from public.ti_runs where status='REJECTED'),
    'wordPacks',(select count(*) from public.ti_word_packs),
    'totalWords',(select coalesce(sum(cardinality(words)),0) from public.ti_word_packs));
end $$;
create or replace function public.ti_admin_packs() returns jsonb
language plpgsql security definer set search_path = '' as $$
begin
  perform ti_private.require_player(true);
  return (select coalesce(jsonb_agg(to_jsonb(p) order by tier,name),'[]'::jsonb) from public.ti_word_packs p);
end $$;
create or replace function public.ti_save_pack(p_id uuid,p_pack jsonb) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare n text; t integer; a boolean; ws text[]; result public.ti_word_packs;
begin
  perform ti_private.require_player(true);
  if jsonb_typeof(p_pack->'words') is distinct from 'array' or jsonb_typeof(p_pack->'active') is distinct from 'boolean' then raise exception 'Invalid pack'; end if;
  n:=trim(p_pack->>'name'); t:=(p_pack->>'tier')::integer; a:=(p_pack->>'active')::boolean;
  if n is null or length(n) not between 1 and 80 or t is null or t not between 1 and 5 then raise exception 'Invalid pack name or tier'; end if;
  select array_agg(distinct lower(trim(v))) into ws from jsonb_array_elements_text(p_pack->'words') v;
  if ws is null or cardinality(ws) not between 1 and 500 or exists(select 1 from unnest(ws) w where w is null or w !~ '^[a-z]{1,40}$') then
    raise exception 'Use 1-500 words, each with 1-40 letters a-z';
  end if;
  if p_id is null then
    insert into public.ti_word_packs(name,tier,active,words) values(n,t,a,ws) returning * into result;
  else
    update public.ti_word_packs set name=n,tier=t,active=a,words=ws where id=p_id returning * into result;
    if not found then raise exception 'No such pack'; end if;
  end if;
  return to_jsonb(result);
end $$;
create or replace function public.ti_delete_pack(p_id uuid) returns jsonb
language plpgsql security definer set search_path = '' as $$
begin
  perform ti_private.require_player(true);
  delete from public.ti_word_packs where id=p_id;
  if not found then raise exception 'No such pack'; end if;
  return jsonb_build_object('deleted',true);
end $$;
create or replace function public.ti_admin_users() returns jsonb
language plpgsql security definer set search_path = '' as $$
begin
  perform ti_private.require_player(true);
  return (select coalesce(jsonb_agg(jsonb_build_object('id',p.id,'username',p.username,'email',u.email,
    'role',p.role,'bestScore',p.best_score,'banned',p.banned,'createdAt',p.created_at) order by p.created_at desc),'[]'::jsonb)
    from public.ti_profiles p join auth.users u on u.id=p.id);
end $$;
create or replace function public.ti_suspend_user(p_user_id uuid,p_banned boolean) returns jsonb
language plpgsql security definer set search_path = '' as $$
begin
  perform ti_private.require_player(true);
  if p_banned is null then raise exception 'Missing status'; end if;
  update public.ti_profiles set banned=p_banned where id=p_user_id and role<>'ADMIN';
  if not found then raise exception 'No such player, or account is an admin'; end if;
  return jsonb_build_object('updated',true);
end $$;

-- Grant ONLY these application functions. Helper functions stay private.
revoke all on all functions in schema ti_private from public,anon,authenticated;
do $$ declare f record;
begin
  for f in select oid::regprocedure as signature from pg_proc where pronamespace='public'::regnamespace and proname like 'ti\_%' escape '\' loop
    execute format('revoke all on function %s from public, anon, authenticated',f.signature);
    execute format('grant execute on function %s to authenticated',f.signature);
  end loop;
end $$;
grant execute on function public.ti_words() to anon;
grant execute on function public.ti_leaderboard(integer,integer,integer,text,text,text) to anon;
-- Word seeds appended below. No default admin or shared password is created.
insert into public.ti_word_packs(name,tier,words) values('Core Short',1,array['ion','arc','rig','hex','jet','orb','pod','ray','fin','cog','dust','null','void','beam','claw','core','dock','warp','flux','rust','bolt','gale','halo','iron','kiln','lace','mesh','volt','scan','grid','hull','side','vary','neon','soot','ash','rim','gate','lamp','duct','wire','vent','coil','moss','bark','owl','fog','pine','oak','den','moth','clay']) on conflict(name) do nothing;
insert into public.ti_word_packs(name,tier,words) values('Core Medium',2,array['plasma','vector','thrust','cipher','photon','oxygen','airlock','reactor','breach','signal','shield','decode','engine','helmet','cosmic','lander','mantle','nebula','quartz','rescue','silica','tundra','vacuum','xenon','zenith','basalt','cavern','dredge','girder','hollow','lantern','thicket','bramble','rafter','cellar','attic']) on conflict(name) do nothing;
insert into public.ti_word_packs(name,tier,words) values('Core Long',3,array['gravity','antenna','asteroid','magnetic','starship','quantum','radiator','satellite','telemetry','astronaut','corridor','detector','filament','hydrogen','isotope','junction','keystone','luminous','membrane','nitrogen','orbital','particle','radiation','spectrum','turbine','scaffold','chandelier','staircase','undergrowth']) on conflict(name) do nothing;
insert into public.ti_word_packs(name,tier,words) values('Core Extreme',4,array['acceleration','bioluminescent','centrifugal','decompression','electromagnet','fortification','gravitational','hyperspatial','interstellar','kaleidoscopic','magnetosphere','navigational','photosynthesis','reconnaissance']) on conflict(name) do nothing;
insert into public.ti_word_packs(name,tier,words) values('Boss Bank',5,array['electroencephalography','counterrevolutionaries','deinstitutionalization','institutionalization','internationalization','compartmentalization','indistinguishability','incomprehensibilities','uncharacteristically','electrocardiographic','otorhinolaryngologist','neuropsychopharmacology','spectrophotometrically','crystallographically','magnetohydrodynamics','immunoelectrophoresis','hydrochlorofluorocarbon','psychopharmacological','antidisestablishmentarianism','overintellectualizing','disproportionateness','photojournalistically','incomprehensibleness','electrophysiological','counterproductiveness','paleoanthropological']) on conflict(name) do nothing;
notify pgrst, 'reload schema';
commit;
