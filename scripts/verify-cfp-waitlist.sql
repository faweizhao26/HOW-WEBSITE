-- Use only a disposable local database with both CFP and notification migrations applied.
BEGIN;
SET LOCAL statement_timeout = '15s';
INSERT INTO auth.users(id,email,email_confirmed_at,raw_user_meta_data) VALUES
  ('46000000-0000-4000-8000-000000000001','waitlist-admin@example.test',now(),'{}'),
  ('46000000-0000-4000-8000-000000000002','waitlist-speaker@example.test',now(),'{}');
UPDATE public.profiles SET role='admin' WHERE id='46000000-0000-4000-8000-000000000001';
INSERT INTO public.sessions(id,user_id,title,abstract,duration,type,status) VALUES
  ('46000000-0000-4000-8000-000000000011','46000000-0000-4000-8000-000000000002','Waitlist topic','QA',30,'talk','pending'),
  ('46000000-0000-4000-8000-000000000012','46000000-0000-4000-8000-000000000002','Accepted topic','QA',5,'lightning','approved');

SET LOCAL ROLE authenticated;
SET LOCAL request.jwt.claim.sub = '46000000-0000-4000-8000-000000000002';
DO $$ BEGIN
  BEGIN
    UPDATE public.sessions SET status='waitlisted' WHERE id='46000000-0000-4000-8000-000000000011';
    RAISE EXCEPTION 'Non-admin changed review status to waitlisted';
  EXCEPTION WHEN insufficient_privilege THEN NULL;
  END;
END $$;

SET LOCAL request.jwt.claim.sub = '46000000-0000-4000-8000-000000000001';
DO $$
DECLARE
  v_id uuid := '46000000-0000-4000-8000-000000000011';
  v_filter jsonb := '{"audience":"waitlisted","mode":"result","query":"waitlist-speaker@"}';
  v_preview jsonb;
BEGIN
  UPDATE public.sessions SET status='waitlisted' WHERE id=v_id;
  v_preview := public.notification_preview(v_filter);
  IF v_preview->>'count' <> '1'
     OR v_preview#>>'{rows,0,proposal_title}' IS DISTINCT FROM 'Waitlist topic'
     OR v_preview#>>'{rows,0,proposal_status}' IS DISTINCT FROM 'waitlisted'
     OR public.notification_export(v_filter)#>>'{0,proposal_status}' IS DISTINCT FROM 'waitlisted' THEN
    RAISE EXCEPTION 'Waitlist preview or export had the wrong proposal or label';
  END IF;
  BEGIN
    PERFORM public.publish_session(v_id);
    RAISE EXCEPTION 'Waitlisted proposals are publishable';
  EXCEPTION WHEN check_violation THEN
    IF SQLERRM <> 'session must be approved before publication' THEN RAISE; END IF;
  END;
  BEGIN
    UPDATE public.sessions SET publication_status='published', published_at=now(), published_by=auth.uid() WHERE id=v_id;
    RAISE EXCEPTION 'Waitlist allowed published metadata';
  EXCEPTION WHEN check_violation THEN NULL;
  END;
  IF jsonb_array_length(public.notification_history()) <> 0 THEN RAISE EXCEPTION 'Changing review status sent a message'; END IF;
  PERFORM public.notification_send(v_filter,v_preview->>'token',gen_random_uuid(),'Waitlist QA','Waitlisted for now.');
  UPDATE public.sessions SET status='approved' WHERE id=v_id;
  IF public.notification_preview(v_filter)->>'count' <> '0'
    OR public.notification_preview('{"audience":"approved","mode":"result","query":"waitlist-speaker@"}')->>'count' <> '2'
    OR jsonb_array_length(public.notification_history()) <> 1 THEN
    RAISE EXCEPTION 'Promotion changed the wrong proposal or sent a second notice';
  END IF;
  UPDATE public.sessions SET status='waitlisted' WHERE id=v_id;
  UPDATE public.sessions SET status='rejected' WHERE id=v_id;
  IF public.notification_preview('{"audience":"rejected","mode":"result","query":"waitlist-speaker@"}')->>'count' <> '1' THEN
    RAISE EXCEPTION 'Waitlisted proposal could not be declined separately';
  END IF;
END $$;

SET LOCAL request.jwt.claim.sub = '46000000-0000-4000-8000-000000000002';
DO $$ BEGIN
  IF public.notification_unread() <> 1
    OR public.notification_inbox()#>>'{rows,0,proposal_status}' IS DISTINCT FROM 'waitlisted' THEN
    RAISE EXCEPTION 'Inbox did not retain the original waitlist decision';
  END IF;
END $$;
RESET ROLE;
ROLLBACK;
SELECT 'PASS waitlist permissions, status transitions, private publication boundary, export and notification snapshot';
