// src/lib/supabaseErrors.ts
// Terjemahan pesan error GoTrue (Supabase Auth) ke Bahasa Indonesia.
// Pesan mentah dari server berbahasa Inggris; peta di bawah mencakup
// kasus umum. Error tak dikenal dikembalikan apa adanya agar tetap
// bisa di-debug.

type Rule = {
  test: RegExp;
  /** string tetap, atau fungsi yang menerima pesan asli */
  id: string | ((match: RegExpMatchArray, raw: string) => string);
};

const RULES: Rule[] = [
  {
    test: /should be different from the old password/i,
    id: "Kata sandi baru harus berbeda dari kata sandi lama.",
  },
  {
    test: /password should be at least (\d+)/i,
    id: (m) => `Kata sandi minimal ${m[1]} karakter.`,
  },
  {
    test: /invalid login credentials/i,
    id: "Email atau kata sandi salah.",
  },
  {
    test: /email not confirmed/i,
    id: "Email Anda belum terverifikasi. Silakan periksa kotak masuk dan klik tautan konfirmasi.",
  },
  {
    test: /already (been )?registered/i,
    id: "Email sudah terdaftar. Silakan masuk atau gunakan email lain.",
  },
  {
    test: /rate limit exceeded|too many requests|only request this once every (\d+) seconds/i,
    id: "Terlalu sering mencoba. Tunggu sebentar lalu coba lagi.",
  },
  {
    test: /token has expired|expired/i,
    id: "Tautan atau kode sudah kedaluwarsa. Silakan minta yang baru.",
  },
  {
    test: /invalid claim|session missing|not authenticated/i,
    id: "Sesi tidak valid atau sudah berakhir. Silakan masuk kembali.",
  },
  {
    test: /unable to validate email|invalid email/i,
    id: "Format email tidak valid.",
  },
  {
    test: /user not found|user does not exist/i,
    id: "Akun tidak ditemukan.",
  },
  {
    test: /signups not allowed/i,
    id: "Pendaftaran sedang ditutup. Hubungi kami melalui WhatsApp.",
  },
];

export function translateAuthError(message = ""): string {
  if (!message) return message;
  for (const rule of RULES) {
    const match = message.match(rule.test);
    if (match) {
      return typeof rule.id === "function" ? rule.id(match, message) : rule.id;
    }
  }
  return message;
}
