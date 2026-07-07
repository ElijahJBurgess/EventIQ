DROP POLICY IF EXISTS "Visitors can view profile photos" ON storage.objects;

CREATE POLICY "Visitors can upload valid profile photos"
ON storage.objects
FOR INSERT
TO anon, authenticated
WITH CHECK (
  bucket_id = 'profile-photos'
  AND lower((storage.extension(name))) IN ('jpg', 'jpeg', 'png', 'webp')
);