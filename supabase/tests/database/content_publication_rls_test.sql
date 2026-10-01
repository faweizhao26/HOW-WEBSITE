begin;

create schema if not exists extensions;
create extension if not exists pgtap with schema extensions;
-- Exercise the Supabase extension layout; the enclosing rollback restores it.
do $$
begin
  if exists (
    select 1 from pg_catalog.pg_extension e
    join pg_catalog.pg_namespace n on n.oid = e.extnamespace
    where e.extname = 'uuid-ossp' and n.nspname <> 'extensions'
  ) then
    alter extension "uuid-ossp" set schema extensions;
  end if;
end;
$$;
set local search_path = public, extensions;
grant usage on schema extensions to anon, authenticated;
grant execute on all functions in schema extensions to anon, authenticated;
select no_plan();

select is(
  (select n.nspname::text from pg_catalog.pg_extension e join pg_catalog.pg_namespace n on n.oid = e.extnamespace where e.extname = 'uuid-ossp'),
  'extensions',
  'publication tests run with uuid-ossp outside the RPC search path'
);

select is(
  (select count(*) from pg_catalog.pg_proc p join pg_catalog.pg_namespace n on n.oid = p.pronamespace
   where n.nspname = 'public' and not p.prosecdef and p.proname in (
     'publish_speaker', 'unpublish_speaker', 'publish_session', 'unpublish_session',
     'publish_sponsor', 'unpublish_sponsor', 'publish_news_post', 'unpublish_news_post',
     'publish_agenda', 'rollback_agenda_release', 'publish_site_settings', 'rollback_site_settings_release'
   )),
  12::bigint,
  'all public publication entrypoints remain security invoker'
);
select is(
  (select count(*) from pg_catalog.pg_proc p join pg_catalog.pg_namespace n on n.oid = p.pronamespace
   where n.nspname = 'private' and p.prosecdef and p.proname in (
     'publish_speaker', 'unpublish_speaker', 'publish_session', 'unpublish_session',
     'publish_sponsor', 'unpublish_sponsor', 'publish_news_post', 'unpublish_news_post',
     'publish_agenda', 'rollback_agenda_release', 'publish_site_settings', 'rollback_site_settings_release'
   )),
  12::bigint,
  'validated writes are implemented only in private security definers'
);

insert into public.ticket_types (id, name, is_active) values
  ('70000000-0000-0000-0000-000000000001', 'Public test ticket', true),
  ('70000000-0000-0000-0000-000000000002', 'Private test ticket', false);
