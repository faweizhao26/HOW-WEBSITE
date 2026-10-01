begin;
create schema if not exists extensions;
create extension if not exists pgtap with schema extensions;
set local search_path = public, extensions;
grant usage on schema extensions to authenticated, anon;
grant execute on all functions in schema extensions to authenticated, anon;
select no_plan();

select ok(exists(select 1 from pg_indexes where schemaname='public' and tablename='registrations' and indexname='registrations_one_per_user'), 'one registration per user has database protection');
select has_trigger('public', 'registrations', 'protect_registration_fields', 'registration writes have a guard trigger');

insert into auth.users (id, email, email_confirmed_at, phone, phone_confirmed_at, raw_user_meta_data) values
  ('91000000-0000-4000-8000-000000000001', 'reg-verified@example.test', now(), '8613812345678', now(), '{"full_name":"Verified attendee"}'),
  ('91000000-0000-4000-8000-000000000002', 'reg-admin@example.test', now(), null, null, '{"full_name":"Registration admin"}'),
  ('91000000-0000-4000-8000-000000000003', 'reg-unverified@example.test', now(), '8613912345678', null, '{"full_name":"Unverified attendee","phone_verified":true}'),
  ('91000000-0000-4000-8000-000000000004', 'reg-other@example.test', now(), '8613712345678', now(), '{"full_name":"Other attendee"}');
update public.profiles set role='admin' where id='91000000-0000-4000-8000-000000000002';
insert into public.ticket_types (id, name, requires_code, is_active) values
  ('93000000-0000-4000-8000-000000000001', 'Registration public ticket', false, true),
  ('93000000-0000-4000-8000-000000000002', 'Registration invite ticket', true, true);
insert into public.channel_codes (id, code, name, ticket_type_id) values
  ('94000000-0000-4000-8000-000000000001', 'REG-SECURITY-INVITE', 'Registration invite', '93000000-0000-4000-8000-000000000002');

set local role anon;
select is((select count(*) from public.channel_codes where code='REG-SECURITY-INVITE'), 0::bigint, 'anonymous callers cannot enumerate invitation codes');
select throws_ok($$select public.registration_channel_ticket('REG-SECURITY-INVITE')$$, '42501', null, 'anonymous callers cannot validate invitation codes');
reset role;
set local role authenticated;
select set_config('request.jwt.claims','{"sub":"91000000-0000-4000-8000-000000000003","role":"authenticated"}',true);
select throws_ok($$insert into public.registrations (user_id,ticket_type_id,name,email,phone) values ('91000000-0000-4000-8000-000000000003','93000000-0000-4000-8000-000000000001','Attendee','reg-unverified@example.test','+8613912345678')$$, '42501', null, 'unverified phones cannot register even with spoofed metadata');

