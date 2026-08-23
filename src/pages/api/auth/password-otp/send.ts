// File: src/pages/api/auth/password-otp/send.ts
// Kirim kode OTP 6 digit ke email terdaftar sebagai syarat verifikasi
// sebelum kata sandi diubah/dipasang. Berlaku 60 detik, satu kali pakai.
import type { APIRoute } from "astro";
import { createHash } from "node:crypto";
import { supabaseAdmin } from "@/lib/supabaseServer";

const OTP_TTL_SECONDS = 60;
const RESEND_COOLDOWN_SECONDS = 30;

export const POST: APIRoute = async ({ locals }) => {
  const { session } = locals;
  if (!session?.user) {
    return new Response(JSON.stringify({ message: "Tidak diizinkan." }), {
      status: 401,
    });
  }

  const userId = session.user.id;
  const userEmail = session.user.email;
  if (!userEmail) {
    return new Response(
      JSON.stringify({ message: "Akun tidak memiliki email terdaftar." }),
      { status: 400 },
    );
  }

  try {
    // --- Rate limit kirim ulang ---
    const { data: recent } = await supabaseAdmin
      .from("password_change_otps")
      .select("created_at")
      .eq("user_id", userId)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (recent) {
      const elapsed =
        (Date.now() - new Date(recent.created_at).getTime()) / 1000;
      if (elapsed < RESEND_COOLDOWN_SECONDS) {
        const wait = Math.ceil(RESEND_COOLDOWN_SECONDS - elapsed);
        return new Response(
          JSON.stringify({
            message: `Tunggu ${wait} detik sebelum meminta kode baru.`,
            retryAfter: wait,
          }),
          { status: 429 },
        );
      }
    }

    // --- Buat & simpan kode (hash SHA-256) ---
    const code = String(
      crypto.getRandomValues(new Uint32Array(1))[0] % 1000000,
    ).padStart(6, "0");
    const codeHash = createHash("sha256").update(code).digest("hex");
    const expiresAt = new Date(Date.now() + OTP_TTL_SECONDS * 1000);

    // Nonaktifkan kode lama yang belum terpakai
    await supabaseAdmin
      .from("password_change_otps")
      .update({ consumed: true })
      .eq("user_id", userId)
      .eq("consumed", false);

    const { error: insertError } = await supabaseAdmin
      .from("password_change_otps")
      .insert({ user_id: userId, code_hash: codeHash, expires_at: expiresAt.toISOString() });
    if (insertError) throw insertError;

    // --- Kirim email via Resend ---
    const apiKey = import.meta.env.RESEND_API_KEY;
    const fromEmail = import.meta.env.RESEND_FROM_EMAIL;
    if (!apiKey || !fromEmail) {
      return new Response(
        JSON.stringify({ message: "Layanan email belum dikonfigurasi." }),
        { status: 500 },
      );
    }

    const resendResponse = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: fromEmail,
        to: userEmail,
        subject: "Kode Verifikasi Ganti Kata Sandi - BJS Racing Store",
        html:
          `<h2>Kode Verifikasi</h2>` +
          `<p>Gunakan kode berikut untuk melanjutkan penggantian kata sandi Anda:</p>` +
          `<p style="font-size:32px;font-weight:bold;letter-spacing:8px;color:#f97316;">${code}</p>` +
          `<p style="color:#888;font-size:12px;">Kode berlaku <strong>${OTP_TTL_SECONDS} detik</strong>. ` +
          `Jika Anda tidak meminta kode ini, abaikan email ini — akun Anda tetap aman.</p>`,
      }),
    });

    if (!resendResponse.ok) {
      const result = await resendResponse.json().catch(() => ({}));
      console.error("Gagal kirim OTP via Resend:", result);
      return new Response(
        JSON.stringify({
          message: "Gagal mengirim email kode. Coba lagi sebentar.",
        }),
        { status: 502 },
      );
    }

    return new Response(
      JSON.stringify({ sent: true, expiresIn: OTP_TTL_SECONDS }),
      { status: 200 },
    );
  } catch (error) {
    console.error("password-otp/send error:", error);
    return new Response(
      JSON.stringify({ message: "Terjadi kesalahan. Coba lagi nanti." }),
      { status: 500 },
    );
  }
};
