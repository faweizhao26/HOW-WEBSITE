begin;

create extension if not exists pgtap with schema extensions;
set local search_path = public, extensions;
grant usage on schema extensions to anon, authenticated;
grant execute on all functions in schema extensions to anon, authenticated;
select plan(42);

select has_table('public', 'speakers', 'speaker drafts exist');
select has_table('public', 'published_speakers', 'public speaker projection exists');
select has_table('public', 'published_sessions', 'public session projection exists');
select has_table('public', 'published_sponsors', 'public sponsor projection exists');
select has_table('public', 'published_news_posts', 'public news projection exists');
select has_table('public', 'agenda_releases', 'agenda releases exist');
select has_table('public', 'site_settings_releases', 'settings releases exist');

select has_function('public', 'publish_speaker', array['uuid'], 'speaker publish RPC exists');
select has_function('public', 'publish_session', array['uuid'], 'session publish RPC exists');
select has_function('public', 'publish_agenda', array[]::text[], 'agenda publish RPC exists');
select has_function('public', 'publish_site_settings', array[]::text[], 'settings publish RPC exists');

set local role anon;
select throws_ok(
  'select * from public.profiles'::text,
  42501,
  null::text,
  'anonymous users cannot read account profiles'::text
);
select throws_ok(
  'select * from public.speakers'::text,
  42501,
  null::text,
  'anonymous users cannot read speaker drafts'::text
);
select lives_ok(
  'select * from public.published_speakers',
  'anonymous users can read published speakers'
);
reset role;

select results_eq(
  $$select count(*)::bigint from public.published_speakers where false$$,
  $$values (0::bigint)$$,
  'published projection is independently queryable'
);

select throws_ok(
  $$select public.publish_agenda()$$::text,
  42501,
  null::text,
  'unauthenticated publication is rejected'::text
);

select results_eq(
  $$select count(*)::bigint from public.agenda_releases where is_current$$,
  $$values (0::bigint)$$,
  'failed publication leaves the current agenda unchanged'
);

select results_eq(
  $$select count(*)::bigint from public.site_settings_releases where is_current$$,
  $$values (1::bigint)$$,
  'migration creates exactly one initial settings release'
);

insert into auth.users (id, email, raw_user_meta_data)
values (
  '10000000-0000-0000-0000-000000000001',
  'submitter@example.com',
  '{"full_name":"Test submitter"}'::jsonb
);

set local role authenticated;
set local request.jwt.claim.sub = '10000000-0000-0000-0000-000000000001';

select throws_ok(
  $$insert into public.sessions (user_id, title, abstract, duration, type, status)
    values ('10000000-0000-0000-0000-000000000001', 'Escalated', 'Should fail', 30, 'talk', 'approved')$$::text,
  42501,
  null::text,
  'submitters cannot create pre-approved sessions'::text
);
select lives_ok(
  $$insert into public.sessions (id, user_id, title, abstract, duration, type)
    values ('20000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000001', 'Pending', 'Allowed', 30, 'talk')$$,
  'submitters can create pending draft sessions'
);
select throws_ok(
  $$update public.sessions
    set status = 'approved'
    where id = '20000000-0000-0000-0000-000000000001'$$::text,
  42501,
  null::text,
  'submitters cannot change review status'::text
);
reset role;

insert into auth.users (id, email, raw_user_meta_data)
values (
  '10000000-0000-0000-0000-000000000002',
  'admin@example.com',
  '{"full_name":"Test administrator"}'::jsonb
);
update public.profiles
set role = 'admin'
where id = '10000000-0000-0000-0000-000000000002';

set local role authenticated;
set local request.jwt.claim.sub = '10000000-0000-0000-0000-000000000002';

select throws_ok(
  $$select public.publish_session('20000000-0000-0000-0000-000000000001')$$::text,
  23514,
  null::text,
  'pending sessions cannot be published'::text
);
update public.sessions
set status = 'rejected'
where id = '20000000-0000-0000-0000-000000000001';
select throws_ok(
  $$select public.publish_session('20000000-0000-0000-0000-000000000001')$$::text,
  23514,
  null::text,
  'rejected sessions cannot be published'::text
);
update public.sessions
set status = 'approved'
where id = '20000000-0000-0000-0000-000000000001';
select throws_ok(
  $$select public.publish_session('20000000-0000-0000-0000-000000000001')$$::text,
  23503,
  null::text,
  'approved sessions require a published speaker'::text
);

