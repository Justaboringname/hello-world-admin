-- 2026-10-28: Claude writes the captions first, and Gemini Flash-Lite
-- is the fallback (lib/claude.ts and lib/gemini.ts, in both apps). week7.sql
-- seeds this for a new database. Run this once on a database seeded before
-- that, after week7.sql: it adds Anthropic and the Claude model, renames the
-- Gemini models to fallbacks and points the chain steps at Claude. Safe to
-- re-run; it only renames rows that still have the old seeded names.

insert into public.llm_providers (name, website)
values ('Anthropic', 'https://www.anthropic.com')
on conflict (name) do nothing;

insert into public.llm_models (provider_id, name, api_model_id, supports_temperature, is_active)
select p.id, 'Claude Opus 5.5 (default)', 'claude-opus-5-5', false, true
  from public.llm_providers p
 where p.name = 'Anthropic'
on conflict (api_model_id) do nothing;

update public.llm_models set name = 'Claude Opus 5.5 (default)'
 where api_model_id = 'claude-opus-5-5' and name = 'Claude Opus 5.5';
update public.llm_models set name = 'Gemini 3.5 Flash-Lite (first fallback)'
 where api_model_id = 'gemini-3.5-flash-lite' and name = 'Gemini 3.5 Flash-Lite (default)';
update public.llm_models set name = 'Gemini 3.1 Flash-Lite (second fallback)'
 where api_model_id = 'gemini-3.1-flash-lite' and name = 'Gemini 3.1 Flash-Lite (fallback)';

-- The steps week7.sql seeded on Gemini 3.5 Flash-Lite.
update public.prompt_chain_steps
   set model_id = (select id from public.llm_models where api_model_id = 'claude-opus-5-5')
 where step_order = 1
   and name = 'Caption the photo'
   and model_id = (select id from public.llm_models where api_model_id = 'gemini-3.5-flash-lite');

-- Check: which model each chain's step calls.
select c.slug, s.step_order, m.name as model, m.api_model_id
  from public.prompt_chain_steps s
  join public.prompt_chains c on c.id = s.chain_id
  left join public.llm_models m on m.id = s.model_id
 order by c.id, s.step_order;
