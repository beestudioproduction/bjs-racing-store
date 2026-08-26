-- RPC function untuk AuthForm: mengecek apakah customer sudah punya profil
-- Idempotent (CREATE OR REPLACE) — aman untuk production yang sudah punya fungsi ini
CREATE OR REPLACE FUNCTION check_if_customer_profile_exists()
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
AS $$
  SELECT EXISTS (
    SELECT 1 FROM customers
    WHERE auth_user_id = auth.uid()
  );
$$;
