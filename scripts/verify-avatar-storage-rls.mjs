import assert from "node:assert/strict"
import { readFile } from "node:fs/promises"
import { randomUUID } from "node:crypto"
import { spawnSync } from "node:child_process"

assert.equal(process.env.PUBLICATION_TEST_ISOLATED_PROJECT, "true", "Use the isolated test stack only")
assert.ok(["localhost", "127.0.0.1"].includes(new URL(process.env.PUBLICATION_TEST_SUPABASE_URL).hostname))
const migration = await readFile(new URL("../supabase/migrations/20261010094629_avatar_storage_ownership.sql", import.meta.url), "utf8")
const [a, b, admin] = [randomUUID(), randomUUID(), randomUUID()]
const role = (id, name = "authenticated") => `RESET ROLE; SET LOCAL ROLE ${name}; SELECT set_config('request.jwt.claim.sub', '${id}', true);`
const denied = sql => `DO $$ BEGIN BEGIN ${sql}; RAISE EXCEPTION 'unexpected permitted write'; EXCEPTION WHEN insufficient_privilege THEN NULL; END; END $$;`
const rows = (sql, expected) => `DO $$ DECLARE n integer; BEGIN ${sql}; GET DIAGNOSTICS n = ROW_COUNT; IF n <> ${expected} THEN RAISE EXCEPTION 'expected ${expected} rows, got %', n; END IF; END $$;`
const count = (where, expected) => `DO $$ BEGIN IF (SELECT count(*) FROM storage.objects WHERE ${where}) <> ${expected} THEN RAISE EXCEPTION 'unexpected visible objects'; END IF; END $$;`
const insert = (name, owner = a, bucket = "conference-media") => `INSERT INTO storage.objects(bucket_id,name,owner_id) VALUES ('${bucket}','${name}','${owner}')`

// The local stack has no Storage API. Reproduce its table/policies transactionally;
// this verifies real PostgreSQL RLS, not file delivery or the Storage service.
const sql = `BEGIN;
CREATE SCHEMA IF NOT EXISTS storage;
GRANT USAGE ON SCHEMA storage TO anon, authenticated;
CREATE FUNCTION storage.foldername(name text) RETURNS text[] LANGUAGE sql IMMUTABLE AS $$
  SELECT parts[1:array_length(parts, 1)-1] FROM (SELECT string_to_array(name, '/') AS parts) p;
$$;
CREATE TABLE storage.objects(id uuid DEFAULT gen_random_uuid(), bucket_id text, name text, owner_id text);
ALTER TABLE storage.objects ENABLE ROW LEVEL SECURITY;
GRANT SELECT, INSERT, UPDATE, DELETE ON storage.objects TO anon, authenticated;
INSERT INTO auth.users(id,email,raw_user_meta_data) VALUES
  ('${a}','avatar-a-${a}@example.test','{}'),
  ('${b}','avatar-b-${b}@example.test','{}'),
  ('${admin}','avatar-admin-${admin}@example.test','{}');
UPDATE public.profiles SET role='admin' WHERE id='${admin}';
CREATE POLICY "Admin upload access" ON storage.objects FOR INSERT WITH CHECK (
  bucket_id='conference-media' AND EXISTS (SELECT 1 FROM public.profiles WHERE id=auth.uid() AND role='admin'));
CREATE POLICY "Admin delete access" ON storage.objects FOR DELETE USING (
  bucket_id='conference-media' AND EXISTS (SELECT 1 FROM public.profiles WHERE id=auth.uid() AND role='admin'));
${insert(`avatars/${b}/b.png`, b)};
${insert(`avatars/${a}/forged.png`, b)};
${insert("logos/admin.png", admin)};
${migration}
${role(a)}
${insert(`avatars/${a}/a.png`)};
${count(`name='avatars/${a}/a.png'`, 1)}
${count(`name='avatars/${b}/b.png' OR name='logos/admin.png' OR name='avatars/${a}/forged.png'`, 0)}
${denied(insert(`avatars/${b}/cross-user.png`))}
${denied(insert(`avatars/${a}/forged-owner.png`, b))}
${denied(insert("logos/not-admin.png"))}
${denied(insert(`avatars/${a}/wrong-bucket.png`, a, "other-bucket"))}
${denied(insert(`avatars/${a}/nested/extra.png`))}
${rows(`UPDATE storage.objects SET owner_id='${b}' WHERE name='avatars/${a}/a.png'`, 0)}
${rows(`DELETE FROM storage.objects WHERE name='avatars/${b}/b.png' OR name='logos/admin.png' OR name='avatars/${a}/forged.png'`, 0)}
${rows(`DELETE FROM storage.objects WHERE name='avatars/${a}/a.png'`, 1)}
${role(b)}
${count(`name='avatars/${b}/b.png'`, 1)}
${role(admin)}
${count("bucket_id='conference-media'", 3)}
${insert("logos/admin-new.png", admin)};
${rows("DELETE FROM storage.objects WHERE name='logos/admin-new.png'", 1)}
${role("", "anon")}
${count("true", 0)}
${denied(insert(`avatars/${a}/anonymous.png`))}
RESET ROLE;
ROLLBACK;`
const result = spawnSync("docker", ["exec", "-i", "supabase_db_how-publication-stack", "psql", "-U", "supabase_admin", "-d", "postgres", "-v", "ON_ERROR_STOP=1", "-At"], { input: sql, encoding: "utf8" })
if (result.error) throw result.error
assert.equal(result.status, 0, result.stderr)
console.log("PASS real RLS: own avatar upload/read/delete; cross-user, forged owner, other folder/bucket, nested path and anonymous denial; no overwrite; administrator media access; transaction rolled back")
