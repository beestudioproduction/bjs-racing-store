// File: src/pages/api/kurir/assignments/[id]/status.ts
import type { APIRoute } from "astro";
import { supabaseAdmin } from "@/lib/supabaseServer.ts";
import { requireCourier } from "@/lib/courierAuth.ts";
import { sendOrderNotification, getCustomerEmail } from "@/lib/notifications.ts";

const ALLOWED_STATUSES = ["picked", "in_transit", "dropping_off", "completed", "cancelled"];

export const POST: APIRoute = async (context) => {
  const auth = await requireCourier(context);
  if (!auth.ok) {
    return new Response(JSON.stringify({ message: auth.message }), { status: auth.status });
  }

  const assignmentId = context.params.id;
  if (!assignmentId) {
    return new Response(JSON.stringify({ message: "ID penugasan wajib diisi." }), { status: 400 });
  }

  let body: any = {};
  try {
    body = await context.request.json();
  } catch {
    return new Response(JSON.stringify({ message: "Body tidak valid." }), { status: 400 });
  }

  const newStatus = String(body.status || "").toLowerCase();
  if (!ALLOWED_STATUSES.includes(newStatus)) {
    return new Response(
      JSON.stringify({ message: `Status tidak valid. Gunakan: ${ALLOWED_STATUSES.join(", ")}.` }),
      { status: 400 },
    );
  }

  const note = body.note ? String(body.note).slice(0, 500) : null;
  const photoUrl = body.photo_url ? String(body.photo_url).slice(0, 1000) : null;

  try {
    // 1) Pastikan penugasan milik kurir ini (admin/owner boleh mengubah penugasan apa pun)
    let q = supabaseAdmin
      .from("courier_assignments")
      .select("id, courier_id, status, order_id")
      .eq("id", assignmentId);
    if (auth.role === "courier") {
      q = q.eq("courier_id", auth.courierId);
    }
    const { data: assignment, error: fetchError } = await q.maybeSingle();

    if (fetchError) throw fetchError;
    if (!assignment) {
      return new Response(JSON.stringify({ message: "Penugasan tidak ditemukan." }), { status: 404 });
    }

    const isCompleted = newStatus === "completed";

    // 2) Update status penugasan
    const { error: updateError } = await supabaseAdmin
      .from("courier_assignments")
      .update({
        status: newStatus,
        photo_url: photoUrl || undefined,
        completed_at: isCompleted ? new Date().toISOString() : null,
      })
      .eq("id", assignmentId);
    if (updateError) throw updateError;

    // 3) Catat event timeline
    await supabaseAdmin.from("courier_assignment_events").insert({
      assignment_id: assignmentId,
      status: newStatus,
      note,
      created_by: auth.session.user.id,
    });

    // 4) Sinkronisasi ke orders (courier_details.shipping_status + status/komplit)
    const { data: order, error: orderError } = await supabaseAdmin
      .from("orders")
      .select("id, status, courier_details, order_number, customers (nama_pelanggan, telepon, auth_user_id)")
      .eq("id", assignment.order_id)
      .single();
    if (orderError) throw orderError;

    const o = order as any;
    const cd = o.courier_details || {};
    const orderPatch: any = {
      courier_details: { ...cd, shipping_status: newStatus },
    };
    if (isCompleted) {
      orderPatch.status = "completed";
      orderPatch.delivered_at = new Date().toISOString();
    }

    await supabaseAdmin.from("orders").update(orderPatch).eq("id", o.id);

    if (isCompleted) {
      const { data: deliveredItems } = await supabaseAdmin
        .from("order_items")
        .select("product_id, quantity")
        .eq("order_id", assignment.order_id);

      if (deliveredItems && deliveredItems.length > 0) {
        const saleLogs = deliveredItems.map((item: any) => ({
          product_id: item.product_id,
          perubahan: -item.quantity,
          keterangan: `Penjualan Online - Order #${o.order_number}`,
          type: "online_sale",
        }));
        await supabaseAdmin.from("stock_logs").insert(saleLogs);
      }
    }

    // 5) Notifikasi WhatsApp saat pesanan selesai (jangan menggagalkan update status)
    if (isCompleted) {
      const customer = Array.isArray(o.customers) ? (o.customers[0] || null) : (o.customers || null);
      const phone = customer?.telepon || cd.recipient_phone || "";
      const trackingUrl = new URL(`/tracking/${o.order_number}`, context.url.origin).toString();
      if (phone) {
        sendOrderNotification({
          to: phone,
          channel: "whatsapp",
          event: "order_completed",
          data: {
            orderNumber: o.order_number,
            customerName: customer?.nama_pelanggan,
            trackingUrl,
            storeName: import.meta.env.STORE_NAME || "BJS Racing Store",
          },
        }).catch((err) => console.error("[Kurir] notifikasi selesai gagal:", err));
      }

      // Email pesanan selesai (momen penting) — jalur terpisah dari WA,
      // kegagalan tidak memengaruhi alur utama.
      try {
        const customerEmail = await getCustomerEmail(customer?.auth_user_id);
        if (customerEmail) {
          await sendOrderNotification({
            to: customerEmail,
            channel: "email",
            event: "order_completed",
            data: {
              orderNumber: o.order_number,
              customerName: customer?.nama_pelanggan,
              trackingUrl,
              storeName: import.meta.env.STORE_NAME || "BJS Racing Store",
            },
          });
        }
      } catch (emailErr) {
        console.error("[Kurir] Gagal kirim email order_completed:", emailErr);
      }
    }

    return new Response(
      JSON.stringify({ success: true, status: newStatus }),
      { status: 200, headers: { "Content-Type": "application/json" } },
    );
  } catch (err) {
    console.error("Kurir status update error:", err);
    return new Response(
      JSON.stringify({ message: "Gagal memperbarui status." }),
      { status: 500 },
    );
  }
};
