// File: src/lib/notifications.ts
import { supabaseAdmin } from "@/lib/supabaseServer";

export type NotificationChannel = "whatsapp" | "email";

export type OrderEvent =
  | "order_created"
  | "payment_confirmed"
  | "order_shipped"
  | "order_completed"
  | "order_cancelled"
  | "shipping_status_update"
  | "shipping_delivered"
  | "booking_failed";

export interface NotificationPayload {
  to: string;
  channel: NotificationChannel;
  event: OrderEvent;
  data: {
    orderNumber?: string;
    customerName?: string;
    amount?: number;
    courierName?: string;
    trackingNumber?: string;
    etd?: string;
    storeName?: string;
    storePhone?: string;
    [key: string]: any;
  };
}

export interface NotificationResult {
  success: boolean;
  message?: string;
  provider?: string;
}

const EVENT_TEMPLATES: Record<
  OrderEvent,
  {
    whatsapp: (d: NotificationPayload["data"]) => string;
    email: {
      subject: (d: NotificationPayload["data"]) => string;
      body: (d: NotificationPayload["data"]) => string;
    };
  }
> = {
  order_created: {
    whatsapp: (d) =>
      `Halo ${d.customerName || "Customer"}!\n\n` +
      `Pesanan ${d.orderNumber} telah kami terima. ` +
      `Total: Rp${d.amount?.toLocaleString("id-ID") || "0"}.\n\n` +
      `Silakan selesaikan pembayaran sesuai instruksi yang terkirim. ` +
      `Jika sudah bayar, status akan otomatis terupdate.\n\n` +
      `Terima kasih,\n${d.storeName || "BJS Racing Store"}`,
    email: {
      subject: (d) => `Pesanan ${d.orderNumber} Diterima - ${d.storeName || "BJS Racing Store"}`,
      body: (d) =>
        `<h2>Pesanan Diterima</h2>` +
        `<p>Halo ${d.customerName || "Customer"},</p>` +
        `<p>Pesanan <strong>${d.orderNumber}</strong> telah kami terima.</p>` +
        `<p>Total: <strong>Rp${d.amount?.toLocaleString("id-ID") || "0"}</strong></p>` +
        `<p>Silakan selesaikan pembayaran sesuai instruksi yang telah dikirim. Status akan terupdate otomatis setelah pembayaran dikonfirmasi.</p>` +
        `<p>Terima kasih,<br/>${d.storeName || "BJS Racing Store"}</p>`,
    },
  },
  payment_confirmed: {
    whatsapp: (d) =>
      `Halo ${d.customerName || "Customer"}!\n\n` +
      `Pembayaran untuk pesanan ${d.orderNumber} telah kami terima dan dikonfirmasi. ` +
      `Pesanan Anda sedang diproses.\n\n` +
      `Terima kasih,\n${d.storeName || "BJS Racing Store"}`,
    email: {
      subject: (d) => `Pembayaran Dikonfirmasi - ${d.orderNumber}`,
      body: (d) =>
        `<h2>Pembayaran Dikonfirmasi</h2>` +
        `<p>Halo ${d.customerName || "Customer"},</p>` +
        `<p>Pembayaran untuk pesanan <strong>${d.orderNumber}</strong> telah dikonfirmasi.</p>` +
        `<p>Pesanan Anda sedang diproses dan akan segera dikirim.</p>` +
        `<p>Terima kasih,<br/>${d.storeName || "BJS Racing Store"}</p>`,
    },
  },
  order_shipped: {
    whatsapp: (d) =>
      `Halo ${d.customerName || "Customer"}!\n\n` +
      `Pesanan ${d.orderNumber} sudah dikirim via ${d.courierName || "kurir"}. ` +
      `No. Resi: ${d.trackingNumber || "-"}\n` +
      `Estimasi tiba: ${d.etd || "akan diinfokan"}\n\n` +
      (d.trackingUrl ? `Lacak: ${d.trackingUrl}\n\n` : "") +
      `Terima kasih,\n${d.storeName || "BJS Racing Store"}`,
    email: {
      subject: (d) => `Pesanan ${d.orderNumber} Sudah Dikirim - ${d.storeName || "BJS Racing Store"}`,
      body: (d) =>
        `<h2>Pesanan Dikirim</h2>` +
        `<p>Halo ${d.customerName || "Customer"},</p>` +
        `<p>Pesanan <strong>${d.orderNumber}</strong> sudah dikirim via <strong>${d.courierName || "kurir"}</strong>.</p>` +
        `<p>No. Resi: <strong>${d.trackingNumber || "-"}</strong></p>` +
        `<p>Estimasi tiba: ${d.etd || "akan diinfokan"}</p>` +
        (d.trackingUrl ? `<p>Lacak: <a href="${d.trackingUrl}">${d.trackingUrl}</a></p>` : "") +
        `<p>Terima kasih,<br/>${d.storeName || "BJS Racing Store"}</p>`,
    },
  },
  order_completed: {
    whatsapp: (d) =>
      `Halo ${d.customerName || "Customer"}!\n\n` +
      `Pesanan ${d.orderNumber} telah sampai. ` +
      `Terima kasih telah berbelanja di ${d.storeName || "BJS Racing Store"}.\n\n` +
      (d.trackingUrl ? `Detail: ${d.trackingUrl}\n\n` : "") +
      `Kami tunggu order Anda selanjutnya!`,
    email: {
      subject: (d) => `Pesanan ${d.orderNumber} Sampai - ${d.storeName || "BJS Racing Store"}`,
      body: (d) =>
        `<h2>Pesanan Selesai</h2>` +
        `<p>Halo ${d.customerName || "Customer"},</p>` +
        `<p>Pesanan <strong>${d.orderNumber}</strong> telah sampai.</p>` +
        `<p>Terima kasih telah berbelanja di ${d.storeName || "BJS Racing Store"}.</p>` +
        (d.trackingUrl ? `<p>Detail: <a href="${d.trackingUrl}">${d.trackingUrl}</a></p>` : "") +
        `<p>Kami tunggu order Anda selanjutnya!</p>`,
    },
  },
  order_cancelled: {
    whatsapp: (d) =>
      `Halo ${d.customerName || "Customer"}!\n\n` +
      `Pesanan ${d.orderNumber} telah dibatalkan. ` +
      `Jika ada pertanyaan, hubungi kami di ${d.storePhone || ""}.\n\n` +
      `Terima kasih,\n${d.storeName || "BJS Racing Store"}`,
    email: {
      subject: (d) => `Pesanan ${d.orderNumber} Dibatalkan - ${d.storeName || "BJS Racing Store"}`,
      body: (d) =>
        `<h2>Pesanan Dibatalkan</h2>` +
        `<p>Halo ${d.customerName || "Customer"},</p>` +
        `<p>Pesanan <strong>${d.orderNumber}</strong> telah dibatalkan.</p>` +
        `<p>Jika ada pertanyaan, hubungi kami di ${d.storePhone || ""}.</p>` +
        `<p>Terima kasih,<br/>${d.storeName || "BJS Racing Store"}</p>`,
    },
  },
  shipping_status_update: {
    whatsapp: (d) =>
      `Halo ${d.customerName || "Customer"}!\n\n` +
      `Status pengiriman pesanan ${d.orderNumber} diperbarui: ${d.shippingStatus || "sedang diproses"}.\n` +
      `No. Resi: ${d.trackingNumber || "-"}\n\n` +
      `Terima kasih,\n${d.storeName || "BJS Racing Store"}`,
    email: {
      subject: (d) => `Update Pengiriman ${d.orderNumber} - ${d.storeName || "BJS Racing Store"}`,
      body: (d) =>
        `<h2>Update Pengiriman</h2>` +
        `<p>Halo ${d.customerName || "Customer"},</p>` +
        `<p>Status pengiriman pesanan <strong>${d.orderNumber}</strong> diperbarui: <strong>${d.shippingStatus || "sedang diproses"}</strong>.</p>` +
        `<p>No. Resi: <strong>${d.trackingNumber || "-"}</strong></p>` +
        `<p>Terima kasih,<br/>${d.storeName || "BJS Racing Store"}</p>`,
    },
  },
  shipping_delivered: {
    whatsapp: (d) =>
      `Halo ${d.customerName || "Customer"}!\n\n` +
      `Pesanan ${d.orderNumber} telah diterima.\n` +
      `No. Resi: ${d.trackingNumber || "-"}\n\n` +
      `Terima kasih,\n${d.storeName || "BJS Racing Store"}`,
    email: {
      subject: (d) => `Pesanan ${d.orderNumber} Diterima - ${d.storeName || "BJS Racing Store"}`,
      body: (d) =>
        `<h2>Pesanan Diterima</h2>` +
        `<p>Halo ${d.customerName || "Customer"},</p>` +
        `<p>Pesanan <strong>${d.orderNumber}</strong> telah diterima.</p>` +
        `<p>No. Resi: <strong>${d.trackingNumber || "-"}</strong></p>` +
        `<p>Terima kasih,<br/>${d.storeName || "BJS Racing Store"}</p>`,
    },
  },
  booking_failed: {
    whatsapp: (d) =>
      `⚠️ Gagal Booking Biteship\n\n` +
      `Order: ${d.orderNumber || "-"}\n` +
      `Kurir: ${d.courierName || "tidak diketahui"}\n` +
      `Alasan: ${d.reason || "Unknown error"}\n\n` +
      `Segera proses order ini secara manual.`,
    email: {
      subject: (d) => `Gagal Booking Biteship - ${d.orderNumber || "Unknown"}`,
      body: (d) =>
        `<h2>Gagal Booking Biteship</h2>` +
        `<p>Order: <strong>${d.orderNumber || "-"}</strong></p>` +
        `<p>Kurir: <strong>${d.courierName || "tidak diketahui"}</strong></p>` +
        `<p>Alasan: ${d.reason || "Unknown error"}</p>` +
        `<p>Segera proses order ini secara manual.</p>`,
    },
  },
};

