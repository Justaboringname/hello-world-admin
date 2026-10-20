-- Week 6: the admin panel. Paste into the Supabase SQL Editor and run after
-- the main app's supabase/new_for_you.sql. Safe to run more than once.
--
--   profiles.is_superadmin  who may use the admin panel. Only the SQL Editor
--                           (or the service role) can change it
--   is_superadmin()         true when the signed-in user is a superadmin
--   admin policies          superadmins can read every profile and vote, and
--                           create, edit and delete AI photos, captions and
--                           memes. Nothing here loosens what anyone else can do
--   admin_users()           every user with sign-in info and activity counts
--   admin_generations       every AI photo with its captions' vote totals
--   admin_votes             every vote on a caption or a meme
--   total_votes(), minority_votes()
--                           sort keys for ranking captions and memes
--   admin_dashboard()       the dashboard's statistics in one JSON document
--
-- Step 8 at the bottom makes you the first superadmin. Edit the email there
-- before running, or run just that statement afterwards.

-- 1. The flag ----------------------------------------------------------------
alter table public.profiles
  add column if not exists is_superadmin boolean not null default false;

-- Users may update their own profiles row (name, photo), so without this
-- anyone could make themselves an admin from the browser console. Requests
-- from the app run as anon or authenticated; the SQL Editor runs as postgres
-- and the vote and sign-up triggers run as the table owner, so they're not
-- affected.
create or replace function public.protect_superadmin_flag()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if current_user in ('anon', 'authenticated')
     and new.is_superadmin is distinct from
         (case when tg_op = 'UPDATE' then old.is_superadmin else false end) then
    raise exception 'is_superadmin can only be changed from the Supabase SQL Editor'
      using errcode = '42501';
  end if;
  return new;
end;
$$;

drop trigger if exists protect_superadmin_flag on public.profiles;
create trigger protect_superadmin_flag
  before insert or update on public.profiles
  for each row execute function public.protect_superadmin_flag();

-- Only ever runs as a trigger; nobody needs to call it.
revoke execute on function public.protect_superadmin_flag() from public, anon, authenticated;

-- 2. is_superadmin() -----------------------------------------------------------
-- security definer so it can read the caller's row without going through the
-- profiles policies (one of which calls it). Policies call it as
-- (select public.is_superadmin()) so Postgres runs it once per query, not
-- once per row.
create or replace function public.is_superadmin()
returns boolean
language sql
stable
security definer set search_path = ''
as $$
  select coalesce(
    (select p.is_superadmin from public.profiles p where p.id = (select auth.uid())),
    false
  );
$$;

revoke execute on function public.is_superadmin() from public, anon;
grant execute on function public.is_superadmin() to authenticated;

-- 3. Read every profile and every vote -----------------------------------------
-- Policies are permissive, so these add to the "own row only" ones from
-- earlier weeks: a regular user still only sees their own.
drop policy if exists "Superadmins can view every profile" on public.profiles;
create policy "Superadmins can view every profile"
  on public.profiles for select
  to authenticated
  using ((select public.is_superadmin()));

drop policy if exists "Superadmins can view every caption vote" on public.caption_votes;
create policy "Superadmins can view every caption vote"
  on public.caption_votes for select
  to authenticated
  using ((select public.is_superadmin()));

drop policy if exists "Superadmins can view every meme vote" on public.meme_votes;
create policy "Superadmins can view every meme vote"
  on public.meme_votes for select
  to authenticated
  using ((select public.is_superadmin()));

-- 4. AI photos and captions: create, edit, delete --------------------------------
-- Admins create photos the same way users do (as themselves, with a photo in
-- their own Storage folder), which captions.sql already allows. On top of
-- that they can change any photo's location and vibe, add, reword and remove
-- captions on any photo, and delete photos (their captions and votes go with
-- them). Column privileges keep vote totals, authors, prompts and dates out of
-- reach: those still only change through the triggers.
revoke update on public.generations from anon, authenticated;
grant update (location, vibe) on public.generations to authenticated;

