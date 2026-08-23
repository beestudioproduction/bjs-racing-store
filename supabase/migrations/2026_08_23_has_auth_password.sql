-- has_auth_password: sumber kebenaran keberadaan kata sandi akun.
--
-- Latar belakang: GoTrue (Supabase Auth) TIDAK selalu membuat baris
-- auth.identities dengan provider 'email' saat updateUser({ password })
-- dipanggil untuk akun OAuth-only. Akibatnya kolom encrypted_password
-- terisi dan login email+sandi berhasil, tetapi user.identities tetap
-- hanya berisi provider OAuth — pemeriksaan identities menjadi tidak
-- andal. Kolom auth.users.encrypted_password adalah kebenaran sebenarnya.
--
-- SECURITY DEFINER diperlukan karena tabel auth.users tidak dapat dibaca
-- oleh peran anon/authenticated. Fungsi hanya membaca baris milik
-- pemanggil sendiri (auth.uid()) sehingga aman.

CREATE OR REPLACE FUNCTION public.has_auth_password()
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
SET search_path = auth, public
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1 FROM auth.users
    WHERE id = auth.uid()
      AND encrypted_password IS NOT NULL
  );
$$;

REVOKE EXECUTE ON FUNCTION public.has_auth_password() FROM anon, public;
GRANT EXECUTE ON FUNCTION public.has_auth_password() TO authenticated;