insert into public.speakers (id, name)
values ('30000000-0000-0000-0000-000000000001', 'Published test speaker');
select lives_ok(
  $$select public.publish_speaker('30000000-0000-0000-0000-000000000001')$$,
  'an administrator can publish the assigned speaker'
);
update public.sessions
set speaker_id = '30000000-0000-0000-0000-000000000001'
where id = '20000000-0000-0000-0000-000000000001';
select lives_ok(
  $$select public.publish_session('20000000-0000-0000-0000-000000000001')$$,
  'an approved session with a published speaker can be published'
);
update public.sessions
set title = 'Edited after publication'
where id = '20000000-0000-0000-0000-000000000001';
select results_eq(
  $$select title from public.published_sessions where id = '20000000-0000-0000-0000-000000000001'$$,
  $$values ('Pending'::text)$$,
  'editing a published draft does not change the public projection'
);

insert into public.sponsors (id, name, logo_url, tier)
values ('40000000-0000-0000-0000-000000000001', 'Original sponsor', 'https://example.com/logo.png', 'gold');
select is((select count(*) from public.published_sponsors where id = '40000000-0000-0000-0000-000000000001'), 0::bigint, 'sponsor draft is hidden before publication');
select lives_ok($$select public.publish_sponsor('40000000-0000-0000-0000-000000000001')$$, 'administrator can publish a sponsor');
create temporary table sponsor_snapshot as
select to_jsonb(s) as payload from public.published_sponsors s where id = '40000000-0000-0000-0000-000000000001';
update public.sponsors set name = 'Edited sponsor', logo_url = 'https://example.com/new.png'
where id = '40000000-0000-0000-0000-000000000001';
select results_eq(
  $$select to_jsonb(s) from public.published_sponsors s where id = '40000000-0000-0000-0000-000000000001'$$,
  $$select payload from sponsor_snapshot$$,
  'sponsor public snapshot stays byte-for-byte unchanged after draft edit'
);
select lives_ok($$select public.publish_sponsor('40000000-0000-0000-0000-000000000001')$$, 'administrator can republish a sponsor');
select is((select name from public.published_sponsors where id = '40000000-0000-0000-0000-000000000001'), 'Edited sponsor', 'republish updates public sponsor');
select lives_ok($$select public.unpublish_sponsor('40000000-0000-0000-0000-000000000001')$$, 'administrator can withdraw a sponsor');
select is((select count(*) from public.published_sponsors where id = '40000000-0000-0000-0000-000000000001'), 0::bigint, 'withdrawn sponsor is hidden');

insert into public.news_posts (id, title, content)
values ('50000000-0000-0000-0000-000000000001', 'Original news', 'Original body');
select is((select published_at from public.news_posts where id = '50000000-0000-0000-0000-000000000001'), null::timestamptz, 'news draft has no publication date');
select is((select count(*) from public.published_news_posts where id = '50000000-0000-0000-0000-000000000001'), 0::bigint, 'news draft is hidden before publication');
select lives_ok($$select public.publish_news_post('50000000-0000-0000-0000-000000000001')$$, 'administrator can publish news');
create temporary table news_snapshot as
select to_jsonb(n) as payload from public.published_news_posts n where id = '50000000-0000-0000-0000-000000000001';
update public.news_posts set title = 'Edited news', content = 'Edited body'
where id = '50000000-0000-0000-0000-000000000001';
select results_eq(
  $$select to_jsonb(n) from public.published_news_posts n where id = '50000000-0000-0000-0000-000000000001'$$,
  $$select payload from news_snapshot$$,
  'news public snapshot stays byte-for-byte unchanged after draft edit'
);
select lives_ok($$select public.publish_news_post('50000000-0000-0000-0000-000000000001')$$, 'administrator can republish news');
select is((select title from public.published_news_posts where id = '50000000-0000-0000-0000-000000000001'), 'Edited news', 'republish updates public news');
select lives_ok($$select public.unpublish_news_post('50000000-0000-0000-0000-000000000001')$$, 'administrator can withdraw news');
select is((select count(*) from public.published_news_posts where id = '50000000-0000-0000-0000-000000000001'), 0::bigint, 'withdrawn news is hidden');
reset role;

select * from finish();
rollback;
