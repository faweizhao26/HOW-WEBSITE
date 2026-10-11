-- Restrict avatar writes and metadata access; public asset URLs remain unchanged.
CREATE POLICY "Users can upload own avatar objects" ON storage.objects
FOR INSERT TO authenticated WITH CHECK (
  bucket_id = 'conference-media'
  AND (storage.foldername(name))[1] = 'avatars'
  AND (storage.foldername(name))[2] = (SELECT auth.uid()::text)
  AND array_length(storage.foldername(name), 1) = 2
  AND owner_id = (SELECT auth.uid()::text)
);

-- SELECT is also required for Storage DELETE and failed-save cleanup.
CREATE POLICY "Users can read own avatar objects and admins media" ON storage.objects
FOR SELECT TO authenticated USING (
  bucket_id = 'conference-media'
  AND (
    private.is_admin()
    OR (
      (storage.foldername(name))[1] = 'avatars'
      AND (storage.foldername(name))[2] = (SELECT auth.uid()::text)
      AND array_length(storage.foldername(name), 1) = 2
      AND owner_id = (SELECT auth.uid()::text)
    )
  )
);

CREATE POLICY "Users can delete own avatar objects" ON storage.objects
FOR DELETE TO authenticated USING (
  bucket_id = 'conference-media'
  AND (storage.foldername(name))[1] = 'avatars'
  AND (storage.foldername(name))[2] = (SELECT auth.uid()::text)
  AND array_length(storage.foldername(name), 1) = 2
  AND owner_id = (SELECT auth.uid()::text)
);