drop policy if exists "Superadmins can edit generations" on public.generations;
create policy "Superadmins can edit generations"
  on public.generations for update
  to authenticated
  using ((select public.is_superadmin()))
  with check ((select public.is_superadmin()));

drop policy if exists "Superadmins can delete generations" on public.generations;
create policy "Superadmins can delete generations"
  on public.generations for delete
  to authenticated
  using ((select public.is_superadmin()));

revoke update on public.captions from anon, authenticated;
grant update (text) on public.captions to authenticated;

drop policy if exists "Superadmins can add captions" on public.captions;
create policy "Superadmins can add captions"
  on public.captions for insert
  to authenticated
  with check (
    (select public.is_superadmin())
    and upvotes = 0
    and downvotes = 0
  );

drop policy if exists "Superadmins can edit captions" on public.captions;
create policy "Superadmins can edit captions"
  on public.captions for update
  to authenticated
  using ((select public.is_superadmin()))
  with check ((select public.is_superadmin()));

drop policy if exists "Superadmins can delete captions" on public.captions;
create policy "Superadmins can delete captions"
  on public.captions for delete
  to authenticated
  using ((select public.is_superadmin()));

-- 5. Memes: moderate (edit the text, members-only, delete) ----------------------
revoke update on public.memes from anon, authenticated;
grant update (title, top_text, bottom_text, members_only) on public.memes to authenticated;

drop policy if exists "Superadmins can edit memes" on public.memes;
create policy "Superadmins can edit memes"
  on public.memes for update
  to authenticated
  using ((select public.is_superadmin()))
  with check ((select public.is_superadmin()));

drop policy if exists "Superadmins can delete memes" on public.memes;
create policy "Superadmins can delete memes"
  on public.memes for delete
  to authenticated
  using ((select public.is_superadmin()));

-- 6. Photos bucket: deleting a post also deletes its image ------------------------
-- Storage's remove() has to see an object (select) before it can delete it.
drop policy if exists "Superadmins can view photo objects" on storage.objects;
create policy "Superadmins can view photo objects"
  on storage.objects for select
  to authenticated
  using (bucket_id = 'photos' and (select public.is_superadmin()));

drop policy if exists "Superadmins can delete photo objects" on storage.objects;
create policy "Superadmins can delete photo objects"
  on storage.objects for delete
  to authenticated
  using (bucket_id = 'photos' and (select public.is_superadmin()));

-- 7. Read helpers for the admin app ---------------------------------------------

-- Every user, with what Google told us (auth.users) and what they've done.
-- auth.users is off limits to the API, so this is security definer and
-- checks the caller first. The email comes from auth.users, not profiles:
-- users can edit their own profiles.email, but not the one Google verified.
create or replace function public.admin_users()
returns table (
  id uuid,
  email text,
  first_name text,
  last_name text,
  avatar_url text,
  is_superadmin boolean,
  provider text,
  created_at timestamptz,
  last_sign_in_at timestamptz,
  photos bigint,
  memes bigint,
  votes_cast bigint,
  upvotes_received bigint
)
language plpgsql
stable
security definer set search_path = ''
as $$
#variable_conflict use_column
begin
  if not public.is_superadmin() then
    raise exception 'Superadmins only' using errcode = '42501';
  end if;

  return query
    select u.id,
           u.email::text,
           p.first_name,
           p.last_name,
           p.avatar_url,
           coalesce(p.is_superadmin, false),
           u.raw_app_meta_data ->> 'provider',
           u.created_at,
           u.last_sign_in_at,
           (select count(*) from public.generations g where g.user_id = u.id),
           (select count(*) from public.memes m where m.user_id = u.id),
           (select count(*) from public.caption_votes v where v.user_id = u.id)
             + (select count(*) from public.meme_votes v where v.user_id = u.id),
           coalesce((select sum(c.upvotes)
                       from public.captions c
                       join public.generations g on g.id = c.generation_id
                      where g.user_id = u.id), 0)::bigint
             + coalesce((select sum(m.upvotes) from public.memes m where m.user_id = u.id), 0)::bigint
      from auth.users u
      left join public.profiles p on p.id = u.id;
