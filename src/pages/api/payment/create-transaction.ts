// File: /src/pages/api/payment/create-transaction.ts
import type { APIRoute } from "astro";
import { supabaseAdmin } from "@/lib/supabaseServer.ts";
import { getPaymentFee, toMidtransPaymentCode, type PaymentMethod } from "@/lib/paymentFee";
import { validateAndComputeVoucher, consumeVoucher, unconsumeVoucher } from "@/lib/voucher.ts";
import { generateBriQrMpm, BRI_CONFIG } from "@/lib/bri.ts";
import { sendOrderNotification } from "@/lib/notifications.ts";
import { MIDTRANS_SNAP_API_URL, getSnapCallbackUrls } from "@/lib/midtrans.ts";
import { Buffer } from "buffer";

interface FrontendCartItem {
    product_id: string;
    price: number;
    quantity: number;
    name: string;
    sku: string;
    image_url: string;
    berat_gram?: number | null;
    panjang_cm?: number | null;
    lebar_cm?: number | null;
    tinggi_cm?: number | null;
}

function generateOrderNumber() {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  const randomPart = crypto.randomUUID().split("-")[0].toUpperCase();
  return `BJS-${year}${month}${day}-${randomPart}`;
}

async function computeServerDiscount({
  voucher_code,
  customer_id,
  cart_subtotal,
  shipping_cost,
  cartProductIds,
}: {
  voucher_code: string | null;
  customer_id: string;
  cart_subtotal: number;
  shipping_cost: number;
  cartProductIds: string[];
}) {
  if (!voucher_code) return { discount_amount: 0, voucherId: null };
  const result = await validateAndComputeVoucher(
    voucher_code,
    customer_id,
    cart_subtotal,
    shipping_cost,
    cartProductIds,
  );
  if (!result.valid) throw new Error(result.message || "Voucher tidak valid.");
  return { discount_amount: result.discount_amount || 0, voucherId: result.voucher?.id ?? null };
}

