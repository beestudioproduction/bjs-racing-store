// File: src/lib/midtrans.ts
// Konfigurasi terpusat Midtrans Snap.
// Set PUBLIC_MIDTRANS_IS_PRODUCTION=true di env produksi setelah akun approved
// (lihat docs/midtrans-golive-plan.md).

const isProduction =
  (import.meta.env.PUBLIC_MIDTRANS_IS_PRODUCTION || "false")
    .toString()
    .toLowerCase() === "true";

export const MIDTRANS_IS_PRODUCTION = isProduction;

export const MIDTRANS_API_BASE = isProduction
  ? "https://app.midtrans.com"
  : "https://app.sandbox.midtrans.com";

export const MIDTRANS_SNAP_API_URL = `${MIDTRANS_API_BASE}/snap/v1/transactions`;

export const MIDTRANS_SNAP_JS_URL = `${MIDTRANS_API_BASE}/snap/snap.js`;

// Callback absolut untuk Snap (fallback bila Finish/Unfinish/Error URL di MAP
// tidak tersedia). Popup mode + JS callback tetap yang dipakai utama.
export function getSnapCallbackUrls(orderId: string, origin: string) {
  const cleanOrigin = origin.replace(/\/$/, "");
  const base = `${cleanOrigin}/akun/pesanan/${orderId}`;
  return {
    finish_url: `${base}?status=success`,
    unfinish_url: `${base}?status=pending`,
    error_url: `${base}?status=error`,
  };
}
