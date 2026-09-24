"use server";
import { revalidatePath } from "next/cache";
import { requireOwner } from "@/lib/auth/guard";
import { api, actionError } from "@/lib/master/api";
import type { ActionResult, Entity } from "@/lib/master/types";
const entities = new Set(["customers", "accounts", "teams"]);
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export async function saveRecord(
  entity: Entity,
  id: string | null,
  payload: Record<string, unknown>,
): Promise<ActionResult> {
  await requireOwner();
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
  await requireOwner();
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