end;
$$;

revoke execute on function public.admin_users() from public, anon;
grant execute on function public.admin_users() to authenticated;

-- One row per photo with its captions rolled up, so the media list can sort
-- by votes and search caption text. Photos and captions are public anyway;
-- security_invoker keeps it that way rather than widening anything.
create or replace view public.admin_generations
with (security_invoker = true) as
  select g.id,
         g.user_id,
         g.author_name,
         g.image_path,
         g.location,
         g.vibe,
         g.model,
         g.created_at,
         count(c.id) as caption_count,
         coalesce(sum(c.upvotes), 0)::bigint as upvotes,
         coalesce(sum(c.downvotes), 0)::bigint as downvotes,
         coalesce(sum(c.score), 0)::bigint as score,
         (array_agg(c.text order by c.score desc, c.position) filter (where c.id is not null))[1] as top_caption,
         coalesce(string_agg(c.text, ' / ' order by c.position), '') as caption_text
    from public.generations g
    left join public.captions c on c.generation_id = g.id
   group by g.id;

revoke all on public.admin_generations from anon, authenticated;
grant select on public.admin_generations to authenticated;

-- Sort keys for the Ratings tab on /votes. PostgREST can only order by
-- columns, but it treats a function that takes a row as one more column
-- ("computed field"), so these make "most voted" and "most divisive"
-- possible. They only add up numbers that are already public.
create or replace function public.total_votes(public.captions)
returns integer
language sql
immutable
set search_path = ''
as $$ select $1.upvotes + $1.downvotes $$;

create or replace function public.minority_votes(public.captions)
returns integer
language sql
immutable
set search_path = ''
as $$ select least($1.upvotes, $1.downvotes) $$;

create or replace function public.total_votes(public.memes)
returns integer
language sql
immutable
set search_path = ''
as $$ select $1.upvotes + $1.downvotes $$;

create or replace function public.minority_votes(public.memes)
returns integer
language sql
immutable
set search_path = ''
as $$ select least($1.upvotes, $1.downvotes) $$;

revoke execute on function public.total_votes(public.captions), public.minority_votes(public.captions),
  public.total_votes(public.memes), public.minority_votes(public.memes) from public, anon;
grant execute on function public.total_votes(public.captions), public.minority_votes(public.captions),
  public.total_votes(public.memes), public.minority_votes(public.memes) to authenticated;

-- One row per vote, captions and memes together. security_invoker, so it
-- reads as the caller: superadmins see every vote, anyone else only their own.
create or replace view public.admin_votes
with (security_invoker = true) as
  select 'caption'::text as kind,
         v.caption_id as item_id,
         c.generation_id as post_id,
         c.text as label,
         v.user_id,
         nullif(concat_ws(' ', p.first_name, p.last_name), '') as voter_name,
         p.avatar_url as voter_avatar_url,
         v.vote,
         v.created_at,
         v.updated_at
    from public.caption_votes v
    join public.captions c on c.id = v.caption_id
    left join public.profiles p on p.id = v.user_id
  union all
  select 'meme'::text,
         v.meme_id,
         v.meme_id,
         m.title,
         v.user_id,
         nullif(concat_ws(' ', p.first_name, p.last_name), ''),
         p.avatar_url,
         v.vote,
         v.created_at,
         v.updated_at
    from public.meme_votes v
    join public.memes m on m.id = v.meme_id
    left join public.profiles p on p.id = v.user_id;

revoke all on public.admin_votes from anon, authenticated;
grant select on public.admin_votes to authenticated;

