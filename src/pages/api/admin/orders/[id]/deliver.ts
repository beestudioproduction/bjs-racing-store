// File: src/pages/api/admin/orders/[id]/deliver.ts
import type { APIRoute } from "astro";
import { supabaseAdmin } from "@/lib/supabaseServer.ts";
import { sendOrderNotification, getCustomerEmail } from "@/lib/notifications.ts";

export const POST: APIRoute = async (context) => {
  const { params, locals } = context;
  const { session } = locals;
  if (!session) {
    return new Response(JSON.stringify({ message: "Tidak diizinkan." }), {
      status: 401,
    });
  }

  const orderId = params.id;
  if (!orderId) {
    return new Response(JSON.stringify({ message: "Order ID wajib diisi." }), {
      status: 400,
    });
  }

  try {
    const { data: order, error: orderError } = await supabaseAdmin
      .from("orders")
      .select("id, status, courier_details, order_number, customers (nama_pelanggan, telepon, auth_user_id)")
      .eq("id", orderId)
      .single();

    if (orderError || !order) {
      return new Response(JSON.stringify({ message: "Pesanan tidak ditemukan." }), {
        status: 404,
      });
    }

    const courierCode = String(order.courier_details?.code || "").toLowerCase();
    if (courierCode !== "internal") {
      return new Response(
        JSON.stringify({ message: "Hanya pesanan BJS Express yang dapat dikonfirmasi melalui endpoint ini." }),
        { status: 400 },
      );
    }

    if (order.status === "completed") {
      return new Response(
        JSON.stringify({ message: "Pesanan ini sudah diselesaikan." }),
        { status: 400 },
      );
    }

    const { data: orderItems, error: itemsError } = await supabaseAdmin
      .from("order_items")
      .select("product_id, quantity")
      .eq("order_id", orderId);

    if (itemsError) throw itemsError;

    if (orderItems && orderItems.length > 0) {
      const saleLogs = orderItems.map((item: any) => ({
        product_id: item.product_id,
        perubahan: -item.quantity,
        keterangan: `Penjualan Dikonfirmasi - Order #${order.order_number}`,
        type: "online_sale",
      }));

      const { error: logError } = await supabaseAdmin
        .from("stock_logs")
        .insert(saleLogs);

      if (logError) throw logError;
    }

    const cd = order.courier_details || {};
    const { error: updateError } = await supabaseAdmin
      .from("orders")
      .update({
        status: "completed",
        delivered_at: new Date().toISOString(),
        courier_details: {
          ...cd,
          shipping_status: "completed",
        },
      })
      .eq("id", orderId);

    if (updateError) throw updateError;

    const { data: assignments } = await supabaseAdmin
      .from("courier_assignments")
      .select("id")
      .eq("order_id", orderId)
      .neq("status", "completed");

    for (const asg of assignments || []) {
      await supabaseAdmin
        .from("courier_assignments")
        .update({ status: "completed", completed_at: new Date().toISOString() })
        .eq("id", asg.id);

      await supabaseAdmin.from("courier_assignment_events").insert({
        assignment_id: asg.id,
        status: "completed",
        note: "Dikonfirmasi oleh admin",
        created_by: session.user.id,
      });
    }

    const customer = Array.isArray(order.customers) ? (order.customers[0] || null) : (order.customers || null);
    const phone = customer?.telepon || cd.recipient_phone || "";
    const trackingUrl = new URL(`/tracking/${order.order_number}`, context.url.origin).toString();
    if (phone) {
      sendOrderNotification({
        to: phone,
        channel: "whatsapp",
        event: "order_completed",
        data: {
          orderNumber: order.order_number,
          customerName: customer?.nama_pelanggan,
          trackingUrl,
          storeName: import.meta.env.STORE_NAME || "BJS Racing Store",
        },
      }).catch((err) => console.error("[Admin] notifikasi selesai gagal:", err));
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
            orderNumber: order.order_number,
            customerName: customer?.nama_pelanggan,
            trackingUrl,
            storeName: import.meta.env.STORE_NAME || "BJS Racing Store",
          },
        });
      }
    } catch (emailErr) {
      console.error("[Admin] Gagal kirim email order_completed:", emailErr);
    }

    return new Response(
      JSON.stringify({
        success: true,
        message: `Pesanan #${order.order_number} berhasil diselesaikan.`,
      }),
      { status: 200 },
    );
  } catch (error) {
    console.error("Confirm BJS Express delivery error:", error);
    return new Response(
      JSON.stringify({
        message: error instanceof Error ? error.message : "Gagal mengkonfirmasi pengiriman.",
      }),
      { status: 500 },
    );
  }
};