export const POST: APIRoute = async ({ request, locals }) => {
    const { session } = locals;
    if (!session) {
        return new Response(
            JSON.stringify({ message: "Otentikasi diperlukan." }),
            { status: 401 },
        );
    }

    console.log("[CreateTransaction] Request started, user:", session.user.email);
    try {
        const body = await request.json();
        const {
            address_id,
            courier,
            cart_items,
            shipping_cost,
            payment_method,
            voucher_code,
            notes,
        } = body;
        const typedCartItems = cart_items as FrontendCartItem[];

        if (
            !address_id ||
            !courier ||
            !typedCartItems ||
            typedCartItems.length === 0
        ) {
            return new Response(
                JSON.stringify({ message: "Data checkout tidak lengkap." }),
                { status: 400 },
            );
        }

        if (!payment_method) {
            return new Response(
                JSON.stringify({ message: "Metode pembayaran harus dipilih." }),
                { status: 400 },
            );
        }

        // Blok validasi stok + harga dari database
        const productIds = typedCartItems.map((item) => item.product_id);
        const { data: productsInStock, error: stockCheckError } =
            await supabaseAdmin
                .from("products")
                .select("id, nama, stok, harga_jual")
                .in("id", productIds);
        if (stockCheckError)
            throw new Error("Gagal memverifikasi stok produk.");

        // Override harga dari database (server-side validation)
        for (const item of typedCartItems) {
            const product = productsInStock.find(
                (p) => p.id === item.product_id,
            );
            if (!product || item.quantity > product.stok) {
                return new Response(
                    JSON.stringify({
                        message: `Stok untuk produk "${item.name}" tidak mencukupi. Sisa stok: ${product?.stok || 0}. Silakan perbarui keranjang Anda.`,
                    }),
                    { status: 409 },
                );
            }
            // Override harga dari database (prevent stale cart prices)
            if (product.harga_jual !== undefined) {
                item.price = product.harga_jual;
            }
        }

        // Blok validasi stok flash sale
        const { data: flashSalesInStock, error: flashSaleStockError } =
            await supabaseAdmin
                .from("flash_sales")
                .select("id, product_id, stock_allocated")
                .in("product_id", productIds)
                .eq("is_active", true);
        if (flashSaleStockError)
            throw new Error("Gagal memverifikasi stok flash sale.");
        for (const item of typedCartItems) {
            const flashSale = flashSalesInStock.find(
                (fs) => fs.product_id === item.product_id,
            );
            if (flashSale && item.quantity > flashSale.stock_allocated) {
                return new Response(
                    JSON.stringify({
                        message: `Stok flash sale untuk produk "${item.name}" tidak mencukupi. Sisa: ${flashSale.stock_allocated}.`,
                    }),
                    { status: 409 },
                );
            }
        }

        const { data: customer, error: customerError } = await supabaseAdmin
            .from("customers")
            .select("id, nama_pelanggan, telepon")
            .eq("auth_user_id", session.user.id)
            .single();
        if (customerError) throw new Error("Profil pelanggan tidak ditemukan.");

        const { data: address, error: addressError } = await supabaseAdmin
            .from("customer_addresses")
            .select("*")
            .eq("id", address_id)
            .eq("customer_id", customer.id)
            .single();
        if (addressError) throw new Error("Alamat pengiriman tidak valid.");

        const subtotalProducts = typedCartItems.reduce(
            (acc: number, item: FrontendCartItem) =>
                acc + item.price * item.quantity,
            0,
        );
        const finalShippingCost = Number(shipping_cost) || 0;
        const paymentMethod = String(payment_method || "").toLowerCase();

        const { discount_amount: finalDiscountAmount, voucherId: appliedVoucherId } =
            await computeServerDiscount({
                voucher_code,
                customer_id: customer.id,
                cart_subtotal: subtotalProducts,
                shipping_cost: finalShippingCost,
                cartProductIds: typedCartItems.map((item) => item.product_id),
            });

        const feeBase =
          subtotalProducts +
          finalShippingCost -
          (finalDiscountAmount || 0);
        const finalPaymentGatewayFee = getPaymentFee(
          paymentMethod as PaymentMethod,
          feeBase,
        );

        const totalAmount =
            subtotalProducts +
            finalShippingCost +
            finalPaymentGatewayFee -
            (finalDiscountAmount || 0);

        const existingOrderId = (body as any).order_id as string | undefined;
        let orderNumber: string;
        let newOrder: { id: string; order_number: string; customer_id: string; [key: string]: any };

        if (existingOrderId) {
          const { data: existingOrder, error: existingOrderError } =
            await supabaseAdmin
              .from("orders")
              .select("*, order_items(*)")
              .eq("id", existingOrderId)
              .eq("customer_id", customer.id)
              .eq("status", "awaiting_payment")
              .single();

          if (existingOrder && !existingOrderError) {
            const oldOrderItems = existingOrder.order_items || [];
            orderNumber = existingOrder.order_number;
            newOrder = existingOrder;

            const oldVoucherCode = existingOrder.voucher_code;
            if (oldVoucherCode) {
              const { data: oldVoucher } = await supabaseAdmin
                .from("vouchers")
                .select("id, usage_count")
                .ilike("code", oldVoucherCode)
                .single();
              if (oldVoucher) {
                await unconsumeVoucher(customer.id, oldVoucher.id);
              }
            }

            if (oldOrderItems.length > 0) {
              const reverseLogs = oldOrderItems.map((item: any) => ({
                product_id: item.product_id,
                perubahan: item.quantity,
                keterangan: `Restore Reserve Order #${orderNumber}`,
                type: 'restore',
              }));
              await supabaseAdmin.from("stock_logs").insert(reverseLogs);
              await supabaseAdmin
                .from("stock_logs")
                .delete()
                .eq("keterangan", `Reserve Order #${orderNumber}`);
            }

            for (const item of oldOrderItems) {
              const { data: oldFlashSales } = await supabaseAdmin
                .from("flash_sales")
                .select("id, product_id, stock_allocated")
                .eq("product_id", item.product_id)
                .eq("is_active", true);
              const oldFlashSale = (oldFlashSales || []).find(
                (fs: any) => fs.product_id === item.product_id,
              );
              if (oldFlashSale) {
                await supabaseAdmin
                  .from("flash_sales")
                  .update({
                    stock_allocated: (oldFlashSale.stock_allocated || 0) + item.quantity,
                  })
                  .eq("id", oldFlashSale.id);
              }
            }

            await supabaseAdmin
              .from("order_items")
              .delete()
              .eq("order_id", existingOrderId);

            const { data: updatedOrder, error: updateError } = await supabaseAdmin
              .from("orders")
              .update({
                total_amount: totalAmount,
                shipping_cost: finalShippingCost,
                subtotal_products: subtotalProducts,
                service_fee: 0,
                payment_gateway_fee: finalPaymentGatewayFee,
                voucher_code: voucher_code,
                discount_amount: finalDiscountAmount,
                shipping_address: address,
                courier_details: courier,
                notes: (body as any).notes || null,
                status: "awaiting_payment",
              })
              .eq("id", existingOrderId)
              .select()
              .single();

            if (updateError) throw updateError;
            newOrder = updatedOrder;
          } else {
            orderNumber = generateOrderNumber();
            const { data: createdOrder, error: orderError } = await supabaseAdmin
              .from("orders")
              .insert({
                  order_number: orderNumber,
                  customer_id: customer.id,
                  total_amount: totalAmount,
                  shipping_cost: finalShippingCost,
                  subtotal_products: subtotalProducts,
                  service_fee: 0,
                  payment_gateway_fee: finalPaymentGatewayFee,
                  voucher_code: voucher_code,
                  discount_amount: finalDiscountAmount,
                  shipping_address: address,
                  courier_details: courier,
                  notes: (body as any).notes || null,
                  status: "awaiting_payment",
              })
              .select()
              .single();
            if (orderError) throw orderError;
            newOrder = createdOrder;
          }
        } else {
          orderNumber = generateOrderNumber();
          const { data: createdOrder, error: orderError } = await supabaseAdmin
            .from("orders")
            .insert({
                order_number: orderNumber,
                customer_id: customer.id,
                total_amount: totalAmount,
                shipping_cost: finalShippingCost,
                subtotal_products: subtotalProducts,
                service_fee: 0,
                payment_gateway_fee: finalPaymentGatewayFee,
                voucher_code: voucher_code,
                discount_amount: finalDiscountAmount,
                shipping_address: address,
                courier_details: courier,
                notes: (body as any).notes || null,
                status: "awaiting_payment",
            })
            .select()
            .single();
          if (orderError) throw orderError;
          newOrder = createdOrder;
        }

        const stockReserveEntries = typedCartItems.map((item: FrontendCartItem) => ({
          product_id: item.product_id,
          perubahan: -item.quantity,
          keterangan: `Reserve Order #${orderNumber}`,
          type: 'reserve',
        }));

        const { error: stockReserveError } = await supabaseAdmin
          .from("stock_logs")
          .insert(stockReserveEntries);
        if (stockReserveError) throw stockReserveError;

        if (appliedVoucherId) {
            await consumeVoucher(customer.id, appliedVoucherId);
        }

        const orderItemsData = typedCartItems.map((item: FrontendCartItem) => ({
            order_id: newOrder.id,
            product_id: item.product_id,
            quantity: item.quantity,
            price: item.price,
            product_snapshot: {
                name: item.name,
                sku: item.sku,
                image_url: item.image_url,
            },
            berat_gram: item.berat_gram ?? null,
            panjang_cm: item.panjang_cm ?? null,
            lebar_cm: item.lebar_cm ?? null,
            tinggi_cm: item.tinggi_cm ?? null,
        }));

        const { error: orderItemsError } = await supabaseAdmin
            .from("order_items")
            .insert(orderItemsData);
        if (orderItemsError) throw orderItemsError;

        const flashSaleProductIds = typedCartItems.map((item) => item.product_id);
        const { data: activeFlashSales, error: flashSalesError } =
          await supabaseAdmin
            .from("flash_sales")
            .select("id, product_id, stock_allocated")
            .in("product_id", flashSaleProductIds)
            .eq("is_active", true);
        if (flashSalesError) throw flashSalesError;

        for (const item of typedCartItems) {
          const flashSale = activeFlashSales.find(
            (fs) => fs.product_id === item.product_id,
          );
          if (!flashSale) continue;
          const { error: decrementError } = await supabaseAdmin
            .from("flash_sales")
            .update({ stock_allocated: flashSale.stock_allocated - item.quantity })
            .eq("id", flashSale.id)
            .gt("stock_allocated", -1);
          if (decrementError) throw decrementError;
        }

        const paymentGateway = (
            import.meta.env.PAYMENT_GATEWAY || "midtrans"
        ).toLowerCase();

        if (paymentGateway === "bri") {
            const qr = await generateBriQrMpm({
                partnerReferenceNo: orderNumber,
                amount: totalAmount,
                callbackUrl: BRI_CONFIG.callbackUrl,
            });
            await supabaseAdmin.from("payments").insert({
                order_id: newOrder.id,
                gateway: "bri",
                payment_reference: qr.qrContent,
                amount: totalAmount,
                status: "pending",
            });
            return new Response(
                JSON.stringify({
                    qr_content: qr.qrContent,
                    qr_image_base64: qr.qrImage,
                    expires_at: qr.expiresAt,
                    order_id: newOrder.id,
                }),
                { status: 200 },
            );
        }

        const formatAmount = (amount: number) => Math.round(amount * 100) / 100;
        const truncateName = (name: string) => name.substring(0, 50);

        const midtransServerKey = import.meta.env.MIDTRANS_SERVER_KEY;
        const authString = Buffer.from(`${midtransServerKey}:`).toString(
            "base64",
        );

        const item_details = typedCartItems.map((item: FrontendCartItem) => ({
            id: item.product_id,
            price: formatAmount(item.price),
            quantity: item.quantity,
            name: truncateName(item.name),
        }));
        if (finalShippingCost > 0) {
            item_details.push({
                id: "SHIPPING",
                price: formatAmount(finalShippingCost),
                quantity: 1,
                name: truncateName(`Ongkir (${courier.name} - ${courier.service})`),
            });
        }
        if (finalPaymentGatewayFee > 0) {
            item_details.push({
                id: "PAYMENT_GATEWAY_FEE",
                price: formatAmount(finalPaymentGatewayFee),
                quantity: 1,
                name: truncateName("Biaya Layanan Pembayaran"),
            });
        }

        if (finalDiscountAmount > 0) {
            item_details.push({
                id: `DISCOUNT_${voucher_code}`,
                price: formatAmount(-finalDiscountAmount),
                quantity: 1,
                name: truncateName(`Diskon (${voucher_code})`),
            });
        }

        const enabled_payments = finalPaymentGatewayFee > 0 ? [toMidtransPaymentCode(paymentMethod as any)] : [];

        const calculatedTotal = item_details.reduce(
            (sum, item) => sum + formatAmount(item.price) * item.quantity,
            0,
        );
        const grossAmount = formatAmount(calculatedTotal);

        const midtransPayload = {
            transaction_details: {
                order_id: orderNumber,
                gross_amount: grossAmount,
            },
            item_details: item_details.map((item) => ({
                ...item,
                price: formatAmount(item.price),
                name: truncateName(item.name),
            })),
            enabled_payments: enabled_payments,
            callbacks: getSnapCallbackUrls(
                orderNumber,
                new URL(request.url).origin,
            ),
            customer_details: {
                first_name: customer.nama_pelanggan,
                phone: customer.telepon,
                email: session.user.email,
                shipping_address: {
                    first_name: address.recipient_name,
                    phone: address.recipient_phone,
                    address: address.full_address,
                    city: address.destination_text.split(",")[0],
                    postal_code: address.postal_code,
                    country_code: "IDN",
                },
            },
        };

        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 15000);
        let midtransResponse: Response;
        try {
          midtransResponse = await fetch(MIDTRANS_SNAP_API_URL, {
            method: "POST",
            headers: {
              Accept: "application/json",
              "Content-Type": "application/json",
              Authorization: `Basic ${authString}`,
            },
            body: JSON.stringify(midtransPayload),
            signal: controller.signal,
          });
        } catch (err) {
          clearTimeout(timeoutId);
          throw new Error(
            err instanceof Error && err.name === "AbortError"
              ? "Gateway pembayaran tidak merespons. Silakan coba lagi."
              : `Gagal menghubungi Midtrans: ${err instanceof Error ? err.message : "unknown"}`,
          );
        } finally {
          clearTimeout(timeoutId);
        }

        const midtransResult = await midtransResponse.json();
        console.log("[Midtrans] Response status:", midtransResponse.status, "result:", midtransResult);
        if (!midtransResponse.ok) {
          const message =
            midtransResult?.status_message ||
            midtransResult?.message ||
            JSON.stringify(midtransResult);
          console.error("[Midtrans] Error:", message);
          throw new Error(`Midtrans Error: ${message}`);
        }

        await supabaseAdmin
            .from("payments")
            .insert({
                order_id: newOrder.id,
                midtrans_transaction_id: midtransResult.token,
                amount: totalAmount,
                status: "pending",
            });

        void sendOrderNotification({
          to: customer.telepon,
          channel: "whatsapp",
          event: "order_created",
          data: {
            orderNumber: newOrder.order_number,
            customerName: customer.nama_pelanggan,
            amount: totalAmount,
            storeName: import.meta.env.STORE_NAME || "BJS Racing Store",
            storePhone: import.meta.env.STORE_PHONE || "+62881011669213",
          },
        }).catch((err: unknown) => console.error("Gagal kirim notifikasi order_created:", err));

        const pointsToAdd = Math.floor(totalAmount / 100);
        if (pointsToAdd > 0) {
          try {
            await supabaseAdmin
              .from("loyalty_points")
              .insert({
                customer_id: customer.id,
                order_id: newOrder.id,
                points: pointsToAdd,
                type: "earned",
                description: `Poin dari pesanan ${newOrder.order_number}`,
              });
          } catch (err) {
            console.error("Gagal menambah loyalty points:", err);
          }
        }

        return new Response(
            JSON.stringify({
                snap_token: midtransResult.token,
                order_id: newOrder.id,
            }),
            { status: 200 },
        );
    } catch (error) {
        let errorMessage = "Terjadi kesalahan pada server.";
        if (error instanceof Error) {
            errorMessage = error.message;
        }
        console.error("[CreateTransaction] API Error:", error);
        return new Response(JSON.stringify({ message: errorMessage, detail: error instanceof Error ? error.stack : String(error) }), {
            status: 500,
        });
    }
    console.log("[CreateTransaction] Request completed successfully");
};