insert into public.channel_codes (id, code, name, ticket_type_id, is_active) values
  ('80000000-0000-0000-0000-000000000001', 'PUBLICATION-TEST-ACTIVE', 'Active test code', '70000000-0000-0000-0000-000000000001', true),
  ('80000000-0000-0000-0000-000000000002', 'PUBLICATION-TEST-INACTIVE', 'Inactive test code', '70000000-0000-0000-0000-000000000001', false);

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
select results_eq(
  $$select id from public.ticket_types where id in ('70000000-0000-0000-0000-000000000001', '70000000-0000-0000-0000-000000000002') order by id$$,
  $$values ('70000000-0000-0000-0000-000000000001'::uuid)$$,
  'anonymous ticket queries work and expose only active tickets'
);
select is_empty(
  $$select id from public.channel_codes where id in ('80000000-0000-0000-0000-000000000001', '80000000-0000-0000-0000-000000000002') order by id$$,
  'anonymous callers cannot enumerate invitation codes'
);
select lives_ok(
  $$select c.code, t.name from public.channel_codes c join public.ticket_types t on t.id = c.ticket_type_id where c.code = 'PUBLICATION-TEST-ACTIVE'$$,
  'anonymous registration joins do not require profile select privileges'
);
select throws_ok(
  'select private.publish_agenda()'::text, 42501, null::text,
  'anonymous callers cannot execute private publication helpers'::text
);
select throws_ok(format('select * from public.%I', name), 42501, null::text, format('anonymous users cannot read %s drafts', name))
from (values ('sessions'), ('agenda_slots'), ('sponsors'), ('news_posts'), ('site_settings')) as drafts(name);
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
select is(
  (select payload->>'conference_date' from public.site_settings_releases where is_current),
  '2027.4.16-4.18',
  'initial settings release uses the canonical three-day conference period'
);
select ok(
  (select bool_and(btrim(coalesce(r.payload->>required.key, '')) <> '')
   from public.site_settings_releases r cross join (values
     ('conference_name'), ('conference_date'), ('conference_location'), ('conference_location_zh'),
     ('contact_email'), ('hero_title'), ('hero_title_zh'), ('hero_subtitle'), ('hero_subtitle_zh')
   ) as required(key) where r.is_current),
  'all required initial settings are present and nonblank'
);
select results_eq(
  $$select payload from public.site_settings_releases where is_current$$,
  $$select private.validated_site_settings_payload()$$,
  'initial settings release passes the same validation as later publications'
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
  $$update public.profiles set role = 'admin' where id = '10000000-0000-0000-0000-000000000001'$$::text,
  42501, null::text, 'ordinary users cannot promote their own account'::text
);
select is((select role from public.profiles where id = '10000000-0000-0000-0000-000000000001'), 'user', 'failed role escalation leaves the account unchanged');
select lives_ok(
  $$update public.profiles set full_name = 'Updated submitter', phone = '123', wechat = 'test' where id = '10000000-0000-0000-0000-000000000001'$$,
  'ordinary users retain editable profile fields'
);
select throws_ok('select private.lock_publication_tables()'::text, 42501, null::text, 'ordinary users cannot acquire publication locks directly'::text);
select throws_ok('select private.validated_site_settings_payload()'::text, 42501, null::text, 'ordinary users cannot invoke internal settings validation'::text);
select throws_ok(format('select %I.%I(%s)', namespace, name, args), 42501, null::text, format('ordinary users cannot call %s.%s', namespace, name))
from (values ('public'), ('private')) as namespaces(namespace)
cross join (values
  ('publish_speaker', $$'30000000-0000-0000-0000-000000000001'::uuid$$),
  ('unpublish_speaker', $$'30000000-0000-0000-0000-000000000001'::uuid$$),
  ('publish_session', $$'20000000-0000-0000-0000-000000000001'::uuid$$),
  ('unpublish_session', $$'20000000-0000-0000-0000-000000000001'::uuid$$),
  ('publish_sponsor', $$'40000000-0000-0000-0000-000000000001'::uuid$$),
  ('unpublish_sponsor', $$'40000000-0000-0000-0000-000000000001'::uuid$$),
  ('publish_news_post', $$'50000000-0000-0000-0000-000000000001'::uuid, NULL::timestamptz$$),
  ('unpublish_news_post', $$'50000000-0000-0000-0000-000000000001'::uuid$$),
  ('publish_agenda', ''),
  ('rollback_agenda_release', $$'ffffffff-ffff-ffff-ffff-ffffffffffff'::uuid$$),
  ('publish_site_settings', ''),
  ('rollback_site_settings_release', $$'ffffffff-ffff-ffff-ffff-ffffffffffff'::uuid$$)
) as rpcs(name, args);

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

