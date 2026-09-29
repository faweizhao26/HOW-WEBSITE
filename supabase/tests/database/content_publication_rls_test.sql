begin;

create extension if not exists pgtap with schema extensions;
select plan(21);

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
  'select * from public.profiles',
  '42501',
  null,
  'anonymous users cannot read account profiles'
);
select throws_ok(
  'select * from public.speakers',
  '42501',
  null,
  'anonymous users cannot read speaker drafts'
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
  $$select public.publish_agenda()$$,
  '42501',
  null,
  'unauthenticated publication is rejected'
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

insert into auth.users (id) values ('10000000-0000-0000-0000-000000000001');
insert into public.profiles (id, full_name)
values ('10000000-0000-0000-0000-000000000001', 'Test submitter');

set local role authenticated;
set local request.jwt.claim.sub = '10000000-0000-0000-0000-000000000001';

select throws_ok(
  $$insert into public.sessions (user_id, title, abstract, duration, type, status)
    values ('10000000-0000-0000-0000-000000000001', 'Escalated', 'Should fail', 30, 'talk', 'approved')$$,
  '42501',
  null,
  'submitters cannot create pre-approved sessions'
);
select lives_ok(
  $$insert into public.sessions (id, user_id, title, abstract, duration, type)
    values ('20000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000001', 'Pending', 'Allowed', 30, 'talk')$$,
  'submitters can create pending draft sessions'
);
select throws_ok(
  $$update public.sessions
    set status = 'approved'
    where id = '20000000-0000-0000-0000-000000000001'$$,
  '42501',
  null,
  'submitters cannot change review status'
);
reset role;

select * from finish();
rollback;
