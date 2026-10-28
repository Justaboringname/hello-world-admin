-- Week 7: more observability. Paste into the Supabase SQL Editor and run after
-- admin.sql. Safe to run more than once. It only adds tables; nothing that
-- already exists changes.
--
--   llm_providers, llm_models   who we call and which models (CRUD)
--   prompt_chains               one chain per vibe, as the main app runs it (read)
--   prompt_chain_steps          the requests a chain makes, in order (read)
--   prompt_chain_mix            how often each chain should be picked (read, update)
--   terms                       Columbia and NYC lore the captions can lean on (CRUD)
--   ai_generation_examples      example captions to ground a chain's style (CRUD)
--   allowed_signup_domains      email domains that may sign up (CRUD)
--   whitelisted_email_addresses single addresses let in from any domain (CRUD)
--
-- Generation requests and LLM responses need no new tables: every photo in
-- generations is one request (its prompt, model and time), and its captions
-- are what the model returned.
--
-- Everything here is for superadmins only: RLS is on for every table, every
-- policy checks is_superadmin() from admin.sql, and anon gets nothing.
-- The chains are seeded from the main app's lib/gemini.ts. The main app still
-- uses the prompts in that file; it doesn't read these tables yet, and
-- sign-up doesn't check the domain or whitelist tables yet either.

-- 1. LLM providers and models ----------------------------------------------------
create table if not exists public.llm_providers (
  id bigint generated always as identity primary key,
  name text not null unique check (char_length(name) between 1 and 60),
  website text check (website is null or (website ~ '^https://' and char_length(website) <= 200)),
  created_at timestamptz not null default now()
);