-- Everything the dashboard shows, in one round trip. security invoker, so it
-- only counts what the caller's policies let them read; the check up front
-- turns a non-admin's call into an error instead of a page of wrong numbers.
-- Days and hours are New York time, where our users are.
create or replace function public.admin_dashboard()
returns jsonb
language plpgsql
stable
security invoker
set search_path = ''
as $$
declare
  tz constant text := 'America/New_York';
  today date := (now() at time zone 'America/New_York')::date;
  result jsonb;
begin
  if not public.is_superadmin() then
    raise exception 'Superadmins only' using errcode = '42501';
  end if;

  with
  votes as (
    select 'caption'::text as kind, v.user_id, v.vote, v.created_at from public.caption_votes v
    union all
    select 'meme'::text, v.user_id, v.vote, v.created_at from public.meme_votes v
  ),
  -- Posts people made: photos and their own memes (not the seeded classics).
  posts as (
    select 'photo'::text as kind, g.user_id, g.created_at from public.generations g
    union all
    select 'meme'::text, m.user_id, m.created_at from public.memes m where m.user_id is not null
  ),
  activity as (
    select user_id, created_at from votes
    union all
    select user_id, created_at from posts
  ),
  photo_totals as (
    select g.id,
           g.user_id,
           g.created_at,
           coalesce(sum(c.upvotes), 0)::bigint as upvotes,
           coalesce(sum(c.downvotes), 0)::bigint as downvotes
      from public.generations g
      left join public.captions c on c.generation_id = g.id
     group by g.id
  ),
  -- The caption that leads each photo outright: top score, above zero, no tie.
  winners as (
    select r.generation_id, r.id as caption_id
      from (
        select c.generation_id, c.id, c.score,
               rank() over (partition by c.generation_id order by c.score desc) as place,
               count(*) over (partition by c.generation_id, c.score) as tied
          from public.captions c
      ) r
     where r.place = 1 and r.score > 0 and r.tied = 1
  ),
  voter_stats as (
    select v.user_id,
           count(*) as votes,
           count(*) filter (where v.vote = 1) as upvotes,
           count(*) filter (where extract(hour from v.created_at at time zone tz) < 5) as late_night,
           count(distinct (v.created_at at time zone tz)::date) as days
      from votes v
     group by v.user_id
  ),
  people as (
    select p.id as user_id,
           nullif(concat_ws(' ', p.first_name, p.last_name), '') as name,
           p.avatar_url
      from public.profiles p
  )
  select jsonb_build_object(
    'generated_at', now(),
    'timezone', tz,

    'totals', jsonb_build_object(
      'users', (select count(*) from public.profiles),
      'admins', (select count(*) from public.profiles p where p.is_superadmin),
      'photos', (select count(*) from public.generations),
      'captions', (select count(*) from public.captions),
      'memes', (select count(*) from public.memes),
      'user_memes', (select count(*) from public.memes m where m.user_id is not null),
      'votes', (select count(*) from votes),
      'upvotes', (select count(*) from votes v where v.vote = 1),
      'downvotes', (select count(*) from votes v where v.vote = -1),
      'voters', (select count(distinct v.user_id) from votes v),
      'posters', (select count(distinct p.user_id) from posts p),
      'unvoted_posts',
        (select count(*) from photo_totals t where t.upvotes + t.downvotes = 0)
        + (select count(*) from public.memes m
            where m.user_id is not null and m.upvotes + m.downvotes = 0)
    ),

    -- This week against the week before, for the trend on each tile.
    'last_7_days', jsonb_build_object(
      'users', (select count(*) from public.profiles p where p.created_at >= now() - interval '7 days'),
      'posts', (select count(*) from posts p where p.created_at >= now() - interval '7 days'),
      'votes', (select count(*) from votes v where v.created_at >= now() - interval '7 days'),
      'active_users', (select count(distinct a.user_id) from activity a where a.created_at >= now() - interval '7 days')
    ),
    'previous_7_days', jsonb_build_object(
      'users', (select count(*) from public.profiles p
                 where p.created_at >= now() - interval '14 days' and p.created_at < now() - interval '7 days'),
      'posts', (select count(*) from posts p
                 where p.created_at >= now() - interval '14 days' and p.created_at < now() - interval '7 days'),
      'votes', (select count(*) from votes v
                 where v.created_at >= now() - interval '14 days' and v.created_at < now() - interval '7 days'),
      'active_users', (select count(distinct a.user_id) from activity a
                        where a.created_at >= now() - interval '14 days' and a.created_at < now() - interval '7 days')
    ),

    -- The last 30 days, oldest first, one entry per day even when it's zero.
    'daily', (
      select jsonb_agg(jsonb_build_object(
               'day', d.day,
               'signups', coalesce(s.n, 0),
               'photos', coalesce(ph.n, 0),
               'memes', coalesce(me.n, 0),
               'votes', coalesce(vo.n, 0)
             ) order by d.day)
        from (select today - n as day from generate_series(0, 29) as n) d
        left join (select (p.created_at at time zone tz)::date as day, count(*) as n
                     from public.profiles p group by 1) s on s.day = d.day
        left join (select (g.created_at at time zone tz)::date as day, count(*) as n
                     from public.generations g group by 1) ph on ph.day = d.day
        left join (select (m.created_at at time zone tz)::date as day, count(*) as n
                     from public.memes m where m.user_id is not null group by 1) me on me.day = d.day
        left join (select (v.created_at at time zone tz)::date as day, count(*) as n
                     from votes v group by 1) vo on vo.day = d.day
    ),

    -- When people vote: day of week (0 = Sunday) by hour. Only non-empty cells.
    'heatmap', (
      select coalesce(jsonb_agg(jsonb_build_object('dow', h.dow, 'hour', h.hour, 'votes', h.n)
                                order by h.dow, h.hour), '[]'::jsonb)
        from (
          select extract(dow from v.created_at at time zone tz)::int as dow,
                 extract(hour from v.created_at at time zone tz)::int as hour,
                 count(*) as n
            from votes v
           group by 1, 2
        ) h
    ),

    -- From signing up to coming back. Each step counts people, not actions.
    'funnel', jsonb_build_object(
      'signed_up', (select count(*) from public.profiles),
      'named', (select count(*) from public.profiles p
                 where nullif(trim(p.first_name), '') is not null
                   and nullif(trim(p.last_name), '') is not null),
      'voted', (select count(*) from voter_stats),
      'posted', (select count(distinct p.user_id) from posts p),
      'regulars', (select count(*) from voter_stats s where s.days >= 3)
    ),

    -- Which of the four voices gets the laughs.
    'vibes', (
      select coalesce(jsonb_agg(to_jsonb(x) order by x.photos desc, x.vibe), '[]'::jsonb)
        from (
          select g.vibe,
                 count(distinct g.id) as photos,
                 count(c.id) as captions,
                 coalesce(sum(c.upvotes), 0) as upvotes,
                 coalesce(sum(c.downvotes), 0) as downvotes,
                 round(avg(c.score), 2) as avg_score
            from public.generations g
            left join public.captions c on c.generation_id = g.id
           group by g.vibe
        ) x
    ),

    -- Does the first caption Gemini writes win more often than the third?
    'positions', (
      select coalesce(jsonb_agg(to_jsonb(x) order by x.position), '[]'::jsonb)
        from (
          select c.position,
                 count(*) as captions,
                 sum(c.upvotes) as upvotes,
                 sum(c.downvotes) as downvotes,
                 round(avg(c.score), 2) as avg_score,
                 count(w.caption_id) as wins
            from public.captions c
            left join winners w on w.caption_id = c.id
           group by c.position
        ) x
    ),
    'decided_photos', (select count(*) from winners),

    -- Which Gemini model answered, and how its captions did.
    'models', (
      select coalesce(jsonb_agg(to_jsonb(x) order by x.photos desc, x.model), '[]'::jsonb)
        from (
          select g.model,
                 count(distinct g.id) as photos,
                 coalesce(sum(c.upvotes), 0) as upvotes,
                 coalesce(sum(c.downvotes), 0) as downvotes,
                 round(avg(c.score), 2) as avg_score
            from public.generations g
            left join public.captions c on c.generation_id = g.id
           group by g.model
        ) x
    ),

    -- AI captions against memes people made (not the seeded classics).
    'kinds', jsonb_build_object(
      'photo', (select jsonb_build_object(
                         'posts', count(*),
                         'voted_posts', count(*) filter (where t.upvotes + t.downvotes > 0),
                         'upvotes', coalesce(sum(t.upvotes), 0),
                         'downvotes', coalesce(sum(t.downvotes), 0))
                  from photo_totals t),
      'meme', (select jsonb_build_object(
                        'posts', count(*),
                        'voted_posts', count(*) filter (where m.upvotes + m.downvotes > 0),
                        'upvotes', coalesce(sum(m.upvotes), 0),
                        'downvotes', coalesce(sum(m.downvotes), 0))
                 from public.memes m
                where m.user_id is not null)
    ),

    'top_captions', (
      select coalesce(jsonb_agg(to_jsonb(x) order by x.score desc, x.upvotes desc, x.id), '[]'::jsonb)
        from (
          select c.id, c.text, c.position, c.upvotes, c.downvotes, c.score,
                 g.id as generation_id, g.image_path, g.vibe, g.author_name
            from public.captions c
            join public.generations g on g.id = c.generation_id
           where c.upvotes + c.downvotes > 0
           order by c.score desc, c.upvotes desc, c.id
           limit 5
        ) x
    ),

    -- Captions people can't agree on: the most votes on both sides.
    'divisive_captions', (
      select coalesce(jsonb_agg(to_jsonb(x) order by least(x.upvotes, x.downvotes) desc,
                                                   x.upvotes + x.downvotes desc, x.id), '[]'::jsonb)
        from (
          select c.id, c.text, c.position, c.upvotes, c.downvotes, c.score,
                 g.id as generation_id, g.image_path, g.vibe, g.author_name
            from public.captions c
            join public.generations g on g.id = c.generation_id
           where c.upvotes > 0 and c.downvotes > 0
           order by least(c.upvotes, c.downvotes) desc, c.upvotes + c.downvotes desc, c.id
           limit 5
        ) x
    ),

    'top_memes', (
      select coalesce(jsonb_agg(to_jsonb(x) order by x.score desc, x.upvotes desc, x.id), '[]'::jsonb)
        from (
          select m.id, m.title, m.image_url, m.image_path, m.author_name, m.members_only,
                 m.upvotes, m.downvotes, m.score
            from public.memes m
           where m.upvotes + m.downvotes > 0
           order by m.score desc, m.upvotes desc, m.id
           limit 5
        ) x
    ),

    -- People whose posts got the most 👍.
    'top_creators', (
      select coalesce(jsonb_agg(to_jsonb(x) order by x.upvotes desc, x.posts desc, x.user_id), '[]'::jsonb)
        from (
          select pe.user_id, pe.name, pe.avatar_url,
                 count(*) as posts,
                 sum(r.upvotes) as upvotes
            from (
              select t.user_id, t.upvotes from photo_totals t
              union all
              select m.user_id, m.upvotes::bigint from public.memes m where m.user_id is not null
            ) r
            join people pe on pe.user_id = r.user_id
           group by pe.user_id, pe.name, pe.avatar_url
           order by sum(r.upvotes) desc, count(*) desc, pe.user_id
           limit 5
        ) x
    ),

    'top_voters', (
      select coalesce(jsonb_agg(to_jsonb(x) order by x.votes desc, x.user_id), '[]'::jsonb)
        from (
          select pe.user_id, pe.name, pe.avatar_url, s.votes, s.upvotes, s.days
            from voter_stats s
            join people pe on pe.user_id = s.user_id
           order by s.votes desc, pe.user_id
           limit 5
        ) x
    ),

    -- Superlatives. Critic and fan need at least 5 votes to qualify.
    'awards', jsonb_build_object(
      'harshest_critic', (
        select to_jsonb(x) from (
          select pe.user_id, pe.name, pe.avatar_url, s.votes, s.upvotes
            from voter_stats s join people pe on pe.user_id = s.user_id
           where s.votes >= 5
           order by s.upvotes::numeric / s.votes, s.votes desc, pe.user_id
           limit 1
        ) x
      ),
      'biggest_fan', (
        select to_jsonb(x) from (
          select pe.user_id, pe.name, pe.avatar_url, s.votes, s.upvotes
            from voter_stats s join people pe on pe.user_id = s.user_id
           where s.votes >= 5
           order by s.upvotes::numeric / s.votes desc, s.votes desc, pe.user_id
           limit 1
        ) x
      ),
      'night_owl', (
        select to_jsonb(x) from (
          select pe.user_id, pe.name, pe.avatar_url, s.votes, s.late_night
            from voter_stats s join people pe on pe.user_id = s.user_id
           where s.late_night > 0
           order by s.late_night desc, s.votes desc, pe.user_id
           limit 1
        ) x
      )
    ),

    -- Where in the city people post from, as they typed it.
    'locations', (
      select coalesce(jsonb_agg(to_jsonb(x) order by x.photos desc, x.location), '[]'::jsonb)
        from (
          select initcap(lower(trim(g.location))) as location, count(*) as photos
            from public.generations g
           where nullif(trim(g.location), '') is not null
           group by 1
           order by 2 desc, 1
           limit 8
        ) x
    ),

    -- How long a new post waits for its first vote (median, in minutes).
    'first_vote_minutes', (
      select round((percentile_cont(0.5) within group (order by extract(epoch from f.first_vote - f.created_at) / 60))::numeric, 1)
        from (
          select t.created_at,
                 (select min(v.created_at)
                    from public.caption_votes v
                    join public.captions c on c.id = v.caption_id
                   where c.generation_id = t.id) as first_vote
            from photo_totals t
          union all
          select m.created_at,
                 (select min(v.created_at) from public.meme_votes v where v.meme_id = m.id)
            from public.memes m
           where m.user_id is not null
        ) f
       where f.first_vote is not null
    )
  ) into result;

  return result;
