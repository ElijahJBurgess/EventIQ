INSERT INTO storage.buckets (id, name, public)
VALUES ('profile-photos', 'profile-photos', true)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "Visitors can view profile photos"
ON storage.objects
FOR SELECT
TO anon, authenticated
USING (bucket_id = 'profile-photos');

CREATE POLICY "Visitors can upload profile photos"
ON storage.objects
FOR INSERT
TO anon, authenticated
WITH CHECK (bucket_id = 'profile-photos');