async function sendWhatsApp(payload: NotificationPayload): Promise<NotificationResult> {
  const provider = (import.meta.env.WHATSAPP_PROVIDER || "").toLowerCase();

  if (provider === "fonnte") {
    return sendFonnte(payload);
  }

  if (provider === "wablas") {
    return sendWablas(payload);
  }

  if (provider === "waapi") {
    return sendWaApi(payload);
  }

  return {
    success: false,
    message: "WhatsApp provider tidak dikonfigurasi. Set WHATSAPP_PROVIDER=fonnte, wablas atau waapi.",
  };
}

async function sendWablas(payload: NotificationPayload): Promise<NotificationResult> {
  const baseUrl = import.meta.env.WABLAS_BASE_URL;
  const apiKey = import.meta.env.WABLAS_API_KEY;
  if (!baseUrl || !apiKey) {
    return { success: false, message: "Wablas credentials tidak dikonfigurasi.", provider: "wablas" };
  }

  const template = EVENT_TEMPLATES[payload.event].whatsapp(payload.data);
  const response = await fetch(`${baseUrl}/api/v2/send-message`, {
    method: "POST",
    headers: {
      Authorization: apiKey,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      phone: payload.to,
      message: template,
    }),
  });

  const result = await response.json();
  if (!response.ok || result.status !== true) {
    return {
      success: false,
      message: result.message || "Gagal mengirim WhatsApp via Wablas.",
      provider: "wablas",
    };
  }

  return { success: true, provider: "wablas" };
}