-- A caller-supplied flag must not unlock direct publication DML.
set local app.publication_write = 'true';
select throws_ok(format('insert into public.%I default values', name), 42501, null::text, format('even admins cannot directly insert into %s', name))
from (values ('published_speakers'), ('published_sessions'), ('published_sponsors'), ('published_news_posts'), ('agenda_releases'), ('site_settings_releases')) as projections(name);
select throws_ok(format('update public.%I set id = id where false', name), 42501, null::text, format('even admins cannot directly update %s', name))
from (values ('published_speakers'), ('published_sessions'), ('published_sponsors'), ('published_news_posts'), ('agenda_releases'), ('site_settings_releases')) as projections(name);
select throws_ok(format('delete from public.%I where false', name), 42501, null::text, format('even admins cannot directly delete from %s', name))
from (values ('published_speakers'), ('published_sessions'), ('published_sponsors'), ('published_news_posts'), ('agenda_releases'), ('site_settings_releases')) as projections(name);
select throws_ok(format('truncate public.%I', name), 42501, null::text, format('even admins cannot truncate %s', name))
from (values ('published_speakers'), ('published_sessions'), ('published_sponsors'), ('published_news_posts'), ('agenda_releases'), ('site_settings_releases')) as projections(name);

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
select is(
  (select count(*) from pg_catalog.pg_locks
   where pid = pg_catalog.pg_backend_pid() and granted and mode = 'ShareRowExclusiveLock'
     and relation in (
       'public.profiles'::regclass, 'public.speakers'::regclass, 'public.sessions'::regclass,
       'public.agenda_slots'::regclass, 'public.sponsors'::regclass, 'public.news_posts'::regclass,
       'public.site_settings'::regclass, 'public.published_speakers'::regclass, 'public.published_sessions'::regclass,
       'public.published_sponsors'::regclass, 'public.published_news_posts'::regclass,
       'public.agenda_releases'::regclass, 'public.site_settings_releases'::regclass
     )),
  13::bigint,
  'publication holds write-blocking serialisation locks on every source and destination table'
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

delete from public.agenda_slots;
select throws_ok($$select public.publish_agenda()$$::text, 23514, null::text, 'empty agenda cannot publish'::text);
insert into public.agenda_slots (id, date, start_time, end_time, label, type, session_id, room)
values ('60000000-0000-0000-0000-000000000001', '2027-04-16', '09:00', '09:30', '', 'session', '20000000-0000-0000-0000-000000000001', 'Room A');
select lives_ok($$select public.publish_agenda()$$, 'valid complete agenda can publish');
create temporary table first_agenda as select id, payload from public.agenda_releases where is_current;
select is((select count(*) from public.agenda_releases where is_current), 1::bigint, 'exactly one agenda release is current');
select is((select payload->0->'session'->>'title' from first_agenda), 'Pending', 'agenda embeds the published session not its edited draft');
select is((select payload->0->'session'->'speaker'->>'name' from first_agenda), 'Published test speaker', 'agenda embeds the published speaker');

update public.agenda_slots set date = '2027-04-19';
select throws_ok($$select public.publish_agenda()$$::text, 23514, null::text, 'dates outside conference range cannot publish'::text);
select results_eq($$select id, payload from public.agenda_releases where is_current$$, $$select id, payload from first_agenda$$, 'invalid date preserves current release and payload');
update public.agenda_slots set date = '2027-04-16', end_time = start_time;
select throws_ok($$select public.publish_agenda()$$::text, 23514, null::text, 'nonpositive slot duration cannot publish'::text);
select results_eq($$select id, payload from public.agenda_releases where is_current$$, $$select id, payload from first_agenda$$, 'invalid time preserves current release and payload');
update public.agenda_slots set end_time = '09:30', type = 'break', session_id = null, label = '  ';
select throws_ok($$select public.publish_agenda()$$::text, 23514, null::text, 'unbound slots require a nonblank label'::text);
select results_eq($$select id, payload from public.agenda_releases where is_current$$, $$select id, payload from first_agenda$$, 'missing label preserves current release and payload');
update public.agenda_slots set type = 'session';
select throws_ok($$select public.publish_agenda()$$::text, 23514, null::text, 'session slots require a session reference'::text);
update public.agenda_slots set session_id = '20000000-0000-0000-0000-000000000001';
select throws_ok($$select public.unpublish_speaker('30000000-0000-0000-0000-000000000001')$$::text, 23503, null::text, 'published session prevents withdrawal of its speaker'::text);
select public.unpublish_session('20000000-0000-0000-0000-000000000001');
select public.unpublish_speaker('30000000-0000-0000-0000-000000000001');
select throws_ok($$select public.publish_agenda()$$::text, 23503, null::text, 'unpublished session and speaker cannot enter a new agenda'::text);
select results_eq($$select id, payload from public.agenda_releases where is_current$$, $$select id, payload from first_agenda$$, 'withdrawn references leave the existing agenda snapshot intact');
select public.publish_speaker('30000000-0000-0000-0000-000000000001');
select public.publish_session('20000000-0000-0000-0000-000000000001');
update public.agenda_slots set date = '2027-04-18', room = 'Room B';
select lives_ok($$select public.publish_agenda()$$, 'revised complete agenda creates a new release');
select results_eq($$select payload from public.agenda_releases where id = (select id from first_agenda)$$, $$select payload from first_agenda$$, 'historical agenda payload stays immutable');
select lives_ok($$select public.rollback_agenda_release((select id from first_agenda))$$, 'administrator can roll back the agenda');
select results_eq($$select id, payload from public.agenda_releases where is_current$$, $$select id, payload from first_agenda$$, 'rollback restores exactly the original release and payload');
select throws_ok($$select public.rollback_agenda_release('ffffffff-ffff-ffff-ffff-ffffffffffff')$$::text, 'P0002'::char(5), null::text, 'unknown agenda rollback target is rejected'::text);
select results_eq($$select id, payload from public.agenda_releases where is_current$$, $$select id, payload from first_agenda$$, 'failed rollback leaves exactly one unchanged current release');

create temporary table first_settings as select id, payload from public.site_settings_releases where is_current;
update public.site_settings set value = '  ' where key = 'hero_title_zh';
select throws_ok($$select public.publish_site_settings()$$::text, 23514, null::text, 'blank required setting cannot publish'::text);
select results_eq($$select id, payload from public.site_settings_releases where is_current$$, $$select id, payload from first_settings$$, 'missing settings preserve current release and payload');
update public.site_settings set value = (select payload->>'hero_title_zh' from first_settings) where key = 'hero_title_zh';
delete from public.site_settings where key = 'conference_name';
select throws_ok($$select public.publish_site_settings()$$::text, 23514, null::text, 'absent required key cannot publish'::text);
insert into public.site_settings (key, value) select 'conference_name', payload->>'conference_name' from first_settings;
update public.site_settings set value = '2027.4.31-4.32' where key = 'conference_date';
select throws_ok($$select public.publish_site_settings()$$::text, 23514, null::text, 'impossible conference dates cannot publish'::text);
select results_eq($$select id, payload from public.site_settings_releases where is_current$$, $$select id, payload from first_settings$$, 'invalid date preserves current settings release');
update public.site_settings set value = '2027.4.16-4.18' where key = 'conference_date';
update public.site_settings set value = 'New published hero' where key = 'hero_title';
select lives_ok($$select public.publish_site_settings()$$, 'valid complete settings can publish');
select is((select count(*) from public.site_settings_releases where is_current), 1::bigint, 'exactly one settings release is current');
select is((select payload->>'hero_title' from public.site_settings_releases where is_current), 'New published hero', 'new release contains the saved settings draft');
select results_eq($$select payload from public.site_settings_releases where id = (select id from first_settings)$$, $$select payload from first_settings$$, 'historical settings payload stays immutable');
select lives_ok($$select public.rollback_site_settings_release((select id from first_settings))$$, 'administrator can roll back site settings');
select results_eq($$select id, payload from public.site_settings_releases where is_current$$, $$select id, payload from first_settings$$, 'rollback restores exactly the original settings release');
select throws_ok($$select public.rollback_site_settings_release('ffffffff-ffff-ffff-ffff-ffffffffffff')$$::text, 'P0002'::char(5), null::text, 'unknown settings rollback target is rejected'::text);
reset role;

set local role anon;
select is((select count(*) from public.agenda_releases), 1::bigint, 'anonymous users see only the current agenda release');
select is((select count(*) from public.site_settings_releases), 1::bigint, 'anonymous users see only the current settings release');
reset role;
set local role authenticated;
set local request.jwt.claim.sub = '10000000-0000-0000-0000-000000000001';
select is((select count(*) from public.agenda_releases), 1::bigint, 'ordinary users cannot read agenda history');
select is((select count(*) from public.site_settings_releases), 1::bigint, 'ordinary users cannot read settings history');
reset role;

select * from finish();
rollback;
