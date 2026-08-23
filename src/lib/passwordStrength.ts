// src/lib/passwordStrength.ts
// Kebijakan & skoring kekuatan kata sandi untuk seluruh form STORE.
// Tanpa dependensi eksternal (zxcvbn terlalu berat untuk PWA).

export const PASSWORD_MIN_LENGTH = 8;

/** Sandi umum yang kerap dipakai — tolak meski memenuhi syarat panjang. */
const COMMON_PASSWORDS = [
  "123456",
  "1234567",
  "12345678",
  "123456789",
  "1234567890",
  "password",
  "passw0rd",
  "qwerty",
  "abc123",
  "iloveyou",
  "admin123",
  "bismillah",
  "bjsracing",
  "bjs12345",
];

export interface PasswordCheck {
  id: string;
  label: string;
  passed: boolean;
}

export interface StrengthMeta {
  label: string;
  /** kelas warna segmen bar yang terisi */
  bar: string;
  /** kelas warna teks label */
  text: string;
}

/**
 * Validasi kebijakan minimum. Mengembalikan pesan error Bahasa Indonesia,
 * atau null jika lolos.
 */
export function validatePasswordPolicy(password: string): string | null {
  if (!password || password.length < PASSWORD_MIN_LENGTH) {
    return `Kata sandi minimal ${PASSWORD_MIN_LENGTH} karakter.`;
  }
  if (!/[a-zA-Z]/.test(password) || !/\d/.test(password)) {
    return "Kata sandi harus mengandung kombinasi huruf dan angka.";
  }
  return null;
}

/** Daftar syarat yang ditampilkan live di bawah kolom kata sandi. */
export function getPasswordChecks(password: string): PasswordCheck[] {
  return [
    {
      id: "length",
      label: `Minimal ${PASSWORD_MIN_LENGTH} karakter`,
      passed: Boolean(password && password.length >= PASSWORD_MIN_LENGTH),
    },
    {
      id: "alphanumeric",
      label: "Mengandung huruf dan angka",
      passed: Boolean(/[a-zA-Z]/.test(password) && /\d/.test(password)),
    },
  ];
}

/**
 * Skor kekuatan 0–4:
 * +1 panjang >= 8
 * +1 kombinasi huruf & angka
 * +1 huruf besar ATAU simbol
 * +1 panjang >= 12
 * Sandi umum / numerik murni dibatasi maksimal skor 1.
 */
export function scorePassword(password: string): number {
  if (!password) return 0;

  let score = 0;
  if (password.length >= PASSWORD_MIN_LENGTH) score++;
  if (/[a-zA-Z]/.test(password) && /\d/.test(password)) score++;
  if (/[A-Z]/.test(password) || /[^a-zA-Z0-9]/.test(password)) score++;
  if (password.length >= 12) score++;

  const lower = password.toLowerCase();
  if (
    COMMON_PASSWORDS.some((common) => lower.includes(common)) ||
    /^\d+$/.test(password)
  ) {
    score = Math.min(score, 1);
  }

  return Math.min(score, 4);
}

/** Warna & label per tingkat skor — gradasi merah → oranye → lime → hijau. */
export function getStrengthMeta(score: number): StrengthMeta {
  switch (score) {
    case 0:
    case 1:
      return {
        label: "Lemah",
        bar: "bg-red-500",
        text: "text-red-500",
      };
    case 2:
      return {
        label: "Cukup",
        bar: "bg-orange-500",
        text: "text-orange-500",
      };
    case 3:
      return {
        label: "Bagus",
        bar: "bg-lime-500",
        text: "text-lime-600",
      };
    default:
      return {
        label: "Sangat Kuat",
        bar: "bg-green-600",
        text: "text-green-600",
      };
  }
}
