"use server";
import { revalidatePath } from "next/cache";
import { readAccess } from "@/lib/auth/access";
import { createClient } from "@/lib/supabase/server";
import { api, ApiError } from "@/lib/master/api";
import { choices, orderCustomers } from "@/lib/orders/data";
import type { Order, OrderResult } from "@/lib/orders/types";
import type { MasterRecord } from "@/lib/master/types";
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
async function checkAccess() {
  const access = await readAccess(await createClient());
  if (access.status !== "owner") throw new Error("Owner unavailable");
}
export async function searchOrderCustomers(q: string) {
  try {
    await checkAccess();
    return await orderCustomers(q);
  } catch {
    return {
      items: [] as MasterRecord[],
      error: "Pelanggan belum dapat dimuat. Coba lagi.",
    };
  }
}
export async function addOrderCustomer(name: string) {
  try {
    await checkAccess();
    return {
      customer: await api<MasterRecord>("/customers", "POST", {
        display_name: name,
        note: null,
      }),
    };
  } catch {
    return {
      error:
        "Pelanggan belum berhasil dikonfirmasi. Cari dahulu sebelum mencoba tambah lagi.",
    };
  }
}
export async function loadOrderChoices(day: string) {
  try {
    await checkAccess();
    return await choices(day);
  } catch {
    return {
      accounts: [] as MasterRecord[],
      defaultId: "",
      error: "Pilihan rekening belum dapat dimuat.",
    };
  }
}
export async function writeOrder(
  operation: "create" | "edit" | "receive-payment" | "mark-sent",
  id: string | null,
  payload: Record<string, unknown>,
  key?: string,
): Promise<OrderResult> {
  if (
    !["create", "edit", "receive-payment", "mark-sent"].includes(operation) ||
    (operation !== "create" && (!id || !uuid.test(id)))
  )
    return { error: "Permintaan tidak valid.", safeToEdit: true };
  try {
    await checkAccess();
  } catch {
    return {
      error: "Akses owner belum dapat diperiksa. Isian tetap tersedia.",
      safeToEdit: true,
    };
  }
  try {
    const path =
      operation === "create"
        ? "/orders"
        : `/orders/${id}${operation === "edit" ? "" : `/${operation}`}`;
    const order = await api<Order>(
      path,
      operation === "edit" ? "PATCH" : "POST",
      payload,
      key,
    );
    revalidatePath("/orders");
    if (id) revalidatePath(`/orders/${id}`);
    return { order };
  } catch (error) {
    const messages: Record<string, string> = {
      ORDER_LOCKED:
        "Order sudah direalisasikan. Hanya catatan yang boleh diubah.",
      ACCOUNT_NOT_ASSIGNED:
        "Rekening harus aktif dan dipilih untuk tanggal order ini.",
      STALE_ORDER: "Order berubah. Muat ulang detail sebelum mengedit.",
      STATE_CONFLICT:
        "Waktu konfirmasi sudah tercatat. Koreksi memerlukan alur terpisah.",
      IDEMPOTENCY_CONFLICT:
        "Permintaan sebelumnya memakai kunci yang sama dengan isian berbeda. Periksa daftar order.",
      AMOUNT_OVERFLOW: "Hasil IDR terlalu besar. Periksa jumlah dan rate.",
    };
    if (error instanceof ApiError && error.status < 500)
      return {
        error:
          messages[error.code] ??
          "Permintaan ditolak. Periksa isian dan sesi login.",
        safeToEdit: error.code !== "IDEMPOTENCY_CONFLICT",
      };
    return {
      error:
        "Hasil belum dapat dipastikan. Coba kembali dengan isian yang sama agar tidak membuat duplikat.",
      safeToEdit: false,
    };
  }
}