create table if not exists public.llm_models (
  id bigint generated always as identity primary key,
  -- restrict: a provider can't be deleted while it still has models.
  provider_id bigint not null references public.llm_providers (id) on delete restrict,
  name text not null check (char_length(name) between 1 and 80),
  -- What the API is called with, e.g. gemini-3.5-flash-lite.
  api_model_id text not null unique check (char_length(api_model_id) between 1 and 100),
  -- Temperature only works on non-reasoning models (Week 7 lecture).
  supports_temperature boolean not null default false,
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

create index if not exists llm_models_provider_id_idx on public.llm_models (provider_id);

-- 2. Prompt chains, their steps and the mix -----------------------------------------
create table if not exists public.prompt_chains (
  id bigint generated always as identity primary key,
  slug text not null unique check (slug ~ '^[a-z0-9-]{1,40}$'), -- the vibe in the main app
  name text not null check (char_length(name) between 1 and 80),
  description text check (char_length(description) <= 300),
  created_at timestamptz not null default now()
);

create table if not exists public.prompt_chain_steps (
  id bigint generated always as identity primary key,
  chain_id bigint not null references public.prompt_chains (id) on delete cascade,
  step_order smallint not null check (step_order between 1 and 10),
  name text not null check (char_length(name) between 1 and 80),
  model_id bigint references public.llm_models (id) on delete set null,
  temperature numeric(3, 2) check (temperature between 0 and 2), -- null: the model's default
  system_prompt text not null,
  user_prompt text not null, -- {placeholders} are filled in per request
  output_format text,
  unique (chain_id, step_order)
);

create index if not exists prompt_chain_steps_model_id_idx on public.prompt_chain_steps (model_id);

create table if not exists public.prompt_chain_mix (
  chain_id bigint primary key references public.prompt_chains (id) on delete cascade,
  weight smallint not null default 0 check (weight between 0 and 100),
  updated_at timestamptz not null default now()
);

-- 3. Terms and generation examples ---------------------------------------------------
create table if not exists public.terms (
  id bigint generated always as identity primary key,
  term text not null check (char_length(term) between 1 and 60),
  definition text not null check (char_length(definition) between 1 and 500),
  example text check (char_length(example) <= 300),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists terms_term_key on public.terms (lower(term));

create table if not exists public.ai_generation_examples (
  id bigint generated always as identity primary key,
  chain_id bigint references public.prompt_chains (id) on delete set null,
  image_description text not null check (char_length(image_description) between 1 and 300),
  caption text not null check (char_length(caption) between 1 and 200),
  notes text check (char_length(notes) <= 300),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists ai_generation_examples_chain_id_idx on public.ai_generation_examples (chain_id);

-- 4. Who may sign up -------------------------------------------------------------------
-- Stored lowercase, so "Columbia.edu" and "columbia.edu" can't both exist.
create table if not exists public.allowed_signup_domains (
  id bigint generated always as identity primary key,
  domain text not null unique check (
    domain = lower(domain)
    and char_length(domain) <= 253
    and domain ~ '^[a-z0-9]([a-z0-9-]*[a-z0-9])?(\.[a-z0-9]([a-z0-9-]*[a-z0-9])?)+$'
  ),
  note text check (char_length(note) <= 200),
  created_at timestamptz not null default now()
);

create table if not exists public.whitelisted_email_addresses (
  id bigint generated always as identity primary key,
  email text not null unique check (
    email = lower(email)
    and char_length(email) <= 254
    and email ~ '^[^@[:space:]]+@[^@[:space:]]+\.[^@[:space:]]+$'
  ),
  note text check (char_length(note) <= 200),
  created_at timestamptz not null default now()
);

-- 5. Times the app can't set ----------------------------------------------------------
-- Column grants below leave created_at and updated_at out, so the defaults
-- set them on insert, and this keeps updated_at honest on every edit.
create or replace function public.touch_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

revoke execute on function public.touch_updated_at() from public, anon, authenticated;

drop trigger if exists touch_updated_at on public.prompt_chain_mix;
create trigger touch_updated_at
  before update on public.prompt_chain_mix
  for each row execute function public.touch_updated_at();

drop trigger if exists touch_updated_at on public.terms;
create trigger touch_updated_at
  before update on public.terms
  for each row execute function public.touch_updated_at();

drop trigger if exists touch_updated_at on public.ai_generation_examples;
create trigger touch_updated_at
  before update on public.ai_generation_examples
  for each row execute function public.touch_updated_at();

-- 6. Privileges ------------------------------------------------------------------------
-- Supabase grants every new table to anon and authenticated by default, so
-- start from nothing and add back only what the admin panel uses.
revoke all on public.llm_providers, public.llm_models, public.prompt_chains,
  public.prompt_chain_steps, public.prompt_chain_mix, public.terms,
  public.ai_generation_examples, public.allowed_signup_domains,
  public.whitelisted_email_addresses
  from anon, authenticated;

-- Read only: chains and steps change through this file, not the panel.
grant select on public.prompt_chains, public.prompt_chain_steps to authenticated;

-- The mix: read, and change the weight only.
grant select on public.prompt_chain_mix to authenticated;
grant update (weight) on public.prompt_chain_mix to authenticated;

-- Full CRUD, limited to the columns a person fills in.
grant select, delete on public.llm_providers, public.llm_models, public.terms,
  public.ai_generation_examples, public.allowed_signup_domains,
  public.whitelisted_email_addresses
  to authenticated;
grant insert (name, website), update (name, website) on public.llm_providers to authenticated;
grant insert (provider_id, name, api_model_id, supports_temperature, is_active),
      update (provider_id, name, api_model_id, supports_temperature, is_active)
  on public.llm_models to authenticated;
grant insert (term, definition, example), update (term, definition, example)
  on public.terms to authenticated;
grant insert (chain_id, image_description, caption, notes),
      update (chain_id, image_description, caption, notes)
  on public.ai_generation_examples to authenticated;
grant insert (domain, note), update (domain, note) on public.allowed_signup_domains to authenticated;
grant insert (email, note), update (email, note) on public.whitelisted_email_addresses to authenticated;

-- 7. Row level security: superadmins only ------------------------------------------------
alter table public.llm_providers enable row level security;
alter table public.llm_models enable row level security;
alter table public.prompt_chains enable row level security;
alter table public.prompt_chain_steps enable row level security;
alter table public.prompt_chain_mix enable row level security;
alter table public.terms enable row level security;
alter table public.ai_generation_examples enable row level security;
alter table public.allowed_signup_domains enable row level security;
alter table public.whitelisted_email_addresses enable row level security;

drop policy if exists "Superadmins can view prompt chains" on public.prompt_chains;
create policy "Superadmins can view prompt chains"
  on public.prompt_chains for select
  to authenticated
  using ((select public.is_superadmin()));

drop policy if exists "Superadmins can view prompt chain steps" on public.prompt_chain_steps;
create policy "Superadmins can view prompt chain steps"
  on public.prompt_chain_steps for select
  to authenticated
  using ((select public.is_superadmin()));

drop policy if exists "Superadmins can view the prompt chain mix" on public.prompt_chain_mix;
create policy "Superadmins can view the prompt chain mix"
  on public.prompt_chain_mix for select
  to authenticated
  using ((select public.is_superadmin()));

drop policy if exists "Superadmins can edit the prompt chain mix" on public.prompt_chain_mix;
create policy "Superadmins can edit the prompt chain mix"
  on public.prompt_chain_mix for update
  to authenticated
  using ((select public.is_superadmin()))
  with check ((select public.is_superadmin()));

-- One "for all" policy per CRUD table: the grants above already decide which
-- commands and columns are possible.
drop policy if exists "Superadmins can manage LLM providers" on public.llm_providers;
create policy "Superadmins can manage LLM providers"
  on public.llm_providers for all
  to authenticated
  using ((select public.is_superadmin()))
  with check ((select public.is_superadmin()));

drop policy if exists "Superadmins can manage LLM models" on public.llm_models;
create policy "Superadmins can manage LLM models"
  on public.llm_models for all
  to authenticated
  using ((select public.is_superadmin()))
  with check ((select public.is_superadmin()));

drop policy if exists "Superadmins can manage terms" on public.terms;
create policy "Superadmins can manage terms"
  on public.terms for all
  to authenticated
  using ((select public.is_superadmin()))
  with check ((select public.is_superadmin()));

drop policy if exists "Superadmins can manage generation examples" on public.ai_generation_examples;
create policy "Superadmins can manage generation examples"
  on public.ai_generation_examples for all
  to authenticated
  using ((select public.is_superadmin()))
  with check ((select public.is_superadmin()));

drop policy if exists "Superadmins can manage sign-up domains" on public.allowed_signup_domains;
create policy "Superadmins can manage sign-up domains"
  on public.allowed_signup_domains for all
  to authenticated
  using ((select public.is_superadmin()))
  with check ((select public.is_superadmin()));

drop policy if exists "Superadmins can manage whitelisted emails" on public.whitelisted_email_addresses;
create policy "Superadmins can manage whitelisted emails"
  on public.whitelisted_email_addresses for all
  to authenticated
  using ((select public.is_superadmin()))
  with check ((select public.is_superadmin()));

-- 8. Seed from the main app's pipeline ------------------------------------------------
-- Copied from lib/gemini.ts and lib/captions.ts on 2026-10-28. "on conflict do
-- nothing" everywhere, so re-running this never overwrites an admin's edits.
insert into public.llm_providers (name, website)
values ('Google', 'https://ai.google.dev'), ('Anthropic', 'https://www.anthropic.com')
on conflict (name) do nothing;

-- The main app's first choice (Claude, since 2026-10-28) and its two
-- Gemini fallbacks, plus Gemini 3.5 Flash, which it used before switching to
-- Flash-Lite on 2026-10-07 (one photo still has it). All thinking models, so
-- no temperature. A database seeded before Claude: run claude.sql once.
insert into public.llm_models (provider_id, name, api_model_id, supports_temperature, is_active)
select p.id, m.name, m.api_model_id, false, m.is_active
  from public.llm_providers p
  join (values
   ('Anthropic', 'Claude Opus 5.5 (default)', 'claude-opus-5-5', true),
   ('Google', 'Gemini 3.5 Flash-Lite (first fallback)', 'gemini-3.5-flash-lite', true),
   ('Google', 'Gemini 3.1 Flash-Lite (second fallback)', 'gemini-3.1-flash-lite', true),
   ('Google', 'Gemini 3.5 Flash (until Oct 7)', 'gemini-3.5-flash', false)
 ) as m (provider, name, api_model_id, is_active) on m.provider = p.name
on conflict (api_model_id) do nothing;

insert into public.prompt_chains (slug, name, description)
values
  ('midwest', '🌽 Midwest culture shock', 'Fresh off the plane and still shook'),
  ('online', '📱 Chronically online', 'Lowercase, unhinged, posted at 2am'),
  ('columbia', '🦁 Columbia life', 'Butler all-nighters and the 1 train'),
  ('newyorker', '🗽 Jaded New Yorker', 'Seen it all, impressed by none of it')
on conflict (slug) do nothing;

-- One step per chain today: a single call that sees the photo and returns
-- three captions as JSON, to Claude (Gemini when Claude can't
-- answer). {location_line} is "The poster says it was
-- taken at: "<location>"." or "The poster didn't say where in New York it
-- was taken."
insert into public.prompt_chain_steps
  (chain_id, step_order, name, model_id, temperature, system_prompt, user_prompt, output_format)
select c.id,
       1,
       'Caption the photo',
       (select id from public.llm_models where api_model_id = 'claude-opus-5-5'),
       null,
       $prompt$You write photo captions for a website where college students who are new to New York City post photos from around the city, and everyone votes on the funniest caption.

Rules:
- Write exactly 3 captions. Each one takes a different angle on what is actually in the photo.
- One line each, under 100 characters. No hashtags, no surrounding quotation marks, at most one emoji.
- Be specific to this photo. Generic captions that could fit any picture lose.
- Be funny and kind: punch up. Never joke about anyone's appearance, race, ethnicity, religion, gender, sexuality or disability.
- If the photo isn't from New York, caption it anyway in the requested voice.$prompt$,
       'Voice: write as ' || v.instruction || E'\n{location_line}\nCaption this photo.',
       'JSON {"captions": [3 strings]}, with the photo sent as an inline image'
  from public.prompt_chains c
  join (values
    ('midwest', $v$a college junior who just moved to New York from the Midwest and is still amazed and slightly horrified by everything. Compare things to back home (Target parking lots, ranch dressing, saying "ope", driving everywhere). Wholesome but shook.$v$),
    ('online', $v$a chronically online Gen Z college student. Lowercase, current internet slang and meme formats, like a viral tweet or TikTok comment. Never cringe or try-hard.$v$),
    ('columbia', $v$a stressed Columbia College junior. Reference campus life where it fits: the Core, all-nighters in Butler Library, dorm life, dining hall food, Morningside Heights, the 1 train.$v$),
    ('newyorker', $v$a born-and-raised New Yorker who has seen it all. Deadpan, unimpressed, brutally efficient, a little rude but never mean.$v$)
  ) as v (slug, instruction) on v.slug = c.slug
on conflict (chain_id, step_order) do nothing;

-- Users pick the vibe themselves, so an even mix to start.
insert into public.prompt_chain_mix (chain_id, weight)
select id, 25 from public.prompt_chains
on conflict (chain_id) do nothing;

insert into public.terms (term, definition, example)
values
  ('Butler', 'Butler Library, the main library on campus, where people pull all-nighters before deadlines.', 'Moving into Butler for finals week.'),
  ('Lit Hum', 'Literature Humanities, the Core course where first-years read a great book every week or two.', 'Read 400 pages of Lit Hum, retained the cover.'),
  ('The Core', 'Columbia''s required Core Curriculum: Lit Hum, CC, Art Hum, Music Hum and more.', null),
  ('Low Steps', 'The wide steps in front of Low Library, where everyone sits when it''s sunny.', null),
  ('The 1 train', 'The subway line that stops at 116th St–Columbia University.', 'The 1 train being local is a personality trait.'),
  ('JJ''s Place', 'The late-night dining spot in John Jay Hall.', null)
on conflict do nothing;

insert into public.ai_generation_examples (chain_id, image_description, caption, notes)
select c.id, e.image_description, e.caption, e.notes
  from (values
    ('columbia', 'A packed reading room in Butler Library late at night', 'butler at 2am has the energy of an airport gate with no flights', 'Hand-written example of the voice'),
    ('newyorker', 'Tourists stopped in the middle of a busy sidewalk taking photos', 'Walk. Or don''t. But not here.', 'Hand-written example of the voice')
  ) as e (slug, image_description, caption, notes)
  join public.prompt_chains c on c.slug = e.slug
 where not exists (
   select 1 from public.ai_generation_examples x where x.caption = e.caption
 );

insert into public.allowed_signup_domains (domain, note)
values
  ('columbia.edu', 'Columbia students and staff'),
  ('barnard.edu', 'Barnard students and staff')
on conflict (domain) do nothing;

-- 9. Check -----------------------------------------------------------------------------
-- Every new table should have RLS on and at least one Superadmins policy.
select c.relname as table_name,
       c.relrowsecurity as rls_on,
       count(p.policyname) as superadmin_policies
  from pg_class c
  left join pg_policies p
    on p.schemaname = 'public' and p.tablename = c.relname and p.policyname like 'Superadmins%'
 where c.relnamespace = 'public'::regnamespace
   and c.relname in ('llm_providers', 'llm_models', 'prompt_chains', 'prompt_chain_steps',
                     'prompt_chain_mix', 'terms', 'ai_generation_examples',
                     'allowed_signup_domains', 'whitelisted_email_addresses')
 group by c.relname, c.relrowsecurity
 order by c.relname;
