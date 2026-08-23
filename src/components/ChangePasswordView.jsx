// src/components/ChangePasswordView.jsx
// Halaman Keamanan Akun gaya marketplace profesional (Shopee):
// - Kartu info akun: email, metode masuk, status kata sandi.
// - Akun Google tanpa sandi -> tombol "Atur Kata Sandi" (pasang pertama kali).
// - Akun dengan sandi -> form "Ubah Password" (perilaku lama dipertahankan).
import React, { useEffect, useState } from "react";
import { supabase } from "@/lib/supabaseBrowserClient.ts";
import { useAppStore } from "@/lib/store";
import { FiEye, FiEyeOff, FiShield, FiCheckCircle } from "react-icons/fi";

const PROVIDER_LABELS = {
  google: "Google",
  email: "Email",
};

export default function ChangePasswordView() {
  const addToast = useAppStore((state) => state.addToast);
  const signOut = useAppStore((state) => state.signOut);

  // --- Info autentikasi pengguna ---
  const [authLoading, setAuthLoading] = useState(true);
  const [authInfo, setAuthInfo] = useState(null);

  // --- Form kata sandi ---
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [showSetForm, setShowSetForm] = useState(false);

  const loadAuthInfo = async () => {
    try {
      const { data, error } = await supabase.auth.getUser();
      if (error || !data?.user) {
        setAuthInfo(null);
        return;
      }
      const user = data.user;
      const appProviders = user.app_metadata?.providers ||
        (user.app_metadata?.provider ? [user.app_metadata.provider] : []);
      setAuthInfo({
        email: user.email,
        providers: appProviders,
        hasPassword:
          Array.isArray(user.identities) &&
          user.identities.some((i) => i.provider === "email"),
        emailVerified: Boolean(user.email_confirmed_at),
      });
    } catch {
      setAuthInfo(null);
    } finally {
      setAuthLoading(false);
    }
  };

  useEffect(() => {
    loadAuthInfo();
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (newPassword !== confirmPassword) {
      addToast({
        type: "error",
        message: "Password baru dan konfirmasi tidak cocok.",
      });
      return;
    }
    if (newPassword.length < 6) {
      addToast({
        type: "error",
        message: "Password baru harus terdiri dari minimal 6 karakter.",
      });
      return;
    }

    setIsSaving(true);
    try {
      const { error } = await supabase.auth.updateUser({
        password: newPassword,
      });
      if (error) throw new Error(error.message);

      if (!authInfo?.hasPassword) {
        // Mode "Atur": pasang sandi pertama kali — tetap login,
        // perbarui status kartu ke "Sudah diatur".
        addToast({
          type: "success",
          message:
            "Kata sandi berhasil dipasang. Kini Anda bisa masuk menggunakan email atau Google.",
        });
        setNewPassword("");
        setConfirmPassword("");
        setShowSetForm(false);
        await loadAuthInfo();
      } else {
        // Mode "Ubah": pertahankan perilaku lama (logout setelah sukses).
        addToast({
          type: "success",
          message: "Password berhasil diubah. Anda akan segera logout.",
        });
        setTimeout(() => {
          signOut();
        }, 2000);
      }
    } catch (error) {
      addToast({
        type: "error",
        message: `Gagal menyimpan password: ${error.message}`,
      });
    } finally {
      setIsSaving(false);
    }
  };

  if (authLoading) {
    return (
      <div className="bg-white p-6 rounded-xl shadow-md">
        <p className="text-sm text-slate-500 text-center py-4">
          Memuat informasi keamanan...
        </p>
      </div>
    );
  }

  if (!authInfo) {
    return (
      <div className="bg-white p-6 rounded-xl shadow-md">
        <p className="text-sm text-slate-500 text-center py-4">
          Tidak dapat memuat informasi akun. Silakan muat ulang halaman atau
          login kembali.
        </p>
      </div>
    );
  }

  const renderPasswordFields = () => (
    <>
      <div>
        <label
          htmlFor="new_password"
          className="block text-sm font-medium text-gray-700"
        >
          {authInfo.hasPassword ? "Password Baru" : "Kata Sandi Baru"}
        </label>
        <div className="relative mt-1">
          <input
            type={showNewPassword ? "text" : "password"}
            id="new_password"
            name="new_password"
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
            required
            minLength={6}
            autoComplete="new-password"
            placeholder="Minimal 6 karakter"
            className="block w-full border border-gray-300 rounded-md shadow-sm p-2 pr-10 focus:ring-orange-500 focus:border-orange-500"
          />
          <button
            type="button"
            aria-label={
              showNewPassword ? "Sembunyikan kata sandi" : "Tampilkan kata sandi"
            }
            className="absolute inset-y-0 right-0 px-3 flex items-center text-gray-500"
            onClick={() => setShowNewPassword(!showNewPassword)}
          >
            {showNewPassword ? <FiEyeOff /> : <FiEye />}
          </button>
        </div>
      </div>

      <div>
        <label
          htmlFor="confirm_password"
          className="block text-sm font-medium text-gray-700"
        >
          Konfirmasi Password Baru
        </label>
        <div className="relative mt-1">
          <input
            type={showConfirmPassword ? "text" : "password"}
            id="confirm_password"
            name="confirm_password"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            required
            minLength={6}
            autoComplete="new-password"
            placeholder="Ulangi kata sandi baru"
            className="block w-full border border-gray-300 rounded-md shadow-sm p-2 pr-10 focus:ring-orange-500 focus:border-orange-500"
          />
          <button
            type="button"
            aria-label={
              showConfirmPassword
                ? "Sembunyikan konfirmasi kata sandi"
                : "Tampilkan konfirmasi kata sandi"
            }
            className="absolute inset-y-0 right-0 px-3 flex items-center text-gray-500"
            onClick={() => setShowConfirmPassword(!showConfirmPassword)}
          >
            {showConfirmPassword ? <FiEyeOff /> : <FiEye />}
          </button>
        </div>
      </div>

      <div className="text-right">
        <button
          type="submit"
          disabled={isSaving || !newPassword}
          className="bg-blue-600 text-white px-6 py-2 rounded-lg hover:bg-blue-700 transition-colors disabled:bg-gray-400"
        >
          {isSaving
            ? "Menyimpan..."
            : authInfo.hasPassword
              ? "Ubah Password"
              : "Simpan Kata Sandi"}
        </button>
      </div>
    </>
  );

  return (
    <div className="space-y-4">
      {/* --- Kartu Keamanan (gaya daftar item Shopee) --- */}
      <div className="bg-white p-6 rounded-xl shadow-md space-y-4">
        <div className="flex items-center gap-3 pb-4 border-b border-gray-100">
          <FiShield className="w-5 h-5 text-orange-500 shrink-0" />
          <h2 className="font-semibold text-slate-900">Informasi Akun</h2>
        </div>

        {/* Email + status verifikasi */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1">
          <span className="text-sm text-slate-500">Email</span>
          <span className="text-sm font-medium text-slate-900 flex items-center gap-1.5">
            {authInfo.email || "-"}
            {authInfo.emailVerified && (
              <FiCheckCircle
                className="w-4 h-4 text-green-500"
                aria-label="Email terverifikasi"
              />
            )}
          </span>
        </div>

        {/* Metode masuk */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1">
          <span className="text-sm text-slate-500">Masuk via</span>
          <span className="flex flex-wrap gap-1.5 justify-start sm:justify-end">
            {authInfo.providers.length > 0 ? (
              authInfo.providers.map((p) => (
                <span
                  key={p}
                  className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-orange-50 text-orange-700 border border-orange-200"
                >
                  {PROVIDER_LABELS[p] || p}
                </span>
              ))
            ) : (
              <span className="text-sm text-slate-900">-</span>
            )}
          </span>
        </div>

        {/* Status kata sandi */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <span className="text-sm text-slate-500">Kata Sandi</span>
          {authInfo.hasPassword ? (
            <span className="text-sm font-medium text-green-600">
              Sudah diatur
            </span>
          ) : (
            <span className="text-sm font-medium text-slate-400">
              Belum diatur
            </span>
          )}
        </div>
      </div>

      {/* --- Form sesuai state --- */}
      {authInfo.hasPassword ? (
        <div className="bg-white p-6 rounded-xl shadow-md">
          <form onSubmit={handleSubmit} className="space-y-4">
            {renderPasswordFields()}
          </form>
        </div>
      ) : showSetForm ? (
        <div className="bg-white p-6 rounded-xl shadow-md">
          <p className="text-xs text-slate-500 mb-4">
            Pasang kata sandi agar Anda bisa masuk menggunakan email dan kata
            sandi, tanpa melalui Google.
          </p>
          <form onSubmit={handleSubmit} className="space-y-4">
            {renderPasswordFields()}
          </form>
        </div>
      ) : (
        <div className="bg-white p-6 rounded-xl shadow-md">
          <p className="text-sm text-slate-600 mb-4">
            Akun Anda saat ini masuk melalui{" "}
            <strong>
              {authInfo.providers.map((p) => PROVIDER_LABELS[p] || p).join(" & ")}
            </strong>{" "}
            dan belum menggunakan kata sandi.
          </p>
          <button
            type="button"
            onClick={() => setShowSetForm(true)}
            className="w-full sm:w-auto bg-blue-600 text-white px-6 py-2 rounded-lg hover:bg-blue-700 transition-colors"
          >
            Atur Kata Sandi
          </button>
        </div>
      )}
    </div>
  );
}
