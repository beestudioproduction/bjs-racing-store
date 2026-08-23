// File: src/components/AuthForm.jsx
import React, { useEffect, useState } from "react";
import { Auth } from "@supabase/auth-ui-react";
import { ThemeSupa } from "@supabase/auth-ui-shared";
import { supabase } from "@/lib/supabaseBrowserClient.ts";

const AuthForm = () => {
  // --- Form mini "Lupa Kata Sandi" (menggantikan alur bawaan AuthUI
  // yang tidak mengirim redirectTo ke halaman reset kita) ---
  const [showForgot, setShowForgot] = useState(false);
  const [forgotEmail, setForgotEmail] = useState("");
  const [isSending, setIsSending] = useState(false);
  const [forgotStatus, setForgotStatus] = useState(null); // 'sent' | { error }

  const handleForgotSubmit = async (e) => {
    e.preventDefault();
    if (!forgotEmail.trim()) return;

    setIsSending(true);
    setForgotStatus(null);
    try {
      const redirectTo = `${window.location.origin}/reset-password`;
      const { error } = await supabase.auth.resetPasswordForEmail(
        forgotEmail.trim(),
        { redirectTo },
      );
      if (error) throw error;
      setForgotStatus("sent");
    } catch (error) {
      setForgotStatus({ error: error.message });
    } finally {
      setIsSending(false);
    }
  };

  useEffect(() => {
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (event === "SIGNED_IN" && session) {
        try {
          // --- PERBAIKAN: Panggil fungsi RPC yang lebih andal ---
          const { data: profileExists, error } = await supabase.rpc(
            "check_if_customer_profile_exists",
          );

          if (error) {
            console.error("Gagal memeriksa profil:", error);
            window.location.href = "/"; // Fallback ke home jika error
            return;
          }

          if (profileExists) {
            console.log("Profil ditemukan, mengarahkan ke /akun");
            window.location.href = "/akun";
          } else {
            console.log(
              "Profil tidak ditemukan, mengarahkan ke /akun/lengkapi-profil",
            );
            window.location.href = "/akun/lengkapi-profil";
          }
        } catch (e) {
          console.error("Error tak terduga saat memeriksa profil:", e);
          window.location.href = "/";
        }
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  return (
    <div style={{ width: "100%", maxWidth: "400px", margin: "auto" }}>
      <Auth
        supabaseClient={supabase}
        appearance={{ theme: ThemeSupa }}
        providers={["google"]}
        localization={{
          variables: {
            sign_in: {
              email_label: "Alamat Email",
              password_label: "Kata Sandi",
              button_label: "Masuk",
            },
            sign_up: {
              email_label: "Alamat Email",
              password_label: "Kata Sandi",
              button_label: "Daftar",
            },
            forgotten_password: {
              email_label: "Alamat Email",
              button_label: "Kirim Instruksi Reset",
              // Dinonaktifkan: digantikan form mini kustom di bawah
              // yang mengirim redirectTo ke /reset-password.
              link_text: "\u200b",
            },
          },
          }}
        />

      {/* --- Form mini Lupa Kata Sandi --- */}
      <div className="mt-4 text-center">
        {!showForgot ? (
          <button
            type="button"
            onClick={() => setShowForgot(true)}
            className="text-sm text-orange-600 hover:text-orange-700 font-medium"
          >
            Lupa Kata Sandi?
          </button>
        ) : (
          <div className="bg-white rounded-xl shadow-md p-4 mt-2 text-left">
            {forgotStatus === "sent" ? (
              <p className="text-sm text-green-600 text-center py-2">
                Instruksi reset telah dikirim ke{" "}
                <strong>{forgotEmail.trim()}</strong>. Silakan periksa kotak
                masuk (dan folder spam) email Anda.
              </p>
            ) : (
              <form onSubmit={handleForgotSubmit} className="space-y-3">
                <p className="text-xs text-slate-500">
                  Masukkan email akun Anda. Kami akan mengirim tautan untuk
                  mengatur ulang kata sandi.
                </p>
                <input
                  type="email"
                  required
                  value={forgotEmail}
                  onChange={(e) => setForgotEmail(e.target.value)}
                  placeholder="Alamat Email"
                  autoComplete="email"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-orange-500 text-sm"
                />
                {forgotStatus?.error && (
                  <p className="text-xs text-red-500">{forgotStatus.error}</p>
                )}
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => setShowForgot(false)}
                    className="flex-1 border border-gray-300 text-slate-600 text-sm font-medium py-2 rounded-lg hover:bg-gray-50 transition-colors"
                  >
                    Batal
                  </button>
                  <button
                    type="submit"
                    disabled={isSending}
                    className="flex-1 bg-orange-500 hover:bg-orange-600 disabled:bg-orange-300 text-white text-sm font-semibold py-2 rounded-lg transition-colors"
                  >
                    {isSending ? "Mengirim..." : "Kirim"}
                  </button>
                </div>
              </form>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default AuthForm;
