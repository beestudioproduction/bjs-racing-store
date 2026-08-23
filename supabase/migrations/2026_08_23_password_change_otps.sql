-- Tabel kode OTP verifikasi sebelum ganti/pasang kata sandi.
-- Akses HANYA melalui API server dengan service role (supabaseAdmin);
-- RLS tanpa policy = semua akses client ditolak total.
-- Masa berlaku kode 60 detik (disimpan per baris), maksimal 3 percobaan.

CREATE TABLE IF NOT EXISTS public.password_change_otps (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  code_hash text NOT NULL,
  expires_at timestamptz NOT NULL,
  attempts int NOT NULL DEFAULT 0,
  consumed boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_password_change_otps_user
  ON public.password_change_otps(user_id, created_at DESC);

ALTER TABLE public.password_change_otps ENABLE ROW LEVEL SECURITY;
