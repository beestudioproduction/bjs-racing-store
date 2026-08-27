-- Migration: Storage policies for produk-parts bucket only
-- produk-pilok sudah memiliki policies, jadi tidak dibuat ulang.
-- Created: 2026-08-27

-- Policies for produk-parts bucket
CREATE POLICY "Public can view produk-parts"
ON storage.objects
FOR SELECT
USING (bucket_id = 'produk-parts');

CREATE POLICY "Admin can upload produk-parts"
ON storage.objects
FOR INSERT
WITH CHECK (bucket_id = 'produk-parts' AND auth.role() = 'authenticated');

CREATE POLICY "Admin can update produk-parts"
ON storage.objects
FOR UPDATE
USING (bucket_id = 'produk-parts' AND auth.role() = 'authenticated');

CREATE POLICY "Admin can delete produk-parts"
ON storage.objects
FOR DELETE
USING (bucket_id = 'produk-parts' AND auth.role() = 'authenticated');
