-- Run with psql -v ON_ERROR_STOP=1 against a disposable, migrated local database.
BEGIN;
SET LOCAL statement_timeout = '15s';
INSERT INTO auth.users(id,email,email_confirmed_at,raw_user_meta_data,raw_app_meta_data) VALUES
  ('41000000-0000-4000-8000-000000000001','notify-admin@example.test',now(),'{}','{}'),
  ('41000000-0000-4000-8000-000000000002','notify-speaker@example.test',now(),'{}','{}'),
  ('41000000-0000-4000-8000-000000000003','notify-attendee@example.test',now(),'{}','{}'),
  ('41000000-0000-4000-8000-000000000004','notify-unregistered@example.test',now(),'{}','{}');
UPDATE public.profiles SET role='admin' WHERE id='41000000-0000-4000-8000-000000000001';
INSERT INTO public.registrations(user_id,name,email,phone) VALUES
  ('41000000-0000-4000-8000-000000000003','QA attendee','notify-attendee@example.test','+8613812345678');
INSERT INTO public.sessions(id,user_id,title,abstract,duration,type,status) VALUES
  ('41000000-0000-4000-8000-000000000011','41000000-0000-4000-8000-000000000002','Accepted one','QA',30,'talk','approved'),
  ('41000000-0000-4000-8000-000000000012','41000000-0000-4000-8000-000000000002','Accepted two','QA',45,'workshop','approved'),
  ('41000000-0000-4000-8000-000000000013','41000000-0000-4000-8000-000000000002','Rejected one','QA',30,'talk','rejected');

SET LOCAL ROLE anon;
DO $$ BEGIN
  BEGIN
    PERFORM public.notification_unread();
    RAISE EXCEPTION 'Anonymous inbox access succeeded';
  EXCEPTION WHEN insufficient_privilege THEN NULL;
  END;
END $$;
RESET ROLE;
SET LOCAL ROLE authenticated;
SET LOCAL request.jwt.claim.sub = '41000000-0000-4000-8000-000000000001';
DO $$
DECLARE
  v_filter jsonb := '{"audience":"rejected","mode":"result","query":"notify-speaker@"}';
  v_general jsonb := '{"audience":"approved","mode":"general","query":"notify-speaker@"}';
  v_manual jsonb := '{"audience":"manual","mode":"general","ids":["41000000-0000-4000-8000-000000000003"]}';
  v_request uuid := '41000000-0000-4000-8000-000000000021';
  v_preview jsonb;
  v_sent jsonb;
BEGIN
  v_preview := public.notification_preview(v_filter);
  IF v_preview->>'count' <> '1' OR v_preview#>>'{rows,0,proposal_title}' <> 'Rejected one'
     OR v_preview#>>'{rows,0,email}' <> 'notify-speaker@example.test' THEN
    RAISE EXCEPTION 'Mixed-result speaker omitted or wrong proposal exported';
  END IF;
  IF jsonb_array_length(public.notification_export(v_general)) <> 1 THEN
    RAISE EXCEPTION 'Approved recipients not deduplicated';
  END IF;
  IF public.notification_preview('{"audience":"registered","mode":"general","query":"notify-"}')->>'count' <> '1'
     OR public.notification_preview('{"audience":"not_registered","mode":"general","query":"notify-"}')->>'count' <> '3'
     OR public.notification_preview('{"audience":"all","mode":"general","query":"notify-"}')->>'count' <> '4' THEN
    RAISE EXCEPTION 'Conference audiences selected wrong accounts';
  END IF;
  IF public.notification_preview(v_manual)#>>'{rows,0,email}' <> 'notify-attendee@example.test'
     OR public.notification_preview(v_manual,30)->'rows' <> '[]'::jsonb
     OR public.notification_preview('{"audience":"all","mode":"general","ids":[]}')->>'count' <> '0' THEN
    RAISE EXCEPTION 'An explicit selection expanded beyond its recipients';
  END IF;
  BEGIN
    PERFORM public.notification_export('{"audience":"manual","mode":"general"}');
    RAISE EXCEPTION 'Manual export accepted no explicit selection';
  EXCEPTION WHEN SQLSTATE '22023' THEN NULL;
  END;
  UPDATE public.sessions SET title='Rejected updated' WHERE id='41000000-0000-4000-8000-000000000013';
  BEGIN
    PERFORM public.notification_send(v_filter,v_preview->>'token',v_request,'Result','Read your result.');
    RAISE EXCEPTION 'Unconfirmed title change was sent';
  EXCEPTION WHEN SQLSTATE '40001' THEN NULL;
  END;
  v_preview := public.notification_preview(v_filter);
  v_sent := public.notification_send(v_filter,v_preview->>'token',v_request,'Result','Read your result.');
  IF v_sent->>'count' <> '1' OR v_sent IS DISTINCT FROM
     public.notification_send(v_filter,v_preview->>'token',v_request,'Result','Read your result.') THEN
    RAISE EXCEPTION 'Same request did not recover original send';
  END IF;
  IF jsonb_array_length(public.notification_history()) <> 1 THEN RAISE EXCEPTION 'Incorrect history count'; END IF;
  BEGIN
    PERFORM public.notification_send(v_filter,v_preview->>'token',v_request,'Edited result','Read your result.');
    RAISE EXCEPTION 'Same request ID accepted different content';
  EXCEPTION WHEN SQLSTATE '22023' THEN NULL;
  END;
