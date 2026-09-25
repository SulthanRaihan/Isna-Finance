"use server";
import { revalidatePath } from "next/cache";
import { readAccess } from "@/lib/auth/access";
import { createClient } from "@/lib/supabase/server";
import { api, actionError } from "@/lib/master/api";
import type { ActionResult, Entity } from "@/lib/master/types";
const entities = new Set(["customers", "accounts", "teams"]);
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export async function saveRecord(
  entity: Entity,
  id: string | null,
  payload: Record<string, unknown>,
): Promise<ActionResult> {
  const denied = await checkWriteAccess();
  if (denied) return denied;
  if (!entities.has(entity) || (id && (!uuid.test(id) || entity === "teams")))
    return { error: "Permintaan tidak valid." };
  try {
    await api(
      `/${entity}${id ? `/${id}` : ""}`,
      id ? "PATCH" : "POST",
      payload,
    );
    revalidatePath(`/${entity}`);
    revalidatePath("/daily-accounts");
    return { ok: true };
  } catch (error) {
    return actionError(error);
  }
}
export async function saveDaily(
  day: string,
  ids: string[],
  defaultId: string | null,
): Promise<ActionResult> {
  const denied = await checkWriteAccess();
  if (denied) return denied;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(day))
    return { error: "Tanggal tidak valid." };
  try {
    await api(`/daily-accounts/${day}`, "PUT", {
      active_account_ids: ids,
      default_account_id: defaultId,
    });
    revalidatePath("/daily-accounts");
    revalidatePath("/accounts");
    return { ok: true };
  } catch (error) {
    return actionError(error);
  }
}

// Action failures stay in the form; page guards may still redirect on navigation.
async function checkWriteAccess(): Promise<ActionResult | null> {
  try {
    const access = await readAccess(await createClient());
    if (access.status === "owner") return null;
    if (access.status === "unavailable")
      return {
        error:
          "Akses belum dapat diperiksa. Isian tetap tersedia; coba lagi nanti.",
      };
    return { error: "Sesi owner tidak tersedia. Silakan masuk kembali." };
  } catch {
    return {
      error:
        "Akses belum dapat diperiksa. Isian tetap tersedia; coba lagi nanti.",
    };
  }
}
