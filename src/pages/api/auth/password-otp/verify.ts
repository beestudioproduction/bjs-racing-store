// File: src/pages/api/auth/password-otp/verify.ts
// Verifikasi kode OTP sebelum kata sandi boleh diubah/dipasang.
// Maksimal 3 percobaan per kode; benar = kode ditandai terpakai.
import type { APIRoute } from "astro";
import { createHash } from "node:crypto";
import { supabaseAdmin } from "@/lib/supabaseServer";

const MAX_ATTEMPTS = 3;

export const POST: APIRoute = async ({ request, locals }) => {
  const { session } = locals;
  if (!session?.user) {
    return new Response(JSON.stringify({ message: "Tidak diizinkan." }), {
      status: 401,
    });
  }

  try {
    const { code } = await request.json();
    const normalizedCode = String(code || "").trim();
    if (!/^\d{6}$/.test(normalizedCode)) {
      return new Response(
        JSON.stringify({ message: "Masukkan 6 digit kode." }),
        { status: 400 },
      );
    }

    const userId = session.user.id;
    const { data: otpRow } = await supabaseAdmin
      .from("password_change_otps")
      .select("id, code_hash, expires_at, attempts, consumed")
      .eq("user_id", userId)
      .eq("consumed", false)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (!otpRow) {
      return new Response(
        JSON.stringify({
          message: "Kode tidak ditemukan atau sudah terpakai. Minta kode baru.",
          reason: "missing",
        }),
        { status: 400 },
      );
    }

    if (new Date(otpRow.expires_at).getTime() < Date.now()) {
      return new Response(
        JSON.stringify({
          message: "Kode sudah kedaluwarsa. Minta kode baru.",
          reason: "expired",
        }),
        { status: 400 },
      );
    }

    if (otpRow.attempts >= MAX_ATTEMPTS) {
      return new Response(
        JSON.stringify({
          message: "Terlalu banyak percobaan. Minta kode baru.",
          reason: "locked",
        }),
        { status: 429 },
      );
    }

    const codeHash = createHash("sha256").update(normalizedCode).digest("hex");
    if (codeHash !== otpRow.code_hash) {
      await supabaseAdmin
        .from("password_change_otps")
        .update({ attempts: otpRow.attempts + 1 })
        .eq("id", otpRow.id);

      const remaining = MAX_ATTEMPTS - (otpRow.attempts + 1);
      return new Response(
        JSON.stringify({
          message:
            remaining > 0
              ? `Kode salah. Sisa ${remaining} percobaan.`
              : "Kode salah. Percobaan habis — minta kode baru.",
          reason: "wrong",
          remaining,
        }),
        { status: 400 },
      );
    }

    const { error: consumeError } = await supabaseAdmin
      .from("password_change_otps")
      .update({ consumed: true })
      .eq("id", otpRow.id);
    if (consumeError) throw consumeError;

    return new Response(JSON.stringify({ verified: true }), { status: 200 });
  } catch (error) {
    console.error("password-otp/verify error:", error);
    return new Response(
      JSON.stringify({ message: "Terjadi kesalahan. Coba lagi nanti." }),
      { status: 500 },
    );
  }
};