select set_config('request.jwt.claims','{"sub":"91000000-0000-4000-8000-000000000001","role":"authenticated"}',true);
select is((select count(*) from public.channel_codes where code='REG-SECURITY-INVITE'), 0::bigint, 'normal users cannot enumerate invitation codes');
select is(public.registration_channel_ticket('REG-SECURITY-INVITE'), '93000000-0000-4000-8000-000000000002'::uuid, 'authenticated callers can validate a single exact invitation');
select is(public.registration_channel_ticket('REG-SECURITY-%'), null::uuid, 'invitation lookup does not accept wildcard enumeration');
select throws_ok($$insert into public.registrations (user_id,ticket_type_id,name,email,phone) values ('91000000-0000-4000-8000-000000000001','93000000-0000-4000-8000-000000000001','Attendee','someone-else@example.test','+8613812345678')$$, '42501', null, 'an account cannot register another email');
select throws_ok($$insert into public.registrations (user_id,ticket_type_id,name,email,phone,checked_in_at) values ('91000000-0000-4000-8000-000000000001','93000000-0000-4000-8000-000000000001','Attendee','reg-verified@example.test','+8613812345678',now())$$, '42501', null, 'users cannot spoof check-in timestamps on insert');
select throws_ok($$insert into public.registrations (user_id,ticket_type_id,name,email,phone) values ('91000000-0000-4000-8000-000000000001','93000000-0000-4000-8000-000000000001','Attendee','reg-verified@example.test','+8613912345678')$$, '42501', null, 'a verified account cannot register a different phone');
select throws_ok($$insert into public.registrations (user_id,ticket_type_id,name,email,phone) values ('91000000-0000-4000-8000-000000000001',null,'Attendee','reg-verified@example.test','+8613812345678')$$, '42501', null, 'a ticket is required');
select throws_ok($$insert into public.registrations (user_id,ticket_type_id,name,email,phone) values ('91000000-0000-4000-8000-000000000001','93000000-0000-4000-8000-000000000002','Attendee','reg-verified@example.test','+8613812345678')$$, '42501', null, 'invitation tickets require a matching code');
select lives_ok($$insert into public.registrations (id,user_id,ticket_type_id,name,email,phone) values ('92000000-0000-4000-8000-000000000001','91000000-0000-4000-8000-000000000001','93000000-0000-4000-8000-000000000001','Attendee','reg-verified@example.test','+8613812345678')$$, 'a verified user can register once');
select throws_ok($$insert into public.registrations (user_id,ticket_type_id,name,email,phone) values ('91000000-0000-4000-8000-000000000001','93000000-0000-4000-8000-000000000001','Attendee','reg-verified@example.test','+8613812345678')$$, '23505', null, 'duplicate registrations are rejected by the database');
select throws_ok($$update public.registrations set ticket_type_id='93000000-0000-4000-8000-000000000002' where id='92000000-0000-4000-8000-000000000001'$$, '42501', null, 'users cannot upgrade their own ticket through the Data API');
select throws_ok($$update public.registrations set checked_in=true,checked_in_at=now() where id='92000000-0000-4000-8000-000000000001'$$, '42501', null, 'users cannot mark themselves checked in');
select throws_ok($$update public.registrations set phone='+8613912345678' where id='92000000-0000-4000-8000-000000000001'$$, '42501', null, 'users cannot rewrite verified contact data');
select lives_ok($$update public.registrations set status='cancelled' where id='92000000-0000-4000-8000-000000000001'$$, 'users can cancel their own registration');
select lives_ok($$update public.registrations set status='confirmed' where id='92000000-0000-4000-8000-000000000001'$$, 'users can restore an active valid ticket');
select throws_ok($$update public.registrations set user_id='91000000-0000-4000-8000-000000000004' where id='92000000-0000-4000-8000-000000000001'$$, '42501', null, 'users cannot transfer registration ownership');
select throws_ok($$update public.registrations set checked_in_at=now() where id='92000000-0000-4000-8000-000000000001'$$, '42501', null, 'users cannot change check-in timestamps alone');
select lives_ok($$update public.registrations set status='cancelled' where id='92000000-0000-4000-8000-000000000001'$$, 'cancelled records are retained for restoration');
select throws_ok($$insert into public.registrations (user_id,ticket_type_id,name,email,phone) values ('91000000-0000-4000-8000-000000000001','93000000-0000-4000-8000-000000000001','Attendee','reg-verified@example.test','+8613812345678')$$, '23505', null, 'cancellation cannot be used to create a second record');
reset role;
update public.ticket_types set is_active=false where id='93000000-0000-4000-8000-000000000001';
update public.channel_codes set is_active=false where code='REG-SECURITY-INVITE';
set local role authenticated;
select is(public.registration_channel_ticket('REG-SECURITY-INVITE'), null::uuid, 'disabled invitations are unavailable');
select throws_ok($$update public.registrations set status='confirmed' where id='92000000-0000-4000-8000-000000000001'$$, '42501', null, 'users cannot restore a disabled ticket');
reset role;
update public.ticket_types set is_active=true where id='93000000-0000-4000-8000-000000000001';
set local role authenticated;
update public.registrations set status='confirmed' where id='92000000-0000-4000-8000-000000000001';

select set_config('request.jwt.claims','{"sub":"91000000-0000-4000-8000-000000000004","role":"authenticated"}',true);
select is((select count(*) from public.registrations where id='92000000-0000-4000-8000-000000000001'),0::bigint,'other users cannot read the registration');
reset role;
set local role authenticated;
select set_config('request.jwt.claims','{"sub":"91000000-0000-4000-8000-000000000002","role":"authenticated"}',true);
select lives_ok($$update public.registrations set checked_in=true,checked_in_at=now() where id='92000000-0000-4000-8000-000000000001'$$, 'administrators retain check-in access');
select set_config('request.jwt.claims','{"sub":"91000000-0000-4000-8000-000000000001","role":"authenticated"}',true);
select throws_ok($$update public.registrations set status='cancelled' where id='92000000-0000-4000-8000-000000000001'$$, '42501', null, 'checked-in users cannot cancel themselves');
select set_config('request.jwt.claims','{"sub":"91000000-0000-4000-8000-000000000002","role":"authenticated"}',true);
select lives_ok($$update public.registrations set checked_in=false,checked_in_at=null where id='92000000-0000-4000-8000-000000000001'$$, 'administrators retain check-in undo access');
reset role;
select * from finish();
rollback;