async function sendWaApi(payload: NotificationPayload): Promise<NotificationResult> {
  const baseUrl = import.meta.env.WAAPI_BASE_URL;
  const apiKey = import.meta.env.WAAPI_API_KEY;
  if (!baseUrl || !apiKey) {
    return { success: false, message: "WaAPI credentials tidak dikonfigurasi.", provider: "waapi" };
  }

  const template = EVENT_TEMPLATES[payload.event].whatsapp(payload.data);
  const response = await fetch(`${baseUrl}/api/send-message`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      to: payload.to,
      message: template,
    }),
  });

  const result = await response.json();
  if (!response.ok || result.status !== true) {
    return {
      success: false,
      message: result.message || "Gagal mengirim WhatsApp via WaAPI.",
      provider: "waapi",
    };
  }

  return { success: true, provider: "waapi" };
}

async function sendFonnte(payload: NotificationPayload): Promise<NotificationResult> {
  const apiKey = import.meta.env.FONNTE_API_KEY;
  const sender = import.meta.env.FONNTE_SENDER_NUMBER;
  if (!apiKey || !sender) {
    return { success: false, message: "FONNTE credentials tidak dikonfigurasi.", provider: "fonnte" };
  }

  const normalizePhone = (num: string) => {
    let clean = String(num || "").replace(/[^0-9]/g, "");
    if (clean.startsWith("0")) clean = "62" + clean.slice(1);
    return clean;
  };

  const template = EVENT_TEMPLATES[payload.event].whatsapp(payload.data);
  const response = await fetch("https://api.fonnte.com/send", {
    method: "POST",
    headers: {
      Authorization: apiKey,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      target: normalizePhone(payload.to),
      message: template,
      sender,
      countryCode: "62",
    }),
  });

  const result = await response.json();
  if (!response.ok || result.status !== true) {
    return {
      success: false,
      message: result.reason || "Gagal mengirim WhatsApp via FONNTE.",
      provider: "fonnte",
    };
  }

  return { success: true, provider: "fonnte" };
}

