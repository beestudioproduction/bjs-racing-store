// File: src/pages/api/shipping/biteship/webhook.ts
// Webhook Biteship untuk update status tracking + notifikasi WA via FONNTE.
import type { APIRoute } from "astro";
import { supabaseAdmin } from "@/lib/supabaseServer.ts";
import { verifyBiteshipWebhook } from "@/lib/biteship.ts";
import { sendOrderNotification, getCustomerEmail } from "@/lib/notifications.ts";

const SHIPPING_STATUS_LABEL: Record<string, string> = {
  pending: "menunggu",
  confirmed: "dikonfirmasi",
  scheduled: "dijadwalkan",
  allocated: "kurir dialokasikan",
  picking_up: "kurir menuju lokasi penjemputan",
  picked: "barang diambil kurir",
  in_transit: "dalam perjalanan",
  dropping_off: "sedang diantar",
  delivered: "tiba di tujuan",
  failed: "gagal",
  cancelled: "dibatalkan",
};

function normalizeStatus(status?: string): string {
  if (!status) return "sedang diproses";
  const key = String(status).toLowerCase().trim();
  return SHIPPING_STATUS_LABEL[key] || status;
}

export const POST: APIRoute = async (context) => {
  try {
    const raw = await context.request.text();
    const trimmed = raw.trim();

    if (!trimmed || trimmed === "{}") {
      return new Response("OK", { status: 200 });
    }

    if (!verifyBiteshipWebhook(context.request.headers, raw)) {
      return new Response("OK", { status: 200 });
    }

    const body = JSON.parse(trimmed);
    const event = body.event || "order.status";
    const biteshipOrderId = body.order_id;

    if (!biteshipOrderId) {
      return new Response("OK", { status: 200 });
    }

    const { data: orders } = await supabaseAdmin
      .from("orders")
      .select("id, courier_details, order_number, customer_id")
      .filter("courier_details->>biteship_order_id", "eq", biteshipOrderId);

    if (!orders || orders.length === 0) {
      return new Response("OK", { status: 200 });
    }

    const o = orders[0];
    const cd = o.courier_details || {};

    if (event === "order.price") {
      const newPrice = body.price;
      if (typeof newPrice === "number") {
        await supabaseAdmin
          .from("orders")
          .update({
            courier_details: {
              ...cd,
              price: newPrice,
            },
          })
          .eq("id", o.id);
      }
      return new Response("OK", { status: 200 });
    }

    if (event === "order.waybill_id") {
      const newWaybill = body.waybill_id || body.courier_waybill_id || "";
      if (newWaybill) {
        await supabaseAdmin
          .from("orders")
          .update({
            courier_details: {
              ...cd,
              waybill_id: newWaybill,
            },
          })
          .eq("id", o.id);
      }
      return new Response("OK", { status: 200 });
    }

    const status = body.status;
    const waybill = body.courier_waybill_id || body.waybill_id || "";

    const normalizedStatus = String(status || "").toLowerCase();
    const isFinalStatus = ["delivered", "failed", "cancelled"].includes(normalizedStatus);

    const updatePayload: any = {
      shipping_status: status,
      waybill_id: waybill || cd.waybill_id,
    };

    if (normalizedStatus === "delivered") {
      updatePayload.status = "completed";
      updatePayload.delivered_at = new Date().toISOString();
    }

    await supabaseAdmin
      .from("orders")
      .update({
        courier_details: {
          ...cd,
          ...updatePayload,
        },
      })
      .eq("id", o.id);

    if (normalizedStatus === "failed" || normalizedStatus === "cancelled") {
      const { data: failedItems } = await supabaseAdmin
        .from("order_items")
        .select("product_id, quantity")
        .eq("order_id", o.id);

      if (failedItems && failedItems.length > 0) {
        const restoreLogs = failedItems.map((it: any) => ({
          product_id: it.product_id,
          perubahan: it.quantity,
          keterangan: `Restore Order #${o.order_number} - Pengiriman ${normalizedStatus}`,
          type: 'restore',
        }));

        await supabaseAdmin.from("stock_logs").insert(restoreLogs);
      }
    }

    if (normalizedStatus === "delivered") {
      const { data: deliveredItems } = await supabaseAdmin
        .from("order_items")
        .select("product_id, quantity")
        .eq("order_id", o.id);

      if (deliveredItems && deliveredItems.length > 0) {
        const saleLogs = deliveredItems.map((it: any) => ({
          product_id: it.product_id,
          perubahan: -it.quantity,
          keterangan: `Penjualan Dikonfirmasi - Order #${o.order_number}`,
          type: 'online_sale',
        }));

        await supabaseAdmin.from("stock_logs").insert(saleLogs);
      }
    }

    const { data: customer } = await supabaseAdmin
      .from("customers")
      .select("nama_pelanggan, telepon, auth_user_id")
      .eq("id", o.customer_id)
      .single();

    const phone = customer?.telepon || cd?.recipient_phone || "";
    if (phone) {
      try {
        const eventName = normalizedStatus === "delivered" ? "shipping_delivered" : "shipping_status_update";
        await sendOrderNotification({
          to: phone,
          channel: "whatsapp",
          event: eventName,
          data: {
            orderNumber: o.order_number,
            customerName: customer?.nama_pelanggan,
            trackingNumber: waybill || cd.waybill_id,
            shippingStatus: normalizeStatus(status),
            storeName: import.meta.env.STORE_NAME || "BJS Racing Store",
            storePhone: import.meta.env.STORE_PHONE || "+62881011669213",
          },
        });
      } catch (err) {
        console.error("[Biteship] notifikasi gagal:", err);
      }
    }

    // Email "pesanan diterima" hanya pada milestone delivered — update status
    // perantara tidak dikirim via email agar inbox pelanggan tidak penuh.
    if (normalizedStatus === "delivered") {
      try {
        const customerEmail = await getCustomerEmail(customer?.auth_user_id);
        if (customerEmail) {
          await sendOrderNotification({
            to: customerEmail,
            channel: "email",
            event: "shipping_delivered",
            data: {
              orderNumber: o.order_number,
              customerName: customer?.nama_pelanggan,
              trackingNumber: waybill || cd.waybill_id,
              shippingStatus: normalizeStatus(status),
              storeName: import.meta.env.STORE_NAME || "BJS Racing Store",
              storePhone: import.meta.env.STORE_PHONE || "+62881011669213",
            },
          });
        }
      } catch (emailErr) {
        console.error("[Biteship] Gagal kirim email shipping_delivered:", emailErr);
      }
    }

    return new Response("OK", { status: 200 });
  } catch (error) {
    console.error("[Biteship] webhook error:", error);
    return new Response("OK", { status: 200 });
  }
};
