"use server";
import { revalidatePath } from "next/cache";
import { readAccess } from "@/lib/auth/access";
import { createClient } from "@/lib/supabase/server";
import { api, ApiError } from "@/lib/master/api";
import type { MoneyOperation } from "@/lib/money-out";
export async function writeMoney(
  operation: MoneyOperation,
  id: string | null,
  payload: Record<string, unknown>,
  key: string,
): Promise<{
  ok?: boolean;
  error?: string;
  safeToEdit?: boolean;
  id?: string;
}> {
  if (
    ![
      "atm_create",
      "atm_edit",
      "atm_pay",
      "create",
      "void",
      "correct",
    ].includes(operation) ||
    (!["create", "atm_create"].includes(operation) &&
      (!id || !/^[0-9a-f-]{36}$/i.test(id)))
  )
    return { error: "Permintaan tidak valid.", safeToEdit: true };
  try {
    if ((await readAccess(await createClient())).status !== "owner")
      return { error: "Akses owner diperlukan.", safeToEdit: true };
  } catch {
    return { error: "Sesi belum dapat diperiksa.", safeToEdit: true };
  }
  try {
    const path =
      operation === "atm_create"
        ? "/atm-activities"
        : operation === "atm_edit"
          ? `/atm-activities/${id}`
          : operation === "atm_pay"
            ? `/atm-activities/${id}/pay`
            : operation === "create"
              ? "/outflows"
              : `/outflows/${id}/${operation}`;
    const result = await api<{ id?: string }>(
      path,
      operation === "atm_edit" ? "PATCH" : "POST",
      payload,
      key,
    );
    revalidatePath("/atm");
    revalidatePath("/outflows");
    revalidatePath("/outflows/[id]", "page");
    revalidatePath("/activity");
    return { ok: true, id: result.id };
  } catch (e) {
    if (e instanceof ApiError && e.status < 500)
      return {
        error:
          (
            {
              STALE_OUTFLOW: "Posting berubah. Muat ulang dan periksa riwayat.",
              STALE_ACTIVITY:
                "Aktivitas berubah. Muat ulang sebelum melanjutkan.",
              STATE_CONFLICT:
                "Status sudah berubah. Periksa posting terbaru; jangan buat pembayaran baru.",
              ACTIVITY_LOCKED:
                "Aktivitas sudah dibayar. Gunakan koreksi Money Out.",
              IDEMPOTENCY_CONFLICT:
                "Kunci permintaan telah dipakai dengan data berbeda.",
            } as Record<string, string>
          )[e.code] ??
          "Permintaan ditolak. Periksa jumlah, tanggal, dan isian wajib.",
        safeToEdit: e.code !== "IDEMPOTENCY_CONFLICT",
      };
    return {
      error:
        "Hasil belum pasti. Coba permintaan yang sama. Jika memuat ulang halaman, periksa riwayat sebelum memasukkan ulang.",
      safeToEdit: false,
    };
  }
}