async function sendEmail(payload: NotificationPayload): Promise<NotificationResult> {
  const provider = (import.meta.env.EMAIL_PROVIDER || "").toLowerCase();

  if (provider === "resend") {
    return sendResendEmail(payload);
  }

  return {
    success: false,
    message: "Email provider tidak dikonfigurasi. Set EMAIL_PROVIDER=resend.",
  };
}

async function sendResendEmail(payload: NotificationPayload): Promise<NotificationResult> {
  const apiKey = import.meta.env.RESEND_API_KEY;
  const fromEmail = import.meta.env.RESEND_FROM_EMAIL;
  if (!apiKey || !fromEmail) {
    return { success: false, message: "Resend credentials tidak dikonfigurasi.", provider: "resend" };
  }

  const template = EVENT_TEMPLATES[payload.event].email;
  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: fromEmail,
      to: payload.to,
      subject: template.subject(payload.data),
      html: template.body(payload.data),
    }),
  });

  const result = await response.json();
  if (!response.ok) {
    return {
      success: false,
      message: result.message || "Gagal mengirim email via Resend.",
      provider: "resend",
    };
  }

  return { success: true, provider: "resend" };
}

export async function sendOrderNotification(
  payload: NotificationPayload,
): Promise<NotificationResult> {
  if (payload.channel === "whatsapp") {
    return sendWhatsApp(payload);
  }

  if (payload.channel === "email") {
    return sendEmail(payload);
  }

  return { success: false, message: "Channel notification tidak didukung." };
}

/**
 * Ambil email pelanggan dari auth user terkait.
 * Tabel public.customers tidak menyimpan email; sumber kebenarannya adalah
 * auth.users.email yang ditautkan lewat kolom customers.auth_user_id.
 * Mengembalikan string kosong bila tidak tersedia — pemanggil cukup
 * melewati pengiriman email tanpa memutus alur utama.
 */
export async function getCustomerEmail(
  authUserId?: string | null,
): Promise<string> {
  if (!authUserId) return "";
  try {
    const { data } = await supabaseAdmin.auth.admin.getUserById(authUserId);
    return data?.user?.email || "";
  } catch {
    return "";
  }
}
