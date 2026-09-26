"use server";
import { revalidatePath } from "next/cache";
import { readAccess } from "@/lib/auth/access";
import { createClient } from "@/lib/supabase/server";
import { api, ApiError } from "@/lib/master/api";
export async function writeTeam(
  operation: "movement" | "create" | "edit" | "pay",
  id: string | null,
  payload: Record<string, unknown>,
  key: string,
): Promise<{ ok?: boolean; error?: string; safeToEdit?: boolean }> {
  if (
    !["movement", "create", "edit", "pay"].includes(operation) ||
    (["edit", "pay"].includes(operation) &&
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
      operation === "movement"
        ? "/team-movements"
        : operation === "create"
          ? "/team-activities"
          : `/team-activities/${id}${operation === "pay" ? "/pay" : ""}`;
    await api(path, operation === "edit" ? "PATCH" : "POST", payload, key);
    revalidatePath("/activity");
    revalidatePath("/orders");
    return { ok: true };
  } catch (e) {
    if (e instanceof ApiError && e.status < 500)
      return {
        error:
          (
            {
              ACTIVITY_LOCKED:
                "Fee sudah dibayar. Koreksi memerlukan alur terpisah.",
              STALE_ACTIVITY: "Aktivitas berubah. Muat ulang sebelum mengedit.",
              STATE_CONFLICT:
                "Tanggal pembayaran sudah tercatat dan tidak dapat diganti.",
              DUPLICATE:
                "Aktivitas tim pada tanggal ini sudah ada. Buka aktivitas tersebut.",
              IDEMPOTENCY_CONFLICT:
                "Kunci permintaan sudah digunakan dengan isian berbeda.",
            } as Record<string, string>
          )[e.code] ??
          "Permintaan ditolak. Periksa tanggal, jumlah, tim, dan order.",
        safeToEdit: e.code !== "IDEMPOTENCY_CONFLICT",
      };
    return {
      error:
        "Hasil belum pasti. Gunakan coba permintaan yang sama; jangan membuat entri baru.",
      safeToEdit: false,
    };
  }
}
