// File: src/components/ResetPasswordView.jsx
// Halaman landing tautan reset kata sandi dari email Supabase.
// Alur: customer klik link email -> Supabase menukar token menjadi sesi
// (event PASSWORD_RECOVERY) -> form sandi baru -> updateUser -> redirect /akun.

import React, { useEffect, useState } from "react";
import { supabase } from "@/lib/supabaseBrowserClient.ts";
import { useAppStore } from "@/lib/store";
import { FiEye, FiEyeOff } from "react-icons/fi";
import { FiMail } from "react-icons/fi";

export default function ResetPasswordView() {
  const addToast = useAppStore((state) => state.addToast);

  const [recoveryReady, setRecoveryReady] = useState(false);
  const [checking, setChecking] = useState(true);

  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event) => {
      if (event === "PASSWORD_RECOVERY") {
        setRecoveryReady(true);
        setChecking(false);
      }
    });

    // Beri waktu proses pertukaran token di URL sebelum menyimpulkan
    // bahwa tautan tidak valid.
    const timeout = setTimeout(() => setChecking(false), 3000);

    return () => {
      subscription.unsubscribe();
      clearTimeout(timeout);
    };
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (newPassword.length < 6) {
      addToast({
        type: "error",
        message: "Kata sandi baru harus terdiri dari minimal 6 karakter.",
      });
      return;
    }
    if (newPassword !== confirmPassword) {
      addToast({
        type: "error",
        message: "Kata sandi baru dan konfirmasi tidak cocok.",
      });
      return;
    }

    setIsSaving(true);
    try {
      const { error } = await supabase.auth.updateUser({
        password: newPassword,
      });
      if (error) throw new Error(error.message);

      addToast({
        type: "success",
        message:
          "Kata sandi berhasil diperbarui. Mengarahkan ke halaman akun...",
      });
      setTimeout(() => {
        window.location.href = "/akun";
      }, 1500);
    } catch (error) {
      addToast({
        type: "error",
        message: `Gagal memperbarui kata sandi: ${error.message}`,
      });
      setIsSaving(false);
    }
  };

  // Tautan tidak valid / kedaluwarsa / sudah pernah dipakai
  if (checking || !recoveryReady) {
    return (
      <div className="bg-white p-8 rounded-xl shadow-md text-center">
        <FiMail className="w-12 h-12 mx-auto text-slate-300 mb-3" />
        {checking ? (
          <p className="text-sm text-slate-500">Memverifikasi tautan...</p>
        ) : (
          <>
            <h2 className="text-lg font-bold mb-2">Tautan Tidak Valid</h2>
            <p className="text-sm text-slate-600 mb-5">
              Tautan reset kata sandi tidak valid, kedaluwarsa, atau sudah
              pernah digunakan. Silakan minta tautan baru melalui halaman
              masuk.
            </p>
            <a
              href="/login"
              className="inline-block bg-orange-500 hover:bg-orange-600 text-white text-sm font-semibold px-6 py-2.5 rounded-lg transition-colors"
            >
              Kembali ke Halaman Masuk
            </a>
          </>
        )}
      </div>
    );
  }

  return (
    <div className="bg-white p-6 rounded-xl shadow-md">
      <h2 className="text-lg font-bold mb-1">Atur Kata Sandi Baru</h2>
      <p className="text-sm text-slate-500 mb-5">
        Buat kata sandi baru untuk akun Anda. Pastikan mudah Anda ingat namun
        sulit ditebak orang lain.
      </p>
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label
            htmlFor="reset_new_password"
            className="block text-sm font-medium text-gray-700"
          >
            Kata Sandi Baru
          </label>
          <div className="relative mt-1">
            <input
              id="reset_new_password"
              type={showNewPassword ? "text" : "password"}
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              required
              minLength={6}
              autoComplete="new-password"
              placeholder="Minimal 6 karakter"
              className="w-full px-3 py-2 pr-10 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
            />
            <button
              type="button"
              onClick={() => setShowNewPassword((v) => !v)}
              aria-label={
                showNewPassword
                  ? "Sembunyikan kata sandi"
                  : "Tampilkan kata sandi"
              }
              className="absolute inset-y-0 right-0 flex items-center px-3 text-gray-400 hover:text-gray-600"
            >
              {showNewPassword ? (
                <FiEyeOff size={18} />
              ) : (
                <FiEye size={18} />
              )}
            </button>
          </div>
        </div>

        <div>
          <label
            htmlFor="reset_confirm_password"
            className="block text-sm font-medium text-gray-700"
          >
            Konfirmasi Kata Sandi Baru
          </label>
          <div className="relative mt-1">
            <input
              id="reset_confirm_password"
              type={showConfirmPassword ? "text" : "password"}
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              required
              minLength={6}
              autoComplete="new-password"
              placeholder="Ulangi kata sandi baru"
              className="w-full px-3 py-2 pr-10 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
            />
            <button
              type="button"
              onClick={() => setShowConfirmPassword((v) => !v)}
              aria-label={
                showConfirmPassword
                  ? "Sembunyikan konfirmasi kata sandi"
                  : "Tampilkan konfirmasi kata sandi"
              }
              className="absolute inset-y-0 right-0 flex items-center px-3 text-gray-400 hover:text-gray-600"
            >
              {showConfirmPassword ? (
                <FiEyeOff size={18} />
              ) : (
                <FiEye size={18} />
              )}
            </button>
          </div>
        </div>

        <button
          type="submit"
          disabled={isSaving}
          className="w-full bg-orange-500 hover:bg-orange-600 disabled:bg-orange-300 text-white font-semibold py-2.5 rounded-lg transition-colors"
        >
          {isSaving ? "Menyimpan..." : "Simpan Kata Sandi Baru"}
        </button>
      </form>
    </div>
  );
}