END $$;
RESET ROLE;

SET LOCAL ROLE authenticated;
SET LOCAL request.jwt.claim.sub = '41000000-0000-4000-8000-000000000002';
DO $$ DECLARE v_inbox jsonb; BEGIN
  v_inbox := public.notification_inbox();
  IF public.notification_unread() <> 1 OR v_inbox#>>'{rows,0,proposal_title}' IS DISTINCT FROM 'Rejected updated'
     OR v_inbox#>>'{rows,0,proposal_status}' IS DISTINCT FROM 'rejected' THEN
    RAISE EXCEPTION 'Recipient did not receive exact result';
  END IF;
  PERFORM set_config('notify_qa.receipt_ref', v_inbox#>>'{rows,0,id}', true);
  BEGIN
    PERFORM public.notification_export('{"audience":"all","mode":"general"}');
    RAISE EXCEPTION 'Ordinary account exported recipient emails';
  EXCEPTION WHEN insufficient_privilege THEN NULL;
  END;
  BEGIN
    PERFORM public.notification_send('{"audience":"all","mode":"general"}','forbidden',gen_random_uuid(),'Test','Test');
    RAISE EXCEPTION 'Ordinary account sent a notification';
  EXCEPTION WHEN insufficient_privilege THEN NULL;
  END;
  BEGIN
    PERFORM * FROM private.site_notification_receipts;
    RAISE EXCEPTION 'Ordinary account read private receipts directly';
  EXCEPTION WHEN insufficient_privilege THEN NULL;
  END;
END $$;
SET LOCAL request.jwt.claim.sub = '41000000-0000-4000-8000-000000000003';
DO $$ BEGIN
  IF public.notification_inbox()->>'total' <> '0'
     OR public.notification_read(current_setting('notify_qa.receipt_ref')::uuid) <> 0 THEN
    RAISE EXCEPTION 'Another account accessed a private notification';
  END IF;
END $$;
SET LOCAL request.jwt.claim.sub = '41000000-0000-4000-8000-000000000002';
DO $$ BEGIN
  IF public.notification_unread() <> 1 THEN RAISE EXCEPTION 'Foreign mark-read altered owner state'; END IF;
  PERFORM public.notification_read(current_setting('notify_qa.receipt_ref')::uuid);
  IF public.notification_unread() <> 0 THEN RAISE EXCEPTION 'Mark-read did not persist'; END IF;
END $$;
RESET ROLE;

INSERT INTO auth.users(id,email,raw_user_meta_data,raw_app_meta_data)
  SELECT gen_random_uuid(),'notify-batch-' || i || '@example.test','{}','{}' FROM generate_series(1,500) i;
SET LOCAL ROLE authenticated;
SET LOCAL request.jwt.claim.sub = '41000000-0000-4000-8000-000000000001';
DO $$ DECLARE
  f jsonb := '{"audience":"all","mode":"general","query":"notify-batch-"}';
  first_page jsonb;
  last_page jsonb;
BEGIN
  first_page := public.notification_preview(f);
  last_page := public.notification_preview(f,480);
  IF first_page->>'count' <> '500' OR jsonb_array_length(first_page->'rows') <> 30
    OR jsonb_array_length(last_page->'rows') <> 20 OR first_page->>'token' <> last_page->>'token'
    OR jsonb_array_length(public.notification_export(f)) <> 500 THEN
    RAISE EXCEPTION 'Audience truncated or lost consistency across preview pages';
  END IF;
  IF public.notification_send(f,first_page->>'token',gen_random_uuid(),'Conference QA','This is a fixture.')->>'accounts' <> '500' THEN
    RAISE EXCEPTION 'General message did not reach the complete selected audience';
  END IF;
END $$;
RESET ROLE;
ROLLBACK;
SELECT 'PASS audience, mixed outcomes, permissions, stable review results, retry safety and 500-receipt batch';
