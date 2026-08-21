-- Supabase Storage resolves existing objects before update/delete operations.
-- Permit authenticated users to select object rows only inside their own
-- profile-photo folder; public asset delivery remains controlled by the bucket.

DROP POLICY IF EXISTS "Users can read own profile photo objects" ON storage.objects;

CREATE POLICY "Users can read own profile photo objects"
ON storage.objects
FOR SELECT
TO authenticated
USING (
  bucket_id = 'profile-photos'
  AND (storage.foldername(name))[1] = (SELECT auth.uid())::text
);
