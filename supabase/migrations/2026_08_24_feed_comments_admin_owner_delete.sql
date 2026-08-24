-- Hard delete komentar oleh admin/owner
-- Kebijakan lama hanya menerima role 'admin'; diperluas agar role 'owner'
-- juga dapat mengelola (menghapus permanen) komentar siapa pun.

DROP POLICY IF EXISTS "Admins can manage comments" ON public.feed_comments;

CREATE POLICY "Admins dan owner dapat mengelola komentar"
  ON public.feed_comments FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE profiles.id = auth.uid()
        AND profiles.role IN ('admin', 'owner')
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE profiles.id = auth.uid()
        AND profiles.role IN ('admin', 'owner')
    )
  );