end;
$$;

revoke execute on function public.admin_dashboard() from public, anon;
grant execute on function public.admin_dashboard() to authenticated;

-- 8. Make yourself the first superadmin -----------------------------------------
-- The admin panel only lets superadmins in, and the app can't grant the flag,
-- so the first one has to come from here: the SQL Editor runs as postgres,
-- which the trigger above lets through. Sign in to the main app with Google
-- once (that creates your profiles row), put your Google email below, and
-- run this statement. It matches on auth.users, not profiles.email (which
-- users can edit), and only on a confirmed account that signed in with
-- Google: Supabase's email sign-up is on by default, so someone could
-- register your address with a password and never confirm it. Re-run with
-- another email to add more admins, or set the flag to false to remove one.
update public.profiles
   set is_superadmin = true
 where id in (select u.id
                from auth.users u
               where lower(u.email) = lower('YOUR_GOOGLE_EMAIL@gmail.com')
                 and u.email_confirmed_at is not null
                 and u.raw_app_meta_data -> 'providers' ? 'google');

-- 9. Check -----------------------------------------------------------------------
-- Who can get in (expect your email), and the policies this file added.
select u.email as superadmin
  from public.profiles p
  join auth.users u on u.id = p.id
 where p.is_superadmin;

select tablename, policyname, cmd
  from pg_policies
 where policyname like 'Superadmins%'
 order by tablename, policyname;
